import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { ApiService } from '../utils/api';
import NoteItem from './NoteItem';
import Loading from './Loading';

interface NoteListProps {
  searchQuery?: string;
  selectedTag?: string;
  onNoteSelect?: (note: Note) => void;
  onNoteEdit?: (note: Note) => void;
  onNoteDelete?: (noteId: string) => void;
}

interface NoteListState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  page: number;
}

const NoteList: React.FC<NoteListProps> = ({
  searchQuery,
  selectedTag,
  onNoteSelect,
  onNoteEdit,
  onNoteDelete
}) => {
  const [state, setState] = useState<NoteListState>({
    notes: [],
    loading: true,
    error: null,
    hasMore: false,
    total: 0,
    page: 1
  });

  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const fetchNotes = async (reset: boolean = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let response;

      if (searchQuery) {
        // Search notes
        response = await ApiService.searchNotes({
          query: searchQuery,
          limit,
          offset: reset ? 0 : offset
        });
      } else if (selectedTag) {
        // Get notes by tag
        response = await ApiService.getNotesByTag(selectedTag, {
          limit,
          offset: reset ? 0 : offset
        });
      } else {
        // Get all notes
        response = await ApiService.getNotes({
          limit,
          offset: reset ? 0 : offset,
          orderBy: 'updated_at',
          orderDir: 'desc'
        });
      }

      if (response.success && response.data) {
        const newNotes = response.data.notes;
        setState(prev => ({
          notes: reset ? newNotes : [...prev.notes, ...newNotes],
          loading: false,
          error: null,
          hasMore: response.data!.hasMore,
          total: response.data!.total,
          page: reset ? 1 : prev.page + 1
        }));

        if (reset) {
          setOffset(0);
        } else {
          setOffset(prev => prev + limit);
        }
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: response.error || 'Failed to fetch notes'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }));
    }
  };

  useEffect(() => {
    fetchNotes(true);
  }, [searchQuery, selectedTag]);

  const handleLoadMore = () => {
    if (!state.loading && state.hasMore) {
      fetchNotes(false);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    try {
      const response = await ApiService.deleteNote(noteId);
      if (response.success) {
        setState(prev => ({
          ...prev,
          notes: prev.notes.filter(note => note.id !== noteId),
          total: prev.total - 1
        }));

        if (onNoteDelete) {
          onNoteDelete(noteId);
        }
      } else {
        alert(`Failed to delete note: ${response.error}`);
      }
    } catch (error) {
      alert(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = () => {
    fetchNotes(true);
  };

  if (state.loading && state.notes.length === 0) {
    return <Loading message="Loading notes..." />;
  }

  if (state.error && state.notes.length === 0) {
    return (
      <div className="notes-error">
        <div className="error-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <p className="error-message">{state.error}</p>
        <button
          onClick={handleRefresh}
          className="retry-btn"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.notes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <p className="empty-text">
          {searchQuery ? 'No notes found' : 'No notes yet'}
        </p>
        <p className="empty-subtext">
          {searchQuery
            ? 'Try a different search term'
            : 'Create your first note to get started'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="note-list">
      <div className="notes-header">
        <h3 className="notes-title">
          {searchQuery ? `Search Results (${state.total})` :
           selectedTag ? `Tag: ${selectedTag} (${state.total})` :
           `Recent Notes (${state.total})`}
        </h3>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          disabled={state.loading}
          title="Refresh notes"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>

      <div className="notes-container">
        {state.notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            onSelect={() => onNoteSelect && onNoteSelect(note)}
            onEdit={() => onNoteEdit && onNoteEdit(note)}
            onDelete={() => handleNoteDelete(note.id)}
          />
        ))}
      </div>

      {state.hasMore && (
        <div className="load-more">
          <button
            onClick={handleLoadMore}
            disabled={state.loading}
            className="load-more-btn"
          >
            {state.loading ? 'Loading...' : `Load More (${state.notes.length}/${state.total})`}
          </button>
        </div>
      )}

      {state.error && (
        <div className="load-error">
          <p>{state.error}</p>
          <button onClick={handleRefresh} className="retry-btn">Retry</button>
        </div>
      )}
    </div>
  );
};

export default NoteList;