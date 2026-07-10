import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
} from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { prisma } from '@/lib/db';
import { chatTools } from '@/lib/chat/tools';
import { buildSystemPrompt } from '@/lib/chat/systemPrompt';
import { buildFinancialContext, renderContextText } from '@/lib/memory/contextBuilder';
import {
  DEFAULT_CHAT_MODEL,
  normalizeChatModel,
} from '@/lib/chat/models';
import { ChatApiError } from '@/lib/chat/errors';
import { checkChatRateLimit } from '@/lib/chat/rateLimit';
import {
  dbMessageToUIMessage,
  getTextFromParts,
  previewFromStoredContent,
  serializeMessage,
} from '@/lib/chat/storage';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { withApiLogging } from '@/lib/apiLogger';

export const maxDuration = 60;

const FALLBACK_SYSTEM_PROMPT = `You are a helpful financial assistant for the xpend spending tracker app. You help users understand spending, find transactions, and manage finances.\n\nBe concise, format currency with $, and use tools to retrieve real data.`;
const TITLE_PROMPT = `Generate a short chat title (2-5 words) summarizing the user's message.\n\nOutput only the title text.`;

async function getChatConfig(): Promise<{ apiKey: string | null; chatModel: string }> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
      select: { geminiApiKey: true, geminiChatModel: true },
    });

    return {
      apiKey: settings?.geminiApiKey || null,
      chatModel: normalizeChatModel(settings?.geminiChatModel),
    };
  } catch (error) {
    console.error('Error fetching chat config:', error);
    return { apiKey: null, chatModel: DEFAULT_CHAT_MODEL };
  }
}

async function generateTitleForSession(
  model: LanguageModel,
  sessionId: string,
  message: UIMessage
): Promise<void> {
  const userText = getTextFromParts(message.parts);
  if (!userText) {
    return;
  }

  try {
    const { text } = await generateText({
      model,
      system: TITLE_PROMPT,
      prompt: userText,
    });

    const title = text
      .replace(/^[#*"\s]+/, '')
      .replace(/["\s]+$/, '')
      .trim();

    if (!title) {
      return;
    }

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  } catch (error) {
    console.warn('Failed to generate chat title:', error);
  }
}

async function ensureSession(sessionId: string): Promise<{ id: string; title: string | null }> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, title: true },
  });

  if (session) {
    return session;
  }

  const created = await prisma.chatSession.create({
    data: {
      id: sessionId,
      title: 'New Chat',
    },
    select: { id: true, title: true },
  });

  return created;
}

function parseBody(json: unknown): PostRequestBody {
  const parsed = postRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ChatApiError('bad_request:api');
  }

  return parsed.data;
}

