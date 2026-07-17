'use client';

/**
 * ManagerNoteEditor — Phase 6.3
 * Private manager note editor for developers
 * Only visible to managers, never to developers
 */

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface ManagerNote {
  id: string;
  content: string;
  updated_at: string;
  manager?: {
    display_name: string;
    email: string;
  };
}

interface ManagerNoteEditorProps {
  developerId: string;
  workspaceId: string;
  userRole?: string;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function ManagerNoteEditor({
  developerId,
  workspaceId,
  userRole,
}: ManagerNoteEditorProps) {
  const [note, setNote] = useState<ManagerNote | null>(null);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isManager = userRole === 'manager' || userRole === 'admin';

  // Fetch existing note
  useEffect(() => {
    const fetchNote = async () => {
      try {
        setLoading(true);
        const response = await authedFetch(
          `/api/manager/team/${developerId}/notes?workspace_id=${workspaceId}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch note');
        }

        const data = await response.json();
        setNote(data.note);
        setContent(data.note?.content || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [developerId, workspaceId]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Note cannot be empty');
      return;
    }

    if (content.length > 5000) {
      setError('Note cannot exceed 5000 characters');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await authedFetch(
        `/api/manager/team/${developerId}/notes?workspace_id=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save note');
      }

      const data = await response.json();
      setNote(data.note);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    if (!confirm('Delete this note? This cannot be undone.')) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await authedFetch(
        `/api/manager/team/${developerId}/notes?workspace_id=${workspaceId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNote(null);
      setContent('');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(note?.content || '');
    setIsEditing(false);
    setError(null);
  };

  if (!isManager) {
    return null; // Managers only
  }

  if (loading) {
    return (
      <div
        className="rounded-[14px] p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="animate-pulse h-32 rounded" style={{ background: 'var(--line)' }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-[14px] p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
          🔒 Private manager note
        </h2>
        {note && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-[13px] font-medium cursor-pointer"
            style={{ color: 'var(--sage-ink)' }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Display mode */}
      {!isEditing ? (
        <>
          {note ? (
            <div className="space-y-4">
              <div
                className="rounded-[10px] p-4"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <p className="whitespace-pre-wrap leading-relaxed text-[14px]" style={{ color: 'var(--ink)' }}>
                  {note.content}
                </p>
              </div>
              <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--ink-3)' }}>
                <span>
                  {note.manager ? (
                    <>
                      Updated by {note.manager.display_name} ·{' '}
                      {formatTimestamp(note.updated_at)}
                    </>
                  ) : (
                    <>Updated {formatTimestamp(note.updated_at)}</>
                  )}
                </span>
                <button
                  onClick={handleDelete}
                  className="font-medium cursor-pointer disabled:opacity-50"
                  style={{ color: 'var(--bad)' }}
                  disabled={isSaving}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="mb-4 text-[14px]" style={{ color: 'var(--ink-2)' }}>
                No private notes yet. Add one to track important observations.
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-[13px] font-medium rounded-[10px] border-0 cursor-pointer"
                style={{ background: 'var(--sage)', color: '#fff' }}
              >
                Add Note
              </button>
            </div>
          )}
        </>
      ) : (
        /* Edit mode */
        <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setError(null);
            }}
            placeholder="Add private observations, 1-on-1 notes, coaching reminders, etc..."
            className="w-full h-32 p-3 rounded-[10px] resize-none outline-none text-[14px]"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            maxLength={5000}
          />

          <div className="flex items-center justify-between">
            <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {content.length} / 5000 characters
            </div>
            {error && <div className="text-[12px]" style={{ color: 'var(--bad)' }}>{error}</div>}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-[13px] font-medium rounded-[10px] cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-[13px] font-medium rounded-[10px] border-0 cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--sage)', color: '#fff' }}
              disabled={isSaving || !content.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
