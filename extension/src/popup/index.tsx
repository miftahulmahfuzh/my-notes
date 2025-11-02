import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { authService, AuthState } from '../auth';
import { apiService, Note, CreateNoteRequest } from '../api';
import { LoginForm } from '../components/LoginForm';
import { SimpleUserProfile } from '../components/SimpleUserProfile';

// Styles
import './popup.css';

interface AppState {
  authState: AuthState;
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
    authState: {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    },
    notes: [],
    isLoading: false,
    error: null,
    showCreateForm: false,
    showNotesList: false,
    newNoteTitle: '',
    newNoteContent: ''
  });

  // Initialize auth on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const authState = await authService.initialize();
        setState(prev => ({ ...prev, authState }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize application'
        }));
      }
    };

    initializeApp();

    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((authState) => {
      setState(prev => ({ ...prev, authState }));
    });

    return unsubscribe;
  }, []);

  const loadNotes = async () => {
    if (!state.authState.isAuthenticated) return;

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

  const handleAuthSuccess = () => {
    // Auth state will be updated via subscription
    // Load notes after successful authentication
    loadNotes();
  };

  const handleLogout = () => {
    setState(prev => ({
      ...prev,
      showCreateForm: false,
      showNotesList: false,
      notes: [],
      newNoteTitle: '',
      newNoteContent: ''
    }));
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

  const handleSearchNotesClick = () => {
    // For now, this will just show all notes with a search focus
    // In the future, this could open a dedicated search interface
    setState(prev => ({ ...prev, showCreateForm: false }));
    loadNotes(); // Load notes and we can add search functionality later
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

  const getUserInitials = (name: string, email: string) => {
    if (name && name.length > 0) {
      return name.slice(0, 2).toUpperCase();
    }
    if (email && email.length > 0) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'ME';
  };

  const renderContent = () => {
    // Show loading state during initialization
    if (state.authState.isLoading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p className="loading-text">Initializing...</p>
        </div>
      );
    }

    // Show login form if not authenticated
    if (!state.authState.isAuthenticated) {
      return <LoginForm onAuthSuccess={handleAuthSuccess} />;
    }

    // Show error message
    if (state.error) {
      return (
        <div className="main-content">
          <div className="error-message">
            <p className="error-text">{state.error}</p>
            <button className="btn-primary" onClick={() => setState(prev => ({ ...prev, error: null }))}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Show loading state during API calls
    if (state.isLoading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      );
    }

    // Show create note form
    if (state.showCreateForm) {
      return (
        <div className="main-content">
          <div className="section">
            <div className="user-profile">
              <div className="user-avatar">
                {getUserInitials(state.authState.user?.name || '', state.authState.user?.email || '')}
              </div>
              <div className="user-info">
                <div className="user-name">{state.authState.user?.name}</div>
                <div className="user-email">{state.authState.user?.email}</div>
              </div>
              <button className="btn-tertiary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          <div className="section">
            <h2 className="text-h2 font-display">Create New Note</h2>
          </div>

          <div className="section">
            <div className="input-group">
              <label className="input-label" htmlFor="note-title">
                Note title (optional)
              </label>
              <input
                id="note-title"
                type="text"
                placeholder="Enter a title..."
                value={state.newNoteTitle}
                onChange={(e) => setState(prev => ({ ...prev, newNoteTitle: e.target.value }))}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="note-content">
                Content *
              </label>
              <textarea
                id="note-content"
                placeholder="Write your note here..."
                value={state.newNoteContent}
                onChange={(e) => setState(prev => ({ ...prev, newNoteContent: e.target.value }))}
                className="input-field textarea-field"
                rows={8}
                autoFocus
              />
            </div>
          </div>

          <div className="section">
            <div className="flex gap-3">
              <button
                onClick={handleCancelCreate}
                className="btn-secondary flex-1"
                disabled={state.isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="btn-primary flex-1"
                disabled={state.isLoading || !state.newNoteContent.trim()}
              >
                {state.isLoading ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Show notes list
    if (state.showNotesList) {
      return (
        <div className="notes-list">
          <div className="notes-header">
            <div className="flex items-center gap-3">
              <div className="user-profile">
                <div className="user-avatar">
                  {getUserInitials(state.authState.user?.name || '', state.authState.user?.email || '')}
                </div>
                <div className="user-info">
                  <div className="user-name">{state.authState.user?.name}</div>
                  <div className="user-email">{state.authState.user?.email}</div>
                </div>
              </div>
              <div>
                <h3 className="notes-title">Your Notes</h3>
                <div className="notes-count">{state.notes.length}</div>
              </div>
            </div>
            <button
              onClick={handleCreateNoteClick}
              className="btn-primary"
            >
              + New Note
            </button>
          </div>

          {state.notes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3 className="empty-title">No notes yet</h3>
              <p className="empty-text">Create your first note to get started!</p>
              <button onClick={handleCreateNoteClick} className="btn-primary">
                Create Note
              </button>
            </div>
          ) : (
            <div className="grid-cols-1">
              {state.notes.map(note => (
                <div key={note.id} className="note-item">
                  <div className="note-title">
                    {note.title || 'Untitled Note'}
                  </div>
                  <div className="note-content">
                    <p>{note.content.length > 200
                      ? note.content.substring(0, 200) + '...'
                      : note.content}
                    </p>
                  </div>
                  <div className="note-meta">
                    <span className="text-sm">{formatDate(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section">
            <div className="flex gap-3">
              <button
                onClick={handleCreateNoteClick}
                className="btn-secondary flex-1"
              >
                Create Note
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, showNotesList: false }))}
                className="btn-secondary flex-1"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default view (authenticated)
    return (
      <div className="main">
        <div className="header">
          <div className="header-content">
            <div className="user-profile">
              <div className="user-avatar">
                {getUserInitials(state.authState.user?.name || '', state.authState.user?.email || '')}
              </div>
              <div className="user-info">
                <div className="user-name">{state.authState.user?.name}</div>
                <div className="user-email">{state.authState.user?.email}</div>
              </div>
            </div>
            <button className="btn-tertiary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <h1 className="welcome-title font-display">Silence Notes</h1>
          <p className="welcome-subtitle">Welcome, {state.authState.user?.name?.split(' ')[0] || 'User'}!</p>
          <p className="text-sm">Your brutalist note-taking companion</p>
        </div>

        <div className="action-grid">
          <div className="action-card" onClick={handleCreateNoteClick}>
            <div className="action-icon">📝</div>
            <div className="action-title">Create Note</div>
          </div>
          <div className="action-card" onClick={handleViewAllNotesClick}>
            <div className="action-icon">📚</div>
            <div className="action-title">View All Notes</div>
          </div>
          <div className="action-card" onClick={handleSearchNotesClick}>
            <div className="action-icon">🔍</div>
            <div className="action-title">Search Notes</div>
          </div>
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