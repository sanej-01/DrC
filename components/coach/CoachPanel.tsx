'use client';

/**
 * CoachPanel — Phase 8.1
 * Live "Ask Dr. Codium" chat interface for coaching queries
 */

import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface CoachMessage {
  id: string;
  question: string;
  response?: string;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  latency_ms?: number;
  model_name?: string;
}

interface CoachPanelProps {
  workspaceId: string;
  developerId: string;
  compact?: boolean; // Compact mode for cards, full mode for dedicated page
}

export default function CoachPanel({
  workspaceId,
  developerId,
  compact = false,
}: CoachPanelProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const response = await authedFetch(
          `/api/coach/query?workspaceId=${workspaceId}&developerId=${developerId}`
        );

        if (response.ok) {
          const data = await response.json();
          setMessages(data.questions || []);
        }
      } catch (err) {
        console.error('Failed to load coaching history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [workspaceId, developerId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    setError(null);
    setLoading(true);

    // Add optimistic message
    const tempId = Date.now().toString();
    const newMessage: CoachMessage = {
      id: tempId,
      question: input,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    setMessages([...messages, newMessage]);
    setInput('');

    try {
      const response = await authedFetch('/api/coach/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          subjectDeveloperId: developerId,
          question: input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get coaching response');
      }

      const data = await response.json();

      // Replace optimistic message with real response
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.question : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');

      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    // Compact mode: mini chat widget
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">💬 Ask Dr. Codium</h3>

        {historyLoading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-600 mb-3">
            No questions yet. Ask about your performance!
          </div>
        ) : (
          <div className="bg-gray-50 rounded p-3 mb-3 max-h-32 overflow-y-auto">
            {messages.slice(-2).map((msg) => (
              <div key={msg.id} className="mb-2 last:mb-0">
                <p className="text-xs font-semibold text-gray-900">Q: {msg.question.substring(0, 50)}...</p>
                {msg.response && (
                  <p className="text-xs text-gray-700 mt-1">
                    A: {msg.response.substring(0, 50)}...
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            maxLength={100}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    );
  }

  // Full mode: dedicated coaching page
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💬 Ask Dr. Codium</h1>
        <p className="text-gray-600">
          Get personalized coaching on your code performance. Ask about your
          scores, feedback, and growth areas.
        </p>
      </div>

      {/* Chat area */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-96 flex flex-col">
        <div className="flex-1 space-y-4 mb-6 overflow-y-auto max-h-96">
          {historyLoading ? (
            <div className="text-center text-gray-600">Loading chat history...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-600 py-12">
              <p className="text-lg">No questions yet</p>
              <p className="text-sm mt-2">Ask Dr. Codium anything about your performance!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {/* Question */}
                <div className="flex gap-3">
                  <div className="text-2xl">👤</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">You</p>
                    <p className="text-sm text-gray-700 bg-blue-50 rounded p-2 mt-1">
                      {msg.question}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Response */}
                {msg.status === 'pending' && (
                  <div className="flex gap-3">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Dr. Codium</p>
                      <p className="text-sm text-gray-600 italic">Thinking...</p>
                    </div>
                  </div>
                )}

                {msg.status === 'completed' && msg.response && (
                  <div className="flex gap-3">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Dr. Codium</p>
                      <p className="text-sm text-gray-700 bg-amber-50 rounded p-2 mt-1 whitespace-pre-wrap">
                        {msg.response}
                      </p>
                      {msg.latency_ms && (
                        <p className="text-xs text-gray-500 mt-1">
                          {msg.model_name} • {msg.latency_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {msg.status === 'failed' && (
                  <div className="flex gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Error</p>
                      <p className="text-sm text-red-700">{msg.error_message}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your performance, feedback, or growth areas..."
              disabled={loading}
              maxLength={1000}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {input.length}/1000 characters
          </p>
        </form>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for better questions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Ask about specific dimensions: "How can I improve test coverage?"</li>
          <li>• Reference your feedback: "What does 'low architecture' mean?"</li>
          <li>• Ask for patterns: "What testing patterns would help my score?"</li>
        </ul>
      </div>
    </div>
  );
}
