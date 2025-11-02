/**
 * Popup component for Silence Notes Chrome Extension
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import AuthButton from '../components/AuthButton';
import { AuthState } from '../types/auth';
import { AuthService } from '../services/auth';
import { PreferencesStorage } from '../utils/storage';
import { Note } from '../types';
import { ApiService } from '../utils/api';
import { NotificationContainer } from '../components/Notification';
import ErrorBoundary from '../components/ErrorBoundary';
import NoteEditor from '../components/NoteEditor';
import NoteView from '../components/NoteView';
import NoteList from '../components/NoteList';
import SearchBar from '../components/SearchBar';
import useNotes from '../hooks/useNotes';
import { useSync, useSyncStatus, useOfflineDetection } from '../hooks/useSync';
import { keyboardManager, SHORTCUTS } from '../utils/keyboard';
import { storageMigrationManager } from '../utils/storage-migration';
import './popup.css';

// Notification type for the popup
interface PopupNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

/**
 * Main popup component
 */
const Popup: React.FC = () => {
  // Auth state
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    tokens: null,
    isLoading: true,
    error: null
  });

  // UI state
  const [preferences, setPreferences] = useState({
    theme: 'light' as 'light' | 'dark',
    language: 'en'
  });

  // View state
  const [currentView, setCurrentView] = useState<'list' | 'editor' | 'view'>('list');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Notes hook
  const notesHook = useNotes({
    autoRefresh: false, // Disable auto-refresh for now to avoid conflicts
    initialLimit:20,
    preferLocal: true // Prioritize local storage for offline capability
  });

  // Sync hooks
  const syncHook = useSync({
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5 minutes
    conflictResolution: 'local',
    onSyncStart: () => {
      showSuccess('Sync started...');
    },
    onSyncComplete: (result) => {
      if (result.success) {
        showSuccess(`Sync complete: ${result.uploaded} uploaded, ${result.downloaded} downloaded`);
      } else {
        showError(`Sync failed: ${result.errors.join(', ')}`);
      }
    },
    onSyncError: (error) => {
      showError(`Sync error: ${error}`);
    },
    onConflict: (conflict) => {
      showWarning(`Sync conflict detected for note ${conflict.id}`);
    }
  });

  const syncStatus = useSyncStatus();
  const offlineDetection = useOfflineDetection();

  // Notifications state
  const [notifications, setNotifications] = useState<PopupNotification[]>([]);

  // Notification management
  const addNotification = useCallback((notification: Omit<PopupNotification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, ...notification }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showSuccess = useCallback((message: string) => {
    addNotification({ type: 'success', message });
  }, [addNotification]);

  const showError = useCallback((message: string) => {
    addNotification({ type: 'error', message, duration: 5000 });
  }, [addNotification]);

  const showWarning = useCallback((message: string) => {
    addNotification({ type: 'warning', message, duration: 3000 });
  }, [addNotification]);

  // Auth state management
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Initialize storage and run migrations if needed
        console.log('Initializing storage and checking migrations...');
        const needsMigration = await storageMigrationManager.needsMigration();

        if (needsMigration) {
          console.log('Running storage migrations...');
          showWarning('Updating data format...');
          await storageMigrationManager.migrate();
          showSuccess('Data updated successfully');
        }

        // Validate data integrity
        const validation = await storageMigrationManager.validateData();
        if (!validation.isValid) {
          console.error('Data validation failed:', validation.errors);
          showError('Data integrity issues detected. Some features may not work correctly.');
        }

        // Load user preferences
        const userPreferences = await PreferencesStorage.getPreferences();
        setPreferences({
          theme: userPreferences.theme,
          language: userPreferences.language
        });

        // Initialize auth state
        const authService = AuthService.getInstance();
        const state = await authService.initialize();
        setAuthState(state);

        // Setup keyboard shortcuts
        setupKeyboardShortcuts();

        console.log('Popup initialization complete');
      } catch (error) {
        console.error('Failed to initialize popup:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize'
        }));
        showError('Failed to initialize popup');
      }
    };

    initializePopup();
  }, []);

  const handleAuthStateChange = (newState: AuthState) => {
    setAuthState(newState);
    if (!newState.isAuthenticated) {
      // Clear notes when logging out
      notesHook.setNotes([]);
      setCurrentView('list');
      setSelectedNote(null);
    }
  };

  // Setup keyboard shortcuts
  const setupKeyboardShortcuts = () => {
    // New note shortcut
    keyboardManager.register({
      ...SHORTCUTS.NEW_NOTE,
      description: 'Create new note',
      action: () => {
        if (authState.isAuthenticated) {
          setSelectedNote(null);
          setCurrentView('editor');
        }
      }
    });

    // Search shortcut
    keyboardManager.register({
      ...SHORTCUTS.SEARCH,
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    });

    // Escape shortcut
    keyboardManager.register({
      ...SHORTCUTS.ESCAPE,
      description: 'Cancel/close current view',
      action: () => {
        if (currentView === 'editor') {
          if (selectedNote) {
            setCurrentView('view');
          } else {
            setCurrentView('list');
          }
        } else if (currentView === 'view') {
          setCurrentView('list');
        }
      }
    });

    // Save shortcut
    keyboardManager.register({
      ...SHORTCUTS.SAVE,
      description: 'Save note',
      action: () => {
        if (currentView === 'editor') {
          // This will be handled by the NoteEditor component
        }
      }
    });
  };

  // Note management
  const handleCreateNote = useCallback(async () => {
    setSelectedNote(null);
    setCurrentView('editor');
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setCurrentView('editor');
  }, []);

  const handleViewNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setCurrentView('view');
  }, []);

  const handleCloseNote = useCallback(() => {
    setSelectedNote(null);
    setCurrentView('list');
  }, []);

  const handleSaveNote = useCallback(async (noteData: { title?: string; content: string }) => {
    try {
      if (selectedNote) {
        // Update existing note
        const updatedNote = await ApiService.updateNote(selectedNote.id, {
          ...noteData,
          version: selectedNote.version
        });
        if (updatedNote.success && updatedNote.data) {
          setSelectedNote(updatedNote.data);
          showSuccess('Note updated successfully');
          notesHook.setNotes(notesHook.notes.map(n =>
            n.id === updatedNote.data!.id ? updatedNote.data! : n
          ));
        } else {
          showError(updatedNote.error || 'Failed to update note');
        }
      } else {
        // Create new note
        const newNote = await ApiService.createNote(noteData);
        if (newNote.success && newNote.data) {
          showSuccess('Note created successfully');
          notesHook.setNotes([newNote.data!, ...notesHook.notes]);
          setSelectedNote(newNote.data);
          setCurrentView('view');
        } else {
          showError(newNote.error || 'Failed to create note');
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save note');
    }
  }, [selectedNote, notesHook.notes, showSuccess, showError]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      const response = await ApiService.deleteNote(noteId);
      if (response.success) {
        showSuccess('Note deleted successfully');
        notesHook.setNotes(notesHook.notes.filter(n => n.id !== noteId));
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
          setCurrentView('list');
        }
      } else {
        showError(response.error || 'Failed to delete note');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete note');
    }
  }, [selectedNote, notesHook.notes, showSuccess, showError]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedTag(null);
    notesHook.searchNotes(query);
  }, [notesHook]);

  const handleTagFilter = useCallback((tag: string) => {
    setSelectedTag(tag);
    setSearchQuery('');
    notesHook.getNotesByTag(tag);
  }, [notesHook]);

  // Get current title based on view
  const getCurrentTitle = () => {
    switch (currentView) {
      case 'editor':
        return selectedNote ? 'Edit Note' : 'Create New Note';
      case 'view':
        return selectedNote?.title || 'Note';
      case 'list':
      default:
        return searchQuery
          ? `Search Results (${notesHook.total})`
          : selectedTag
            ? `Tag: ${selectedTag} (${notesHook.total})`
            : 'Recent Notes';
    }
  };

  const renderWelcomeScreen = () => (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">Silence Notes</h1>
        <p className="popup-subtitle">Brutalist note-taking</p>
      </header>

      <main className="popup-main">
        <div className="welcome-section">
          <div className="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h2 className="welcome-title">Welcome to Silence Notes</h2>
          <p className="welcome-description">
            Sign in to sync your notes across devices and unlock all features.
          </p>
        </div>

        <div className="auth-section">
          <AuthButton onAuthStateChange={handleAuthStateChange} />
        </div>

        <div className="features-section">
          <h3 className="features-title">Features</h3>
          <ul className="features-list">
            <li className="feature-item">
              <span className="feature-icon">#</span>
              <span className="feature-text">Hashtag organization</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">☁️</span>
              <span className="feature-text">Cloud synchronization</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Secure authentication</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Lightning fast</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="popup-footer">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="options-button"
        >
          Settings
        </button>
      </footer>
    </div>
  );

  const renderMainApp = () => (
    <ErrorBoundary>
      <div className={`popup-container ${preferences.theme}`}>
        <header className="popup-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="popup-title">Silence Notes</h1>
              <span className="header-subtitle">{getCurrentTitle()}</span>
            </div>
            <div className="header-right">
              <div className="user-info">
                {authState.user && (
                  <div className="user-avatar" title={authState.user.name}>
                    {authState.user.avatarUrl ? (
                      <img
                        src={authState.user.avatarUrl}
                        alt={authState.user.name}
                        className="avatar-img"
                      />
                    ) : (
                      <div className="avatar-fallback">
                        {authState.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => chrome.runtime.openOptionsPage()}
                className="options-btn"
                title="Settings"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="m12 1 1.27 2.22L16 2l.78 1.63L19 4l-.27 1.55L20 7l-1.27 1.27L20 10l-1.22.78L18 13l-1.63-.78L15 12l-1.55.27L12 11l-1.27-1.27L10 10l1.22-.78L12 7l1.63.78L15 8l1.55-.27L17 9l1.27 1.27L20 10l-.27 1.55L19 13l-1.22 1.22L16 16l-1.63-.78L13 15l-1.55.27L11 14l-1.27-1.27L9 12l1.22-.78L11 9l1.63.78L14 8l1.55-.27L16 7l1.27-1.27L18 4l-.78-1.63L16 2l-1.27 2.22L12 1z"></path>
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="popup-main">
          {currentView === 'list' && (
            <div className="list-view">
              <div className="list-header">
                <SearchBar
                  onSearch={handleSearch}
                  onTagFilter={handleTagFilter}
                  placeholder="Search notes..."
                  initialValue={searchQuery}
                />
                <div className="list-actions">
                  <button
                    onClick={handleCreateNote}
                    className="btn-primary create-btn"
                    title="Create new note (Ctrl+N)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Note
                  </button>
                </div>
              </div>

              <div className="notes-container">
                {notesHook.loading && notesHook.notes.length === 0 ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading notes...</p>
                  </div>
                ) : notesHook.notes.length === 0 && !searchQuery && !selectedTag ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <h3>No notes yet</h3>
                    <p>Create your first note to get started</p>
                    <button
                      onClick={handleCreateNote}
                      className="btn-primary"
                    >
                      Create Note
                    </button>
                  </div>
                ) : notesHook.notes.length === 0 && (searchQuery || selectedTag) ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                      </svg>
                    </div>
                    <h3>No notes found</h3>
                    <p>
                      {searchQuery
                        ? `No notes match "${searchQuery}"`
                        : `No notes tagged with ${selectedTag}`}
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedTag(null);
                        notesHook.loadNotes();
                      }}
                      className="btn-secondary"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <NoteList
                    notes={notesHook.notes}
                    selectedNoteId={selectedNote?.id}
                    onNoteSelect={handleViewNote}
                    onNoteEdit={handleEditNote}
                    onNoteDelete={handleDeleteNote}
                    loading={notesHook.loading}
                    hasMore={notesHook.hasMore}
                    onLoadMore={notesHook.loadMore}
                  />
                )}
              </div>

              {/* Quick actions */}
              <div className="quick-actions">
                <button
                  onClick={() => {
                    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
                    searchInput?.focus();
                  }}
                  className="action-btn"
                  title="Search (Ctrl+K)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </button>
                <button
                  onClick={handleCreateNote}
                  className="action-btn"
                  title="New Note (Ctrl+N)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement tags view
                    showWarning('Tags view coming soon!');
                  }}
                  className="action-btn"
                  title="Browse Tags"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {currentView === 'editor' && (
            <NoteEditor
              note={selectedNote}
              onSave={handleSaveNote}
              onCancel={handleCloseNote}
              loading={notesHook.loading}
              placeholder="Start typing your note..."
              autoFocus={true}
            />
          )}

          {currentView === 'view' && selectedNote && (
            <NoteView
              note={selectedNote}
              onEdit={() => handleEditNote(selectedNote)}
              onDelete={() => handleDeleteNote(selectedNote.id)}
              onClose={handleCloseNote}
            />
          )}
        </main>

        {/* Footer with auth status */}
        <footer className="popup-footer">
          <div className="footer-content">
            <div className="sync-status">
              <div className={`sync-indicator ${syncStatus.isSyncing ? 'syncing' : 'synced'} ${!syncStatus.isOnline ? 'offline' : ''}`} title={`Sync status: ${syncStatus.isOnline ? 'Online' : 'Offline'} | Last sync: ${syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}`}>
                <div className="sync-dot"></div>
                <span className="sync-text">
                  {syncStatus.isSyncing ? 'Syncing...' :
                   !syncStatus.isOnline ? 'Offline' :
                   syncStatus.pendingChanges > 0 ? `Pending (${syncStatus.pendingChanges})` :
                   'Synced'}
                </span>
              </div>
              <button
                onClick={() => syncHook.sync()}
                disabled={syncStatus.isSyncing || !syncStatus.isOnline}
                className="sync-btn"
                title={syncStatus.isOnline ? 'Manual sync' : 'Offline - sync unavailable'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
            </div>
            <AuthButton onAuthStateChange={handleAuthStateChange} />
          </div>
        </footer>

        {/* Notifications */}
        <NotificationContainer
          notifications={notifications}
          onRemove={removeNotification}
        />
      </div>
    </ErrorBoundary>
  );

  const renderLoadingScreen = () => (
    <div className="popup-container">
      <div className="loading-screen">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p className="loading-text">Loading Silence Notes...</p>
      </div>
    </div>
  );

  // Render loading screen
  if (authState.isLoading) {
    return renderLoadingScreen();
  }

  // Render main app if authenticated
  if (authState.isAuthenticated) {
    return renderMainApp();
  }

  // Render welcome screen if not authenticated
  return renderWelcomeScreen();
};

/**
 * Initialize popup
 */
const initializePopup = () => {
  const container = document.getElementById('popup-root');
  if (!container) {
    console.error('Popup root container not found');
    return;
  }

  const root = createRoot(container);
  root.render(<Popup />);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

export default Popup;