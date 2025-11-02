import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { apiService, Note, CreateNoteRequest } from '../api';

// Styles
import './popup.css';

interface AppState {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  showCreateForm: boolean;
  showNotesList: boolean;
  newNoteTitle: string;
  newNoteContent: string;
}

const PopupApp: React.FC = () => {
  const [state, setState] = useState<AppState>({
    notes: [],
    isLoading: false,
    error: null,
    showCreateForm: false,
    showNotesList: false,
    newNoteTitle: '',
    newNoteContent: ''
  });

  // Load notes on component mount
  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const healthCheck = await apiService.healthCheck();
      if (!healthCheck.success) {
        setState(prev => ({
          ...prev,
          error: 'Backend not available. Please ensure the server is running.'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Cannot connect to backend. Please ensure the server is running on localhost:8080'
      }));
    }
  };

  const loadNotes = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiService.getNotes();

      if (response.success && response.data) {
        const notesData = response.data as any;
        setState(prev => ({
          ...prev,
          notes: notesData.notes || [],
          isLoading: false,
          showNotesList: true,
          showCreateForm: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to load notes',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load notes: ' + (error instanceof Error ? error.message : 'Unknown error'),
        isLoading: false
      }));
    }
  };

  const createNote = async (title: string, content: string) => {
    if (!content.trim()) {
      setState(prev => ({ ...prev, error: 'Note content cannot be empty' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const noteRequest: CreateNoteRequest = {
        title: title.trim() || undefined,
        content: content.trim()
      };

      const response = await apiService.createNote(noteRequest);

      if (response.success) {
        // Reset form and reload notes
        setState(prev => ({
          ...prev,
          newNoteTitle: '',
          newNoteContent: '',
          showCreateForm: false,
          isLoading: false
        }));

        // Load updated notes list
        await loadNotes();
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to create note',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to create note: ' + (error instanceof Error ? error.message : 'Unknown error'),
        isLoading: false
      }));
    }
  };

  const handleCreateNoteClick = () => {
    setState(prev => ({
      ...prev,
      showCreateForm: true,
      showNotesList: false,
      error: null
    }));
  };

  const handleViewAllNotesClick = async () => {
    await loadNotes();
  };

  const handleCancelCreate = () => {
    setState(prev => ({
      ...prev,
      showCreateForm: false,
      newNoteTitle: '',
      newNoteContent: '',
      error: null
    }));
  };

  const handleSaveNote = () => {
    createNote(state.newNoteTitle, state.newNoteContent);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const renderContent = () => {
    if (state.error) {
      return (
        <div className="error-message">
          <p>{state.error}</p>
          <button className="retry-btn" onClick={() => setState(prev => ({ ...prev, error: null }))}>
            Try Again
          </button>
        </div>
      );
    }

    if (state.isLoading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }

    if (state.showCreateForm) {
      return (
        <div className="note-creator">
          <h3>Create New Note</h3>

          <div className="form-group">
            <input
              type="text"
              placeholder="Note title (optional)"
              value={state.newNoteTitle}
              onChange={(e) => setState(prev => ({ ...prev, newNoteTitle: e.target.value }))}
              className="note-input"
              style={{ marginBottom: '12px' }}
            />
          </div>

          <div className="form-group">
            <textarea
              placeholder="Write your note here..."
              value={state.newNoteContent}
              onChange={(e) => setState(prev => ({ ...prev, newNoteContent: e.target.value }))}
              className="note-input"
              rows={8}
              autoFocus
            />
          </div>

          <div className="form-actions">
            <button
              onClick={handleCancelCreate}
              className="cancel-btn"
              disabled={state.isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              className="create-btn"
              disabled={state.isLoading || !state.newNoteContent.trim()}
            >
              {state.isLoading ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      );
    }

    if (state.showNotesList) {
      return (
        <div className="notes-list">
          <div className="notes-header">
            <h3>Your Notes ({state.notes.length})</h3>
            <button
              onClick={handleCreateNoteClick}
              className="create-btn"
            >
              + New Note
            </button>
          </div>

          {state.notes.length === 0 ? (
            <div className="empty-state">
              <p>No notes yet. Create your first note!</p>
              <button onClick={handleCreateNoteClick} className="create-btn">
                Create Note
              </button>
            </div>
          ) : (
            <div className="notes-container">
              {state.notes.map(note => (
                <div key={note.id} className="note-item">
                  <div className="note-header">
                    <h4 className="note-title">
                      {note.title || 'Untitled Note'}
                    </h4>
                  </div>
                  <div className="note-content">
                    <p>{note.content.length > 200
                      ? note.content.substring(0, 200) + '...'
                      : note.content}
                    </p>
                  </div>
                  <div className="note-meta">
                    <span className="note-date">{formatDate(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="quick-actions">
            <button
              onClick={handleCreateNoteClick}
              className="action-btn"
            >
              Create Note
            </button>
            <button
              onClick={() => setState(prev => ({ ...prev, showNotesList: false }))}
              className="action-btn"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    // Default view
    return (
      <div className="main">
        <div className="welcome-section">
          <h1>Silence Notes</h1>
          <p>Extension loaded successfully!</p>
          <p className="subtitle">Your brutalist note-taking companion</p>
        </div>

        <div className="quick-actions">
          <button
            onClick={handleCreateNoteClick}
            className="action-btn"
          >
            <span>📝</span>
            Create Note
          </button>
          <button
            onClick={handleViewAllNotesClick}
            className="action-btn"
          >
            <span>📚</span>
            View All Notes
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="popup-container">
      {renderContent()}
    </div>
  );
};

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<PopupApp />);
  }
});