'use client';

import { User, Bot, Loader2 } from 'lucide-react';

interface ChatMessageProps {
    message: { id: string; role: 'user' | 'assistant'; content: string };
    isLoading?: boolean;
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                    }`}
            >
                {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
                className={`flex-1 max-w-[80%] rounded-lg px-4 py-2 ${isUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                    }`}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                    </div>
                ) : (
                    <div className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                    </div>
                )}
            </div>
        </div>
    );
}
