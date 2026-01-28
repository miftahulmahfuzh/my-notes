import React, { useState, useEffect } from 'react';
import { Note, PrettifyResponse } from '../types';
import { apiService } from '../api';
import MarkdownPreview from './MarkdownPreviewLazy';
import { extractTOC, extractMetadata } from '../utils/markdown';
import { stripHashtags } from '../utils/contentUtils';

interface NoteViewProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  onNoteChange?: (updatedNote: Note) => void;
}

const NoteView: React.FC<NoteViewProps> = ({
  note,
  onEdit,
  onDelete,
  onClose,
  onTagClick,
  onNoteChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [toc, setToc] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>({} as Record<string, string>);
  const [isPrettifying, setIsPrettifying] = useState(false);
  const [prettifyError, setPrettifyError] = useState<string | null>(null);

  // Extract TOC and metadata from markdown content
  useEffect(() => {
    const extractedToc = extractTOC(note.content);
    const extractedMetadata = extractMetadata(note.content);
    setToc(extractedToc);
    setMetadata(extractedMetadata as Record<string, string>);
  }, [note.content]);

  // Check if note can be prettified
  const canPrettify = !note.ai_improved || note.prettified_at === undefined;

  // Count words excluding hashtags
  const getWordCountExcludingTags = (content: string): number => {
    const hashtagRegex = /#\w+/g;
    const contentWithoutTags = content.replace(hashtagRegex, '');
    const words = contentWithoutTags.trim().split(/\s+/);
    return words.filter(w => w.length > 0).length;
  };

  const wordCount = getWordCountExcludingTags(note.content);
  const hasEnoughContent = wordCount >= 5;

  // Set up keyboard shortcut for copy (Ctrl+C / Cmd+C) and prettify (Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopyContent();
      }
      // Check for Ctrl+P or Cmd+P for prettify
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        if (canPrettify && hasEnoughContent && !isPrettifying) {
          e.preventDefault();
          handlePrettify();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [note, canPrettify, hasEnoughContent, isPrettifying]);

  const handlePrettify = async () => {
    if (!canPrettify || !hasEnoughContent || isPrettifying) {
      return;
    }

    setIsPrettifying(true);
    setPrettifyError(null);

    try {
      const response = await apiService.prettifyNote(note.id);

      if (response.success && response.data) {
        // Notify parent of note change
        if (onNoteChange) {
          onNoteChange(response.data);
        }
      } else {
        setPrettifyError(response.error || 'Failed to prettify note');
      }
    } catch (error) {
      setPrettifyError(error instanceof Error ? error.message : 'Failed to prettify note');
    } finally {
      setIsPrettifying(false);
    }
  };

  // Extract hashtags from content
  const extractHashtags = (content: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = content.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  // Format content with proper line breaks
  const formatContent = (content: string): string => {
    return content.split('\n').map(line => line || '\u00A0').join('\n');
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get relative time
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const hashtags = extractHashtags(note.content);
  const shouldShowExpandButton = note.content.length > 500;
  const displayContent = isExpanded ? note.content : note.content.substring(0, 500) + (shouldShowExpandButton ? '...' : '');

  const handleDelete = () => {
    onDelete();
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(stripHashtags(note.content));
      // Show success feedback
      const button = document.getElementById('copy-btn');
      if (button) {
        button.classList.add('success');
        setTimeout(() => {
          button.classList.remove('success');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="note-view">
      <div className="note-view-header">
        <div className="note-view-actions">
          <button
            onClick={handlePrettify}
            disabled={!canPrettify || !hasEnoughContent || isPrettifying}
            className="action-btn prettify-btn"
            title={
              !hasEnoughContent
                ? 'Note too short (min 5 words)'
                : !canPrettify
                ? 'Already prettified. Edit to re-enable.'
                : 'Prettify with AI (Ctrl+P)'
            }
          >
            {isPrettifying ? (
              <span className="spinner"></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-4A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-4A2.5 2.5 0 0 0 14.5 2Z"/>
              </svg>
            )}
          </button>
          <button
            onClick={handleCopyContent}
            id="copy-btn"
            className="action-btn copy-btn"
            title="Copy content"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="action-btn edit-btn"
            title="Edit note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="action-btn delete-btn"
            title="Delete note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button
            onClick={onClose}
            className="action-btn close-btn"
            title="Close note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="note-view-title">
          <h2>{note.title || 'Untitled Note'}</h2>
          <div className="note-view-meta">
            <span className="note-date" title={formatDate(note.updated_at)}>
              Updated {getRelativeTime(note.updated_at)}
            </span>
            {note.version && note.version > 1 && (
              <span className="note-version" title={`Version ${note.version}`}>
                v{note.version}
              </span>
            )}
            {note.ai_improved && (
              <span className="ai-improved-badge" title="Improved by AI">
                Improved By AI
              </span>
            )}
          </div>
        </div>
      </div>

      {prettifyError && (
        <div className="prettify-error">
          {prettifyError}
          <button onClick={() => setPrettifyError(null)}>×</button>
        </div>
      )}

      <div className="note-view-content">
        {isExpanded ? (
          <MarkdownPreview
            html={note.content}
            toc={toc}
            metadata={metadata}
          />
        ) : (
          <div className="note-text">
            <MarkdownPreview
              html={displayContent}
              toc={[]}
              metadata={{}}
            />
          </div>
        )}

        {shouldShowExpandButton && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="expand-btn"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {hashtags.length > 0 && (
        <div className="note-view-tags">
          <h3 className="tags-title">Tags</h3>
          <div className="tags-list">
            {hashtags.map((tag, index) => (
              <span
                key={index}
                className="tag"
                onClick={() => {
                  if (onTagClick) {
                    onTagClick(tag);
                  } else {
                    console.log('Filter by tag:', tag);
                  }
                }}
                title={`Click to filter by ${tag}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="note-view-info">
        <div className="info-section">
          <h4>Created</h4>
          <p>{formatDate(note.created_at)}</p>
        </div>
        <div className="info-section">
          <h4>Last Updated</h4>
          <p>{formatDate(note.updated_at)}</p>
        </div>
      </div>
    </div>
  );
};

export default NoteView;
