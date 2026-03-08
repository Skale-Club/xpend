'use client';

import { useState, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
    const [input, setInput] = useState('');

    const handleSend = () => {
        const trimmed = input.trim();
        if (trimmed && !isLoading && !disabled) {
            onSend(trimmed);
            setInput('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex items-end gap-2 p-3 border-t border-gray-200 bg-white">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your spending..."
                disabled={disabled || isLoading}
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                style={{ minHeight: '38px', maxHeight: '120px' }}
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || disabled}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Send className="w-5 h-5" />
                )}
            </button>
        </div>
    );
}
