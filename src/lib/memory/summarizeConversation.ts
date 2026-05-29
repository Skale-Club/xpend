import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { DEFAULT_CHAT_MODEL } from '@/lib/chat/models';
import { getTextFromParts, deserializeParts } from '@/lib/chat/storage';
import type { TranscriptMessage } from './aiConfig';

export interface ConversationSummaryResult {
  title: string;
  summary: string;
  situation: string;
  decisions: string[];
  assumptions: string[];
  risks: string[];
  preferences: string[];
  nextSteps: string[];
  openQuestions: string[];
}

const summarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  situation: z.string(),
  decisions: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  preferences: z.array(z.string()),
  nextSteps: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

// Build a readable transcript from stored chat messages.
export function buildTranscript(messages: TranscriptMessage[]): string {
  return messages
    .map((m) => {
      const text = getTextFromParts(deserializeParts(m.content));
      if (!text) return '';
      const who = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
      return `${who}: ${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Summarize a financial chat conversation into a structured, AI-ready summary.
 * Grounded in the transcript only — it must not invent figures or decisions.
 */
export async function summarizeConversation(
  messages: TranscriptMessage[],
  apiKey: string,
  model?: string | null,
): Promise<ConversationSummaryResult> {
  const transcript = buildTranscript(messages);

  const openrouter = createOpenRouter({ apiKey });
  const languageModel = openrouter(model || DEFAULT_CHAT_MODEL);

  const prompt = `You are summarizing a financial planning conversation from the Xpend app into durable, structured memory.

Summarize ONLY what is supported by the transcript. Do not invent amounts, dates, decisions, or assumptions. If something was not discussed, return an empty list for it.

Separate clearly:
- decisions: concrete choices the user made.
- assumptions: values or conditions used in planning (e.g., estimated cost, target month) that are not yet confirmed facts.
- risks: financial risks or constraints raised.
- preferences: how the user likes plans to be shaped.
- nextSteps: open action items to follow up on.
- openQuestions: things still unresolved.

Write a short "title" (3-7 words) and a concise "summary" (2-4 sentences). "situation" should briefly describe the user's financial context as discussed.

TRANSCRIPT:
${transcript}`;

  const { object } = await generateObject({ model: languageModel, schema: summarySchema, prompt });
  return object;
}
