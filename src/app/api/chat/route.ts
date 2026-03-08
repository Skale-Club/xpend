import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { prisma } from '@/lib/db';
import { chatTools } from '@/lib/chat/tools';
import { buildSystemPrompt } from '@/lib/chat/systemPrompt';
import { DEFAULT_GEMINI_CHAT_MODEL, GEMINI_CHAT_MODEL_VALUES, GeminiChatModel } from '@/lib/chat/models';

// Get Gemini API key from database settings
async function getGeminiChatConfig(): Promise<{ apiKey: string | null; chatModel: string }> {
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 'default' },
            select: { geminiApiKey: true },
        });

        const rows = await prisma.$queryRaw<Array<{ geminiChatModel: string }>>`
            SELECT "geminiChatModel"
            FROM "Settings"
            WHERE "id" = 'default'
            LIMIT 1
        `;
        const storedModel = rows[0]?.geminiChatModel;
        const chatModel = storedModel && GEMINI_CHAT_MODEL_VALUES.has(storedModel)
            ? (storedModel as GeminiChatModel)
            : DEFAULT_GEMINI_CHAT_MODEL;

        return {
            apiKey: settings?.geminiApiKey || null,
            chatModel,
        };
    } catch (error) {
        console.error('Error fetching Gemini API key:', error);
        return { apiKey: null, chatModel: DEFAULT_GEMINI_CHAT_MODEL };
    }
}

function extractLastUserText(messages: Array<{ role: string; content: unknown }>): string {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) return '';

    if (typeof lastUserMessage.content === 'string') {
        return lastUserMessage.content;
    }

    try {
        return JSON.stringify(lastUserMessage.content);
    } catch {
        return '';
    }
}

function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '[]';
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, sessionId } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Invalid request: messages array is required.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get API key from settings
        const { apiKey, chatModel } = await getGeminiChatConfig();

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'Gemini API key not configured. Please add your API key in Settings.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Build system prompt with current data context
        let systemPrompt: string;
        try {
            systemPrompt = await buildSystemPrompt();
        } catch (promptError) {
            console.error('Error building system prompt:', promptError);
            // Use a fallback prompt if database access fails
            systemPrompt = `You are a helpful financial assistant for the xpend spending tracker app. You help users understand their spending and manage their finances.

## Your Capabilities
You can help users:
1. **Query transactions** - Find specific transactions, filter by date, amount, category
2. **Analyze spending** - Show spending breakdowns by category, monthly summaries
3. **Categorize transactions** - Assign categories to transactions
4. **Create rules** - Set up automatic categorization rules

## Guidelines
- Be concise and helpful
- Format currency values with $ symbol
- When showing lists, use bullet points

Note: Some data may not be available if the database is not fully configured.`;
        }

        const google = createGoogleGenerativeAI({ apiKey });

        const result = await generateText({
            model: google(chatModel),
            system: systemPrompt,
            messages,
            tools: chatTools,
        });

        // Save user message to history if sessionId provided
        if (sessionId && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                try {
                    await prisma.chatMessage?.create({
                        data: {
                            sessionId,
                            role: 'user',
                            content: typeof lastMessage.content === 'string'
                                ? lastMessage.content
                                : JSON.stringify(lastMessage.content),
                        },
                    });
                } catch {
                    // Ignore errors saving to history
                }
            }
        }

        let assistantText = result.text?.trim() || '';

        if (!assistantText && result.toolResults.length > 0) {
            try {
                const toolResultsText = safeJsonStringify(result.toolResults).slice(0, 12000);
                const lastUserText = extractLastUserText(messages);

                const fallbackResult = await generateText({
                    model: google(chatModel),
                    system: `${systemPrompt}\n\nYou must provide a final user-facing answer based on the tool results. Do not return empty output.`,
                    prompt: `User question: ${lastUserText}\n\nTool results (JSON): ${toolResultsText}\n\nProvide a concise and clear answer for the user.`,
                });

                assistantText = fallbackResult.text?.trim() || '';
            } catch (fallbackError) {
                console.error('Fallback generation error:', fallbackError);
            }
        }

        if (!assistantText) {
            assistantText = 'I could not generate a response. Please try again.';
        }

        if (sessionId) {
            try {
                await prisma.chatMessage?.create({
                    data: {
                        sessionId,
                        role: 'assistant',
                        content: assistantText,
                    },
                });
            } catch {
                // Ignore errors saving to history
            }
        }

        return new Response(
            JSON.stringify({ text: assistantText }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Chat API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const responseError = process.env.NODE_ENV === 'development'
            ? `Failed to process chat request: ${errorMessage}`
            : 'Failed to process chat request';

        return new Response(
            JSON.stringify({ error: responseError }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// Get chat history for a session
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            // Return list of sessions
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
                    sessions: sessions.map(s => ({
                        id: s.id,
                        title: s.title || s.messages[0]?.content?.slice(0, 50) || 'New Chat',
                        createdAt: s.createdAt,
                        updatedAt: s.updatedAt,
                    })),
                });
            } catch (dbError) {
                // Tables might not exist yet
                console.error('Database error loading sessions:', dbError);
                return Response.json({ sessions: [] });
            }
        }

        // Return messages for specific session
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
                messages: session.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    createdAt: m.createdAt,
                })),
            },
        });
    } catch (error) {
        console.error('Error in chat GET:', error);
        return Response.json({ error: 'Failed to load chat data', sessions: [] }, { status: 500 });
    }
}

// Create new chat session
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { title } = body;

        try {
            const session = await prisma.chatSession.create({
                data: {
                    title: title || null,
                },
            });

            return Response.json({ session });
        } catch (dbError) {
            // Table might not exist yet - return a temporary session
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
}

// Delete chat session
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

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
}
