'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { ChatInterface } from './ChatInterface';

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {isOpen ? (
                <div className="w-[380px] h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                    <ChatInterface onClose={() => setIsOpen(false)} />
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                    title="Open chat"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            )}
        </div>
    );
}
