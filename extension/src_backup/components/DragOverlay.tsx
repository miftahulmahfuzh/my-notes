import React from 'react';
import { DragOverlay as DndDragOverlay } from '@dnd-kit/core';
import { Note } from '../types';

interface DragOverlayProps {
  activeId: string | null;
  activeNote?: Note;
  activeData?: any;
  multiDragIds?: string[];
  multiDragNotes?: Note[];
}

const DragOverlay: React.FC<DragOverlayProps> = ({
  activeId,
  activeNote,
  activeData,
  multiDragIds = [],
  multiDragNotes = []
}) => {
  const renderDragPreview = () => {
    // Handle multi-drag
    if (multiDragIds.length > 1) {
      return (
        <div className="multi-drag-preview">
          <div className="multi-drag-content">
            <div className="multi-drag-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>Dragging {multiDragIds.length} notes</span>
            </div>
            <div className="multi-drag-notes">
              {multiDragNotes.slice(0, 3).map((note, index) => (
                <div key={note.id} className="multi-drag-note">
                  {note.title || 'Untitled Note'}
                </div>
              ))}
              {multiDragNotes.length > 3 && (
                <div className="multi-drag-more">
                  +{multiDragNotes.length - 3} more notes
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Handle single drag
    if (!activeNote) {
      return null;
    }

    // Extract hashtags from content
    const extractHashtags = (content: string): string[] => {
      const hashtagRegex = /#\w+/g;
      const matches = content.match(hashtagRegex);
      return matches ? [...new Set(matches)] : [];
    };

    const hashtags = extractHashtags(activeNote.content);
    const hasContent = activeNote.content && activeNote.content.trim().length > 0;
    const preview = hasContent ? activeNote.content.substring(0, 80) + (activeNote.content.length > 80 ? '...' : '') : '';

    return (
      <div className="drag-preview">
        <div className="drag-preview-content">
          <div className="drag-preview-header">
            <h3 className="drag-preview-title">
              {activeNote.title || 'Untitled Note'}
            </h3>
            <div className="drag-preview-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="12" r="1"></circle>
                <circle cx="9" cy="5" r="1"></circle>
                <circle cx="9" cy="19" r="1"></circle>
                <circle cx="15" cy="12" r="1"></circle>
                <circle cx="15" cy="5" r="1"></circle>
                <circle cx="15" cy="19" r="1"></circle>
              </svg>
            </div>
          </div>

          {hasContent && (
            <div className="drag-preview-preview">
              {preview}
            </div>
          )}

          {/* Tags */}
          {hashtags.length > 0 && (
            <div className="drag-preview-tags">
              {hashtags.slice(0, 2).map((tag, index) => (
                <span key={index} className="drag-preview-tag">
                  {tag}
                </span>
              ))}
              {hashtags.length > 2 && (
                <span className="drag-preview-tag-more">
                  +{hashtags.length - 2}
                </span>
              )}
            </div>
          )}

          <div className="drag-preview-footer">
            <span className="drag-preview-date">
              {new Date(activeNote.updated_at).toLocaleDateString()}
            </span>
            <span className="drag-preview-size">
              {activeNote.content.length} characters
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DndDragOverlay
      dropAnimation={{
        duration: 250,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.01)',
      }}
    >
      {renderDragPreview()}
    </DndDragOverlay>
  );
};

export default DragOverlay;