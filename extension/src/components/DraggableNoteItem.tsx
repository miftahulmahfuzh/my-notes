import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Note } from '../types';

interface DraggableNoteItemProps {
  note: Note;
  index: number;
  isSelected: boolean;
  onSelect: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onEdit: (note: Note) => void;
  onTagClick: (tag: string) => void;
  onDragStart?: (note: Note) => void;
  onDragEnd?: (note: Note) => void;
  multiSelectMode?: boolean;
  onMultiSelect?: (note: Note, selected: boolean) => void;
}

const DraggableNoteItem: React.FC<DraggableNoteItemProps> = ({
  note,
  index,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
  onTagClick,
  onDragStart,
  onDragEnd,
  multiSelectMode = false,
  onMultiSelect
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDndDragging,
    over,
  } = useSortable({
    id: note.id,
    data: {
      note,
      index
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDndDragging ? 0.5 : 1,
    zIndex: isDndDragging ? 1000 : 1,
  };

  const handleDragStart = () => {
    setIsDragging(true);
    onDragStart?.(note);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.(note);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (multiSelectMode && onMultiSelect) {
      onMultiSelect(note, !isSelected);
    } else {
      onSelect(note);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Show context menu
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    onTagClick(tag);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(note);
  };

  // Format timestamp for display
  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Extract hashtags from content
  const extractHashtags = (content: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = content.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  const hashtags = extractHashtags(note.content);
  const hasContent = note.content && note.content.trim().length > 0;
  const preview = hasContent ? note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '') : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-note-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-item-content">
        {/* Drag Handle */}
        <div
          ref={dragHandleRef}
          className="drag-handle"
          {...attributes}
          {...listeners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>

        {/* Note Content */}
        <div className="note-main">
          <div className="note-header">
            <h3 className="note-title">
              {note.title || 'Untitled Note'}
            </h3>
            <div className="note-actions">
              {(isHovered || isSelected) && (
                <>
                  <button
                    onClick={handleEdit}
                    className="note-action-btn edit-btn"
                    title="Edit note"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="note-action-btn delete-btn"
                    title="Delete note"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </>
              )}
              {multiSelectMode && (
                <div className="multi-select-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onMultiSelect?.(note, !isSelected)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          </div>

          {hasContent && (
            <div className="note-preview">
              {preview}
            </div>
          )}

          {/* Tags */}
          {hashtags.length > 0 && (
            <div className="note-tags">
              {hashtags.slice(0, 3).map((tag, index) => (
                <button
                  key={index}
                  onClick={(e) => handleTagClick(e, tag)}
                  className="note-tag"
                  title={`Filter by ${tag}`}
                >
                  {tag}
                </button>
              ))}
              {hashtags.length > 3 && (
                <span className="note-tag-more">
                  +{hashtags.length - 3} more
                </span>
              )}
            </div>
          )}

          <div className="note-footer">
            <span className="note-date" title={new Date(note.updated_at).toLocaleString()}>
              {formatDate(note.updated_at)}
            </span>
            <span className="note-size">
              {note.content.length} chars
            </span>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-ghost">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18m-9-9v18"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggableNoteItem;