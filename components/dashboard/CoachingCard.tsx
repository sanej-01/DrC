'use client';

/**
 * A single coaching suggestion with working resource actions:
 * - Text  → opens a popup with an authored summary + the source article
 *           (embedded when the site allows framing, always linkable)
 * - Voice → reads the summary aloud via the Web Speech API
 * - Video → opens a topic-targeted best-practice video search
 */

import { useEffect, useRef, useState } from 'react';
import { resolveCoachingResource } from '@/lib/coaching-resources';

export interface CoachingCardItem {
  pr_number: number;
  pr_title: string;
  headline: string;
  tag: string | null;
  body: string;
  dimension: string | null;
}

export default function CoachingCard({ item }: { item: CoachingCardItem }) {
  const resource = resolveCoachingResource({
    dimension: item.dimension,
    headline: item.headline,
    body: item.body,
  });

  const [showText, setShowText] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop any in-flight narration if the card unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${item.headline}. ${resource.summary}`);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const pillStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    color: 'var(--ink-2)',
  } as const;

  return (
    <>
      <div
        className="rounded-[12px] p-5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-lg flex-shrink-0">🤖</span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                {item.headline}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                PR #{item.pr_number} · {item.pr_title}
              </p>
            </div>
          </div>
          {item.tag && (
            <span
              className="text-[11px] font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sage-soft)', color: 'var(--sage-ink)' }}
            >
              {item.tag}
            </span>
          )}
        </div>

        <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
          {item.body}
        </p>

        <div
          className="flex flex-wrap items-center gap-2 mt-4 pt-4"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <button
            onClick={() => setShowText(true)}
            className="text-[12px] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            style={pillStyle}
            title={`Read: ${resource.title} (${resource.articleSource})`}
          >
            📄 Text
          </button>
          <button
            onClick={toggleVoice}
            className="text-[12px] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            style={
              speaking
                ? { background: 'var(--sage)', border: '1px solid var(--sage)', color: '#fff' }
                : pillStyle
            }
            title="Read the summary aloud"
          >
            {speaking ? '⏹ Stop' : '🔊 Voice'}
          </button>
          <button
            onClick={() => window.open(resource.video, '_blank', 'noopener,noreferrer')}
            className="text-[12px] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            style={pillStyle}
            title="Watch a best-practice video on this topic"
          >
            🎬 Video walkthrough
          </button>
          <span className="flex-1" />
          <button
            onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
            className="text-[13px] cursor-pointer"
            style={{ color: vote === 'up' ? 'var(--good)' : 'var(--ink-3)' }}
            title="Helpful"
          >
            👍 Helpful
          </button>
          <button
            onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
            className="text-[13px] cursor-pointer"
            style={{ color: vote === 'down' ? 'var(--bad)' : 'var(--ink-3)' }}
            title="Not helpful"
          >
            👎
          </button>
        </div>
      </div>

      {showText && (
        <ResourcePopup
          title={resource.title}
          summary={resource.summary}
          article={resource.article}
          articleSource={resource.articleSource}
          onClose={() => setShowText(false)}
        />
      )}
    </>
  );
}

function ResourcePopup({
  title,
  summary,
  article,
  articleSource,
  onClose,
}: {
  title: string;
  summary: string;
  article: string;
  articleSource: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while the popup is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(20,24,22,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[14px] overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
              {title}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Source: {articleSource}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] leading-none px-1 cursor-pointer flex-shrink-0"
            style={{ color: 'var(--ink-3)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {summary}
          </p>

          <a
            href={article}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-4"
            style={{ color: 'var(--sage-ink)' }}
          >
            Read the full article on {articleSource} ↗
          </a>

          {/* Best-effort inline embed — many reputable sources block
              framing, so the summary above and the link are always the
              primary content and this simply enriches when allowed. */}
          <div
            className="mt-4 rounded-[10px] overflow-hidden"
            style={{ border: '1px solid var(--line)', height: 320 }}
          >
            <iframe
              src={article}
              title={title}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--ink-3)' }}>
            If the preview stays blank, the source blocks embedding — use the link above to open it.
          </p>
        </div>
      </div>
    </div>
  );
}
