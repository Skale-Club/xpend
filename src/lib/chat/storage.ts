import type { UIMessage } from 'ai';

const STORED_MESSAGE_VERSION = 'ui-parts-v1';

type StoredMessagePayload = {
  v: typeof STORED_MESSAGE_VERSION;
  parts: UIMessage['parts'];
};

type DatabaseMessage = {
  id: string;
  role: string;
  content: string;
};

function normalizeRole(role: string): UIMessage['role'] {
  if (role === 'system' || role === 'user' || role === 'assistant') {
    return role;
  }

  return 'assistant';
}

export function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      if (part.type === 'reasoning') {
        return part.text;
      }

      if (part.type.startsWith('tool-')) {
        const state = 'state' in part ? String(part.state) : 'unknown';
        return `[${part.type}:${state}]`;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function serializeMessage(message: Pick<UIMessage, 'parts'>): string {
  const payload: StoredMessagePayload = {
    v: STORED_MESSAGE_VERSION,
    parts: message.parts,
  };

  return JSON.stringify(payload);
}

export function deserializeParts(content: string): UIMessage['parts'] {
  try {
    const parsed = JSON.parse(content) as StoredMessagePayload;
    if (parsed?.v === STORED_MESSAGE_VERSION && Array.isArray(parsed.parts)) {
      return parsed.parts;
    }
  } catch {
    // Fall through to legacy parser.
  }

  const legacy = content.trim();
  if (!legacy) {
    return [];
  }

  return [{ type: 'text', text: legacy }];
}

export function dbMessageToUIMessage(message: DatabaseMessage): UIMessage {
  return {
    id: message.id,
    role: normalizeRole(message.role),
    parts: deserializeParts(message.content),
  };
}

export function previewFromStoredContent(content: string, maxLength = 50): string {
  const text = getTextFromParts(deserializeParts(content));
  if (!text) {
    return 'New Chat';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}