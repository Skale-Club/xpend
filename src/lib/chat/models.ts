export const OPENROUTER_CHAT_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
] as const;

export const DEFAULT_CHAT_MODEL = OPENROUTER_CHAT_MODELS[0].value;

export const CHAT_MODEL_VALUES = new Set<string>(
  OPENROUTER_CHAT_MODELS.map((model) => model.value)
);

export type ChatModel = (typeof OPENROUTER_CHAT_MODELS)[number]['value'];

/**
 * Older deployments (and the Prisma column default) store bare Gemini ids like
 * "gemini-2.5-flash" from before the OpenRouter migration; OpenRouter requires
 * the provider prefix, so bare ids are mapped to `google/<id>`.
 */
export function normalizeChatModel(stored: string | null | undefined): string {
  const value = stored?.trim();
  if (!value) return DEFAULT_CHAT_MODEL;
  if (CHAT_MODEL_VALUES.has(value)) return value;
  if (!value.includes('/') && value.startsWith('gemini')) return `google/${value}`;
  return value;
}
