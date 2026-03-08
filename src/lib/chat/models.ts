export const GEMINI_CHAT_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
] as const;

export const DEFAULT_GEMINI_CHAT_MODEL = GEMINI_CHAT_MODELS[0].value;

export const GEMINI_CHAT_MODEL_VALUES = new Set<string>(
  GEMINI_CHAT_MODELS.map((model) => model.value)
);

export type GeminiChatModel = (typeof GEMINI_CHAT_MODELS)[number]['value'];