export const POST = withApiLogging(async (req: Request) => {
  let body: PostRequestBody;

  try {
    body = parseBody(await req.json());
  } catch (error) {
    if (error instanceof ChatApiError) {
      return error.toResponse();
    }

    return new ChatApiError('bad_request:api').toResponse();
  }

  try {
    await checkChatRateLimit(req);

    const { id: sessionId, message, messages } = body;

    const { apiKey, chatModel } = await getChatConfig();
    if (!apiKey) {
      return new ChatApiError('bad_request:settings').toResponse();
    }

    const openrouter = createOpenRouter({ apiKey });
    const model = openrouter(chatModel);

    const session = await ensureSession(sessionId);

    const isToolApprovalFlow = Array.isArray(messages) && messages.length > 0;

    let uiMessages: UIMessage[];

    if (isToolApprovalFlow) {
      uiMessages = messages as UIMessage[];
    } else {
      const storedMessages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      });

      uiMessages = storedMessages.map(dbMessageToUIMessage);

      if (message) {
        uiMessages.push(message as UIMessage);
      }
    }

    if (uiMessages.length === 0) {
      return new ChatApiError('bad_request:api').toResponse();
    }

    if (!isToolApprovalFlow && message?.role === 'user') {
      await prisma.chatMessage.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          sessionId,
          role: 'user',
          content: serializeMessage(message as UIMessage),
        },
        update: {
          content: serializeMessage(message as UIMessage),
        },
      });
    }

    let systemPrompt = FALLBACK_SYSTEM_PROMPT;
    try {
      systemPrompt = await buildSystemPrompt();
    } catch (promptError) {
      console.error('Error building system prompt:', promptError);
    }

    // Additively inject remembered financial-journey context. Fail-soft: if the
    // memory layer errors or has nothing, the chat prompt is unchanged.
    try {
      const memoryContext = await buildFinancialContext();
      const memoryText = renderContextText(memoryContext);
      if (memoryText) {
        systemPrompt = `${systemPrompt}\n\n${memoryText}`;
      }
    } catch (memoryError) {
      console.error('Error building memory context:', memoryError);
    }

    const modelMessages = await convertToModelMessages(
      uiMessages.map((currentMessage) => ({
        role: currentMessage.role,
        parts: currentMessage.parts,
      })),
      { tools: chatTools }
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools: chatTools,
      stopWhen: stepCountIs(6),
    });

    const titlePromise =
      message?.role === 'user' && (!session.title || session.title === 'New Chat')
        ? generateTitleForSession(model, sessionId, message as UIMessage)
        : Promise.resolve();

    const stream = createUIMessageStream<UIMessage>({
      originalMessages: uiMessages,
      generateId: () => `msg-${generateId()}`,
      execute: ({ writer }) => {
        writer.merge(result.toUIMessageStream());
      },
      onFinish: async ({ messages: finishedMessages }) => {
        try {
          await titlePromise;

          const assistantMessage = [...finishedMessages]
            .reverse()
            .find((currentMessage) => currentMessage.role === 'assistant');

          if (!assistantMessage) {
            return;
          }

          await prisma.chatMessage.upsert({
            where: { id: assistantMessage.id },
            create: {
              id: assistantMessage.id,
              sessionId,
              role: 'assistant',
              content: serializeMessage(assistantMessage),
            },
            update: {
              content: serializeMessage(assistantMessage),
            },
          });
        } catch (saveError) {
          console.error('Error saving assistant message:', saveError);
        }
      },
      onError: (error) => {
        console.error('Chat stream error:', error);
        return 'Oops, an error occurred!';
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('Unhandled chat API error:', error);

    if (error instanceof ChatApiError) {
      return error.toResponse();
    }

    return new ChatApiError('offline:chat').toResponse();
  }
});

export const GET = withApiLogging(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('id');

    if (!sessionId) {
      try {
        const sessions = await prisma.chatSession.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        return Response.json({
          sessions: sessions.map((session) => ({
            id: session.id,
            title: session.title || previewFromStoredContent(session.messages[0]?.content || ''),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          })),
        });
      } catch (dbError) {
        console.error('Database error loading sessions:', dbError);
        return Response.json({ sessions: [] });
      }
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    return Response.json({
      session: {
        id: session.id,
        title: session.title,
        messages: session.messages.map((message) => {
          const uiMessage = dbMessageToUIMessage(message);
          return {
            id: uiMessage.id,
            role: uiMessage.role,
            parts: uiMessage.parts,
            createdAt: message.createdAt,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Error in chat GET:', error);
    return Response.json({ error: 'Failed to load chat data', sessions: [] }, { status: 500 });
  }
});

export const PUT = withApiLogging(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { title } = body as { title?: string };

    try {
      const session = await prisma.chatSession.create({
        data: {
          title: title || null,
        },
      });

      return Response.json({ session });
    } catch (dbError) {
      console.error('Database error creating session:', dbError);
      const tempSession = {
        id: `temp-${Date.now()}`,
        title: title || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return Response.json({ session: tempSession });
    }
  } catch (error) {
    console.error('Error creating chat session:', error);
    return Response.json({ error: 'Failed to create session' }, { status: 500 });
  }
});

export const DELETE = withApiLogging(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || searchParams.get('id');

  if (!sessionId) {
    return Response.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return Response.json({ error: 'Failed to delete session' }, { status: 500 });
  }
});
