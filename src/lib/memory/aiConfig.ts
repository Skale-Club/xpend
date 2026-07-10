import { prisma } from '@/lib/db';
import { normalizeChatModel } from '@/lib/chat/models';

// Shared OpenRouter config for memory AI features. Mirrors how the chat route
// and goal planner read the key/model from Settings.
export async function getMemoryAiConfig(): Promise<{ apiKey: string | null; model: string | null }> {
  const settings = await prisma.settings.findUnique({
    where: { id: 'default' },
    select: { geminiApiKey: true, geminiChatModel: true },
  });
  return {
    apiKey: settings?.geminiApiKey || null,
    model: settings?.geminiChatModel ? normalizeChatModel(settings.geminiChatModel) : null,
  };
}

export interface TranscriptMessage {
  role: string;
  content: string;
}
