'use client';

import type { UIMessage } from 'ai';
import { Bot, Loader2, User, Wrench } from 'lucide-react';

interface ChatMessageProps {
  message: UIMessage;
  isLoading?: boolean;
}

function getTextParts(message: UIMessage): string {
  return message.parts
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      if (part.type === 'reasoning') {
        return part.text;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getToolParts(message: UIMessage) {
  return message.parts.filter((part) => part.type.startsWith('tool-'));
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const text = getTextParts(message);
  const tools = getToolParts(message);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div
        className={`flex-1 max-w-[80%] rounded-lg px-4 py-2 ${
          isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {text ? <div className="whitespace-pre-wrap break-words">{text}</div> : null}

            {tools.length > 0 ? (
              <div className="space-y-1 rounded-md border border-gray-300/50 bg-white/70 p-2 text-xs text-gray-700">
                {tools.map((toolPart, index) => {
                  const state = 'state' in toolPart ? String(toolPart.state) : 'unknown';
                  return (
                    <div key={`${message.id}-tool-${index}`} className="flex items-center gap-2">
                      <Wrench className="h-3 w-3" />
                      <span className="font-medium">{toolPart.type.replace('tool-', '')}</span>
                      <span className="text-gray-500">({state})</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}