import { describe, it, expect } from 'vitest';
import { normalizeChatModel, DEFAULT_CHAT_MODEL } from '@/lib/chat/models';

describe('normalizeChatModel', () => {
  it('returns the default for empty values', () => {
    expect(normalizeChatModel(null)).toBe(DEFAULT_CHAT_MODEL);
    expect(normalizeChatModel(undefined)).toBe(DEFAULT_CHAT_MODEL);
    expect(normalizeChatModel('  ')).toBe(DEFAULT_CHAT_MODEL);
  });

  it('keeps known OpenRouter ids as-is', () => {
    expect(normalizeChatModel('google/gemini-2.5-flash')).toBe('google/gemini-2.5-flash');
    expect(normalizeChatModel('openai/gpt-4o-mini')).toBe('openai/gpt-4o-mini');
  });

  it('prefixes legacy bare Gemini ids (pre-OpenRouter column default)', () => {
    expect(normalizeChatModel('gemini-2.5-flash')).toBe('google/gemini-2.5-flash');
    expect(normalizeChatModel('gemini-1.5-flash')).toBe('google/gemini-1.5-flash');
  });

  it('passes through unknown but provider-prefixed ids', () => {
    expect(normalizeChatModel('mistralai/mistral-large')).toBe('mistralai/mistral-large');
  });
});
