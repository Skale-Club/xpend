'use client';

import { DefaultChatTransport, type UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { ChevronLeft, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type SessionMessage = {
  id: string;
  role: UIMessage['role'];
  parts: UIMessage['parts'];
};

interface ChatInterfaceProps {
  onClose?: () => void;
}

function Conversation({
  sessionId,
  initialMessages,
  initialPrompt,
  onInitialPromptConsumed,
  onRefreshSessions,
  onError,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  initialPrompt: string | null;
  onInitialPromptConsumed: () => void;
  onRefreshSessions: () => void;
  onError: (message: string | null) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const {
    messages,
    sendMessage,
    status,
  } = useChat<UIMessage>({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages: currentMessages }) => {
        const lastMessage = currentMessages.at(-1);
        const isToolApprovalFlow =
          lastMessage?.role !== 'user' ||
          currentMessages.some((message) =>
            message.parts.some(
              (part) =>
                'state' in part &&
                (part.state === 'approval-responded' || part.state === 'output-denied')
            )
          );

        return {
          body: {
            id,
            ...(isToolApprovalFlow
              ? { messages: currentMessages }
              : { message: lastMessage }),
          },
        };
      },
    }),
    onFinish: () => {
      onRefreshSessions();
      onError(null);
    },
    onError: (error) => {
      onError(error?.message || 'Failed to send message');
    },
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!initialPrompt) {
      return;
    }

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: initialPrompt }],
    });

    onInitialPromptConsumed();
  }, [initialPrompt, onInitialPromptConsumed, sendMessage]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSend = (content: string) => {
    onError(null);
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: content }],
    });
  };

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !isLoading ? (
          <div className="py-8 text-center text-gray-500">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="font-medium">Hi! I can help you understand your spending.</p>
            <p className="mt-2 text-sm">Try asking:</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>&ldquo;How much did I spend this month?&rdquo;</li>
              <li>&ldquo;Show my top expense categories&rdquo;</li>
              <li>&ldquo;Find transactions from Amazon&rdquo;</li>
            </ul>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isAssistant = message.role === 'assistant';
          const isLast = index === messages.length - 1;
          const hasTextPart = message.parts.some((part) => part.type === 'text' && part.text.trim());

          return (
            <ChatMessage
              key={message.id}
              message={message}
              isLoading={isLoading && isLast && isAssistant && !hasTextPart}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </>
  );
}

export function ChatInterface({ onClose }: ChatInterfaceProps) {
  void onClose;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [conversationSeed, setConversationSeed] = useState(0);

  const conversationKey = useMemo(
    () => `${activeSessionId || 'empty'}-${conversationSeed}`,
    [activeSessionId, conversationSeed]
  );

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/history?limit=20');
      if (!res.ok) {
        setSessions([]);
        return;
      }

      const data = await res.json();
      const chats = Array.isArray(data.chats) ? data.chats : [];
      setSessions(
        chats.map((chat: { id: string; title?: string; createdAt: string; updatedAt?: string }) => ({
          id: String(chat.id),
          title: chat.title || 'New Chat',
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt || chat.createdAt,
        }))
      );
    } catch (loadError) {
      console.error('Failed to load sessions:', loadError);
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async (title?: string): Promise<string> => {
    const res = await fetch('/api/chat', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || null }),
    });

    if (!res.ok) {
      throw new Error('Failed to create session');
    }

    const data = await res.json();
    if (!data?.session?.id) {
      throw new Error('Failed to create session');
    }

    const sessionId = String(data.session.id);
    setActiveSessionId(sessionId);
    setInitialMessages([]);
    setConversationSeed((current) => current + 1);
    setShowHistory(false);
    return sessionId;
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      setIsLoadingSession(true);
      const res = await fetch(`/api/chat?sessionId=${id}`);
      const data = await res.json();

      if (!res.ok || !data?.session) {
        throw new Error(data?.error || 'Failed to load session');
      }

      const parsedMessages: UIMessage[] = (Array.isArray(data.session.messages)
        ? data.session.messages
        : []
      ).map((message: SessionMessage) => ({
        id: String(message.id),
        role: message.role,
        parts: Array.isArray(message.parts) ? message.parts : [],
      }));

      setActiveSessionId(id);
      setInitialMessages(parsedMessages);
      setConversationSeed((current) => current + 1);
      setShowHistory(false);
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load session';
      setError(message);
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      try {
        await fetch(`/api/chat?sessionId=${id}`, { method: 'DELETE' });
        setSessions((previous) => previous.filter((session) => session.id !== id));

        if (activeSessionId === id) {
          setActiveSessionId(null);
          setInitialMessages([]);
          setConversationSeed((current) => current + 1);
        }
      } catch (deleteError) {
        console.error('Failed to delete session:', deleteError);
      }
    },
    [activeSessionId]
  );

  const handleSendWithoutSession = async (content: string) => {
    try {
      setError(null);
      const newId = await createSession(content.slice(0, 50));
      setPendingInitialPrompt(content);
      setActiveSessionId(newId);
      await loadSessions();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Failed to create chat session';
      setError(message);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          {showHistory ? (
            <button
              onClick={() => setShowHistory(false)}
              className="rounded p-1 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <MessageSquare className="h-5 w-5 text-blue-500" />
          )}

          <span className="font-medium text-gray-800">
            {showHistory ? 'Chat History' : 'Financial Assistant'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!showHistory ? (
            <button
              onClick={async () => {
                setError(null);
                try {
                  await createSession();
                  await loadSessions();
                } catch (createError) {
                  const message =
                    createError instanceof Error ? createError.message : 'Failed to create chat session';
                  setError(message);
                }
              }}
              className="rounded p-2 hover:bg-gray-100"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}

          <button
            onClick={() => setShowHistory((previous) => !previous)}
            className={`rounded p-2 hover:bg-gray-100 ${showHistory ? 'bg-gray-100' : ''}`}
            title="Chat history"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No previous conversations</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className="group flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-800">{session.title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="rounded p-1 opacity-0 hover:bg-gray-200 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-gray-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : activeSessionId ? (
        <Conversation
          key={conversationKey}
          sessionId={activeSessionId}
          initialMessages={initialMessages}
          initialPrompt={pendingInitialPrompt}
          onInitialPromptConsumed={() => setPendingInitialPrompt(null)}
          onRefreshSessions={loadSessions}
          onError={setError}
        />
      ) : (
        <>
          <div className="flex-1 p-4">
            <div className="py-8 text-center text-gray-500">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium">Start a new conversation</p>
              <p className="mt-2 text-sm">Send a message and I will create a new chat session.</p>
            </div>
          </div>
          <ChatInput onSend={handleSendWithoutSession} isLoading={isLoadingSession} />
        </>
      )}

      {error ? (
        <div className="border-t border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  );
}
