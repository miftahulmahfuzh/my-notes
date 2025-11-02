import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { authService, AuthState } from '../auth';
import { apiService, Note, NoteResponse, CreateNoteRequest, UpdateNoteRequest } from '../api';
import { LoginForm } from '../components/LoginForm';
import { SimpleUserProfile } from '../components/SimpleUserProfile';
import NoteView from '../components/NoteView';
import NoteEditor from '../components/NoteEditor';

// Styles
import './popup.css';

interface AppState {
  // Authentication and user state
  authState: AuthState;

  // Data state
  notes: NoteResponse[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Navigation state - existing views
  showCreateForm: boolean;
  showNotesList: boolean;

  // Navigation state - new detail and edit views
  currentNote: NoteResponse | null;   // Currently selected note for detail view (from API)
  showNoteDetail: boolean;            // Show full note detail view
  showNoteEditor: boolean;            // Show note editor for editing
  editingNote: NoteResponse | null;   // Note currently being edited (for editor component)

  // Form state for creating notes
  newNoteTitle: string;
  newNoteContent: string;
}

const PopupApp: React.FC = () => {
  const [state, setState] = useState<AppState>({
    // Authentication and user state
    authState: {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    },

    // Data state
    notes: [],

    // UI state
    isLoading: false,
    error: null,

    // Navigation state - existing views
    showCreateForm: false,
    showNotesList: false,

    // Navigation state - new detail and edit views
    currentNote: null,
    showNoteDetail: false,
    showNoteEditor: false,
    editingNote: null,

    // Form state for creating notes
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

  // ===== NAVIGATION FUNCTIONS FOR NOTE DETAIL AND EDIT VIEWS =====

  /**
   * Navigate to note detail view when a note is clicked
   * @param noteId - The ID of the note to view
   */
  const handleNoteClick = async (noteId: string): Promise<void> => {
    console.log('handleNoteClick called with noteId:', noteId);

    // Set loading state and navigate to detail view
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      showNotesList: false,
      showNoteDetail: true,
      currentNote: null // Clear previous note while loading
    }));

    try {
      // Fetch note details from API
      const response = await apiService.getNote(noteId);

      if (response.success && response.data) {
        // Successfully fetched note data
        setState(prev => ({
          ...prev,
          currentNote: response.data || null,
          isLoading: false,
          error: null
        }));
        console.log('Successfully loaded note:', response.data);
      } else {
        // API returned an error or no data
        const errorMessage = response.error || 'Note not found';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          showNoteDetail: false,
          showNotesList: true // Return to notes list on error
        }));
        console.error('Failed to load note:', errorMessage);
      }
    } catch (error) {
      // Network or unexpected error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        error: `Failed to load note: ${errorMessage}`,
        isLoading: false,
        showNoteDetail: false,
        showNotesList: true // Return to notes list on error
      }));
      console.error('Error loading note:', error);
    }
  };

  /**
   * Navigate to edit mode for a specific note
   * @param note - The note object to edit
   */
  const handleEditNote = (note: NoteResponse): void => {
    console.log('handleEditNote called with note:', note.id);
    setState(prev => ({
      ...prev,
      editingNote: note,
      showNoteDetail: false,
      showNoteEditor: true
    }));
  };

  /**
   * Handle note deletion with confirmation
   * @param noteId - The ID of the note to delete
   */
  const handleDeleteNote = async (noteId: string): Promise<void> => {
    console.log('handleDeleteNote called with noteId:', noteId);

    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return; // User cancelled the deletion
    }

    // Set loading state for deletion process
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      // Call API to delete the note
      const response = await apiService.deleteNote(noteId);

      if (response.success) {
        // Successfully deleted the note
        console.log('Successfully deleted note:', noteId);

        // Navigate back to notes list and refresh the list
        await loadNotes();

        setState(prev => ({
          ...prev,
          showNoteDetail: false,
          currentNote: null,
          isLoading: false,
          error: null
        }));
      } else {
        // API returned an error
        const errorMessage = response.error || 'Failed to delete note';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false
        }));
        console.error('Failed to delete note:', errorMessage);
      }
    } catch (error) {
      // Network or unexpected error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        error: `Failed to delete note: ${errorMessage}`,
        isLoading: false
      }));
      console.error('Error deleting note:', error);
    }
  };

  /**
   * Navigate back to the notes list from detail/edit views
   */
  const handleBackToNotes = (): void => {
    console.log('handleBackToNotes called');
    setState(prev => ({
      ...prev,
      showNoteDetail: false,
      showNoteEditor: false,
      currentNote: null,
      editingNote: null,
      showNotesList: true
    }));
  };

  /**
   * Update an existing note with new content
   * @param noteData - The updated note data
   */
  const updateNote = async (noteData: { title?: string; content: string }): Promise<void> => {
    console.log('updateNote called with:', noteData);

    // Validate input
    if (!noteData.content || noteData.content.trim().length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Note content cannot be empty',
        isLoading: false
      }));
      return;
    }

    if (!state.editingNote) {
      setState(prev => ({
        ...prev,
        error: 'No note is currently being edited',
        isLoading: false
      }));
      return;
    }

    // Set loading state
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      // Prepare update request with optimistic locking
      const updateRequest: UpdateNoteRequest = {
        title: noteData.title?.trim() || undefined,
        content: noteData.content.trim(),
        version: state.editingNote.version || 1
      };

      console.log('Sending update request:', updateRequest);

      // Call API to update the note
      const response = await apiService.updateNote(state.editingNote.id, updateRequest);

      if (response.success && response.data) {
        // Successfully updated the note
        console.log('Successfully updated note:', response.data);

        // Update both currentNote and editingNote with the updated data
        setState(prev => ({
          ...prev,
          currentNote: response.data || null,
          editingNote: null,
          showNoteEditor: false,
          showNoteDetail: true,
          isLoading: false,
          error: null
        }));

        // Refresh the notes list to show updated data
        await loadNotes();
      } else {
        // Handle API error
        const errorMessage = response.error || 'Failed to update note';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false
        }));
        console.error('Failed to update note:', errorMessage);
      }
    } catch (error) {
      // Handle network or unexpected error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        error: `Failed to update note: ${errorMessage}`,
        isLoading: false
      }));
      console.error('Error updating note:', error);
    }
  };

  // =============================================================

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
                <div
                  key={note.id}
                  className="note-item clickable"
                  onClick={() => handleNoteClick(note.id)}
                  title="Click to view full note"
                >
                  <div className="note-content-wrapper">
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
                      <span className="note-date">{formatDate(note.created_at)}</span>
                      <div className="note-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNote(note);
                          }}
                          className="mini-action-btn edit-mini-btn"
                          title="Edit note"
                          aria-label={`Edit note: ${note.title || 'Untitled Note'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          className="mini-action-btn delete-mini-btn"
                          title="Delete note"
                          aria-label={`Delete note: ${note.title || 'Untitled Note'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
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

    // ===== NEW NAVIGATION VIEWS - PLACEHOLDERS =====

    // Show note detail view
    if (state.showNoteDetail) {
      // Handle case where no note is loaded yet
      if (!state.currentNote) {
        return (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">Loading note...</p>
          </div>
        );
      }

      return (
        <div className="note-detail-view">
          <NoteView
            note={state.currentNote}
            onEdit={() => handleEditNote(state.currentNote!)}
            onDelete={() => handleDeleteNote(state.currentNote!.id)}
            onClose={handleBackToNotes}
          />
        </div>
      );
    }

    // Show note editor view
    if (state.showNoteEditor) {
      // Handle case where no note is being edited
      if (!state.editingNote) {
        return (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">Loading editor...</p>
          </div>
        );
      }

      return (
        <div className="note-editor-view">
          <NoteEditor
            note={state.editingNote}
            onSave={updateNote}
            onCancel={handleBackToNotes}
            loading={state.isLoading}
            autoFocus={true}
            placeholder="Start editing your note..."
          />
        </div>
      );
    }

    // ================================================

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