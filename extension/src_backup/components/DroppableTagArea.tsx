import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableTagAreaProps {
  tag: string;
  noteCount: number;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  children?: React.ReactNode;
}

const DroppableTagArea: React.FC<DroppableTagAreaProps> = ({
  tag,
  noteCount,
  isActive,
  onClick,
  onDelete,
  onEdit,
  children
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `tag-${tag}`,
    data: {
      tag,
      type: 'tag'
    }
  });

  const handleTagClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <div
      ref={setNodeRef}
      className={`droppable-tag-area ${isActive ? 'active' : ''} ${isOver ? 'drag-over' : ''}`}
      onClick={handleTagClick}
    >
      <div className="tag-content">
        <div className="tag-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
        </div>
        <div className="tag-info">
          <span className="tag-name">{tag}</span>
          <span className="tag-count">{noteCount} notes</span>
        </div>
        <div className="tag-actions">
          {children}
          {(onDelete || onEdit) && (
            <div className="tag-action-buttons">
              {onEdit && (
                <button
                  onClick={handleEditClick}
                  className="tag-action-btn edit-btn"
                  title="Edit tag"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="tag-action-btn delete-btn"
                  title="Delete tag"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drop indicator */}
      {isOver && (
        <div className="drop-indicator">
          <div className="drop-indicator-line"></div>
          <div className="drop-indicator-text">
            Drop to tag note with {tag}
          </div>
        </div>
      )}
    </div>
  );
};

export default DroppableTagArea;