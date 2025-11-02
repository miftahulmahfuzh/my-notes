import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

interface VirtualizedNoteListProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
  onNoteEdit: (note: Note) => void;
  loading?: boolean;
  searchQuery?: string;
  selectedTag?: string;
}

// Virtual scrolling implementation for performance
const ITEM_HEIGHT = 120; // Height of each note item in pixels
const BUFFER_SIZE = 5; // Number of items to render outside visible area

const VirtualizedNoteList: React.FC<VirtualizedNoteListProps> = ({
  notes,
  onNoteClick,
  onNoteDelete,
  onNoteEdit,
  loading = false,
  searchQuery = '',
  selectedTag
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter notes based on search query and selected tag
  const filteredNotes = useMemo(() => {
    let filtered = notes;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(note =>
        note.tags?.includes(selectedTag)
      );
    }

    return filtered;
  }, [notes, searchQuery, selectedTag]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      filteredNotes.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, filteredNotes.length]);

  // Get visible notes
  const visibleNotes = useMemo(() => {
    return filteredNotes.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [filteredNotes, visibleRange]);

  // Handle scroll events with throttling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Memoized note item component
  const NoteItem = React.memo(({ note, index }: { note: Note; index: number }) => {
    const actualIndex = visibleRange.startIndex + index;
    const translateY = actualIndex * ITEM_HEIGHT;

    return (
      <div
        className="virtual-note-item"
        style={{
          position: 'absolute',
          top: `${translateY}px`,
          left: 0,
          right: 0,
          height: `${ITEM_HEIGHT}px`,
        }}
      >
        <div className="note-card">
          <div className="note-header">
            <h3 className="note-title">{note.title}</h3>
            <div className="note-actions">
              <button
                onClick={() => onNoteEdit(note)}
                className="note-action-btn edit-btn"
                title="Edit note"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                onClick={() => onNoteDelete(note.id)}
                className="note-action-btn delete-btn"
                title="Delete note"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <div className="note-content">
            <p>{note.content.length > 150 ? note.content.substring(0, 150) + '...' : note.content}</p>
          </div>

          <div className="note-footer">
            <div className="note-meta">
              <span className="note-date">
                {new Date(note.updated_at).toLocaleDateString()}
              </span>
              {note.tags && note.tags.length > 0 && (
                <div className="note-tags">
                  {note.tags.slice(0, 3).map((tag, tagIndex) => (
                    <span key={tagIndex} className="note-tag">#{tag}</span>
                  ))}
                  {note.tags.length > 3 && (
                    <span className="note-tag-more">+{note.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  // Loading state
  if (loading) {
    return (
      <div className="virtualized-list loading">
        <div className="loading-spinner"></div>
        <p>Loading notes...</p>
      </div>
    );
  }

  // Empty state
  if (filteredNotes.length === 0) {
    return (
      <div className="virtualized-list empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10,9 9,9 8,9"></polyline>
        </svg>
        <h3>No notes found</h3>
        <p>
          {searchQuery || selectedTag
            ? 'Try adjusting your search or filter'
            : 'Create your first note to get started'}
        </p>
      </div>
    );
  }

  return (
    <div className="virtualized-list-container">
      <div className="virtualized-list-info">
        <span>{filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}</span>
        {(searchQuery || selectedTag) && (
          <span className="filter-info">
            {searchQuery && `Search: "${searchQuery}"`}
            {searchQuery && selectedTag && ' • '}
            {selectedTag && `Tag: #${selectedTag}`}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="virtualized-list"
        onScroll={handleScroll}
        style={{ height: containerHeight }}
      >
        <div
          className="virtualized-list-content"
          style={{
            height: `${filteredNotes.length * ITEM_HEIGHT}px`,
            position: 'relative',
          }}
        >
          {visibleNotes.map((note, index) => (
            <NoteItem
              key={note.id}
              note={note}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

NoteItem.displayName = 'NoteItem';

export default React.memo(VirtualizedNoteList);