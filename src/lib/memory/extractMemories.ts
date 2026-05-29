import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { DEFAULT_CHAT_MODEL } from '@/lib/chat/models';
import { buildTranscript } from './summarizeConversation';
import type { TranscriptMessage } from './aiConfig';

export interface ExtractedMemory {
  memoryType: 'decision' | 'assumption' | 'plan' | 'risk' | 'preference' | 'next_step';
  title: string;
  content: string;
  confidence: number;
}

const extractionSchema = z.object({
  memories: z.array(
    z.object({
      memoryType: z.enum(['decision', 'assumption', 'plan', 'risk', 'preference', 'next_step']),
      title: z.string(),
      content: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * Extract candidate durable memories from a conversation. Returns proposals
 * (not persisted) that should land in the review queue. Only specific,
 * reusable, planning-relevant items should be returned — not chit-chat.
 */
export async function extractMemories(
  messages: TranscriptMessage[],
  apiKey: string,
  model?: string | null,
): Promise<ExtractedMemory[]> {
  const transcript = buildTranscript(messages);

  const openrouter = createOpenRouter({ apiKey });
  const languageModel = openrouter(model || DEFAULT_CHAT_MODEL);

  const prompt = `Extract durable financial memories from this Xpend conversation transcript.

Only extract memories that are:
- Specific and reusable for future planning.
- Clearly supported by the transcript (do not invent anything).

Memory types:
- decision: a concrete financial choice the user made.
- assumption: a value/condition used in planning, not yet a confirmed fact.
- plan: a saved plan or strategy discussed.
- risk: a financial risk or constraint.
- preference: how the user prefers plans to be shaped.
- next_step: an open action item to follow up on.

Do NOT extract:
- Vague or purely conversational statements.
- Temporary emotions with no planning relevance.

For each memory, give a short title, a clear content sentence, and a confidence from 0 to 1.
Return an empty array if nothing durable was discussed.

TRANSCRIPT:
${transcript}`;

  const { object } = await generateObject({ model: languageModel, schema: extractionSchema, prompt });
  return object.memories;
}
