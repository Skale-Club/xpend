'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

interface ChatInterfaceProps {
    onClose?: () => void;
}

export function ChatInterface({ onClose: _onClose }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const res = await fetch('/api/chat');
            if (!res.ok) {
                console.error('Failed to load sessions:', res.status);
                setSessions([]);
                return;
            }
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (err) {
            console.error('Failed to load sessions:', err);
            setSessions([]);
        }
    };

    const loadSession = async (id: string) => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/chat?sessionId=${id}`);
            const data = await res.json();

            if (data.session) {
                setSessionId(data.session.id);
                setMessages(data.session.messages.map((m: { id: string; role: string; content: string }) => ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })));
                setShowHistory(false);
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const startNewChat = async () => {
        try {
            const res = await fetch('/api/chat', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            setSessionId(data.session.id);
            setMessages([]);
            setShowHistory(false);
            setError(null);
        } catch (err) {
            console.error('Failed to create session:', err);
        }
    };

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/chat?sessionId=${id}`, { method: 'DELETE' });
            setSessions(sessions.filter(s => s.id !== id));
            if (sessionId === id) {
                setSessionId(null);
                setMessages([]);
            }
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    };

    const sendMessage = async (content: string) => {
        setError(null);

        // Create session if needed
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            try {
                const res = await fetch('/api/chat', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: content.slice(0, 50) }),
                });
                const data = await res.json();
                currentSessionId = data.session.id;
                setSessionId(currentSessionId);
            } catch {
                setError('Failed to create chat session');
                return;
            }
        }

        // Add user message
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        // Add placeholder for assistant response
        const assistantPlaceholder: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
        };
        setMessages(prev => [...prev, assistantPlaceholder]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    messages: [...messages, { role: 'user', content }].map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to get response');
            }

            const data = await res.json();
            const assistantText = typeof data.text === 'string' ? data.text : '';

            setMessages(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage.role === 'assistant') {
                    lastMessage.content = assistantText || 'No response generated.';
                }
                return updated;
            });

            // Refresh sessions list
            loadSessions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message');
            // Remove the placeholder
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    {showHistory ? (
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1 hover:bg-gray-100 rounded"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                    )}
                    <span className="font-medium text-gray-800">
                        {showHistory ? 'Chat History' : 'Financial Assistant'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {!showHistory && (
                        <button
                            onClick={startNewChat}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="New chat"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 hover:bg-gray-100 rounded ${showHistory ? 'bg-gray-100' : ''}`}
                        title="Chat history"
                    >
                        <MessageSquare className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {showHistory ? (
                <div className="flex-1 overflow-y-auto">
                    {sessions.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No previous conversations
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {sessions.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">
                                            {session.title}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(session.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => deleteSession(session.id, e)}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded"
                                    >
                                        <Trash2 className="w-4 h-4 text-gray-500" />
                                    </button>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && !isLoading && (
                            <div className="text-center text-gray-500 py-8">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">Hi! I can help you understand your spending.</p>
                                <p className="text-sm mt-2">Try asking:</p>
                                <ul className="text-sm mt-2 space-y-1">
                                    <li>&ldquo;How much did I spend this month?&rdquo;</li>
                                    <li>&ldquo;Show my top expense categories&rdquo;</li>
                                    <li>&ldquo;Find transactions from Amazon&rdquo;</li>
                                </ul>
                            </div>
                        )}

                        {messages.map((message, index) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                isLoading={isLoading && index === messages.length - 1 && message.role === 'assistant' && !message.content}
                            />
                        ))}

                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                                {error}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <ChatInput
                        onSend={sendMessage}
                        isLoading={isLoading}
                    />
                </>
            )}
        </div>
    );
}
