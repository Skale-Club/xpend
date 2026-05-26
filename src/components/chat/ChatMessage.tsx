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
          isUser ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div
        className={`flex-1 max-w-[80%] rounded-lg px-4 py-2 ${
          isUser ? 'bg-primary text-white' : 'bg-muted text-foreground'
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
              <div className="space-y-1 rounded-md border border-border/50 bg-card/70 p-2 text-xs text-muted-foreground">
                {tools.map((toolPart, index) => {
                  const state = 'state' in toolPart ? String(toolPart.state) : 'unknown';
                  return (
                    <div key={`${message.id}-tool-${index}`} className="flex items-center gap-2">
                      <Wrench className="h-3 w-3" />
                      <span className="font-medium">{toolPart.type.replace('tool-', '')}</span>
                      <span className="text-muted-foreground">({state})</span>
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