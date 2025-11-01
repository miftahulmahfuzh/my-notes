import React, { useState } from 'react';
import { Note } from '../types';

interface NoteItemProps {
  note: Note;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({
  note,
  onSelect,
  onEdit,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Extract hashtags from content
  const extractHashtags = (content: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = content.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  // Format content with truncated view
  const formatContent = (content: string, maxLength: number = 200): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const hashtags = extractHashtags(note.content);
  const shouldShowExpandButton = note.content.length > 200;

  const handleMouseEnter = () => setShowActions(true);
  const handleMouseLeave = () => setShowActions(false);

  const handleClick = () => {
    if (onSelect) {
      onSelect();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className="note-item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="note-header">
        <h3 className="note-title" onClick={handleClick}>
          {note.title || 'Untitled Note'}
        </h3>
        <div className={`note-actions ${showActions ? 'visible' : ''}`}>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="note-action-btn edit-btn"
              title="Edit note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="note-action-btn delete-btn"
              title="Delete note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="note-content" onClick={handleClick}>
        <p className="note-text">
          {isExpanded ? note.content : formatContent(note.content)}
        </p>

        {shouldShowExpandButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="expand-btn"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {hashtags.length > 0 && (
        <div className="note-tags">
          {hashtags.map((tag, index) => (
            <span
              key={index}
              className="note-tag"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Handle tag filtering
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="note-meta">
        <span className="note-date" title={`Created: ${formatDate(note.created_at)} • Updated: ${formatDate(note.updated_at)}`}>
          {formatDate(note.updated_at)}
        </span>
        {note.version && note.version > 1 && (
          <span className="note-version" title={`Version ${note.version}`}>
            v{note.version}
          </span>
        )}
      </div>
    </div>
  );
};

export default NoteItem;