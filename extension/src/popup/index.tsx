import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { authService, AuthState } from '../auth';
import { apiService, Note, NoteResponse, CreateNoteRequest, UpdateNoteRequest } from '../api';
import { CONFIG } from '../utils/config';
import { stripHashtags } from '../utils/contentUtils';
import { LoginForm } from '../components/LoginForm';
import { SimpleUserProfile } from '../components/SimpleUserProfile';

// Lazy load heavy components
const NoteView = lazy(() => import('../components/NoteView'));
const NoteEditor = lazy(() => import('../components/NoteEditor'));
import FileText from 'lucide-react/dist/esm/icons/file-text';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import X from 'lucide-react/dist/esm/icons/x';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Brain from 'lucide-react/dist/esm/icons/brain';

// Styles
import './popup.css';

// Navigation history state for Ctrl+B (back) functionality
interface HistoryState {
  view: 'notesList' | 'noteDetail' | 'noteEditor' | 'createForm' | 'welcome' | 'help';
  searchQuery?: string;
  noteId?: string;
  timestamp: number;
  // Form state preservation
  newNoteTitle?: string;
  newNoteContent?: string;
  editingNote?: NoteResponse | null;
}

interface AppState {
  // Authentication and user state
  authState: AuthState;

  // Data state
  notes: NoteResponse[];
  searchQuery: string;

  // Semantic search state
  semanticSearchEnabled: boolean;
  searchDuration: string | null;
  isSemanticSearching: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Navigation state - existing views
  showCreateForm: boolean;
  showNotesList: boolean;
  showHelpView: boolean;

  // Navigation state - new detail and edit views
  currentNote: NoteResponse | null;   // Currently selected note for detail view (from API)
  showNoteDetail: boolean;            // Show full note detail view
  showNoteEditor: boolean;            // Show note editor for editing
  editingNote: NoteResponse | null;   // Note currently being edited (for editor component)

  // Form state for creating notes
  newNoteTitle: string;
  newNoteContent: string;

  // Copy feedback state
  copiedNoteId: string | null;  // Track which note was last copied for visual feedback

  // Navigation history for Ctrl+B (back) functionality
  navigationHistory: HistoryState[];
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
    searchQuery: '',

    // Semantic search state
    semanticSearchEnabled: false,
    searchDuration: null,
    isSemanticSearching: false,

    // UI state
    isLoading: false,
    error: null,

    // Navigation state - existing views
    showCreateForm: false,
    showNotesList: false,
    showHelpView: false,

    // Navigation state - new detail and edit views
    currentNote: null,
    showNoteDetail: false,
    showNoteEditor: false,
    editingNote: null,

    // Form state for creating notes
    newNoteTitle: '',
    newNoteContent: '',

    // Copy feedback state
    copiedNoteId: null,

    // Navigation history for Ctrl+B (back) functionality
    navigationHistory: []
  });

  // Ref for search input (used by Ctrl+F to focus)
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Track when we need to focus search input (after navigation)
  const pendingSearchFocusRef = useRef(false);

  // Focus search input when navigating to notes list via keyboard shortcuts
  useEffect(() => {
    // Only attempt focus if we're on the notes list
    if (!state.showNotesList) {
      pendingSearchFocusRef.current = false;
      return;
    }

    // Focus the search input
    const focusSearchInput = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        pendingSearchFocusRef.current = false;
      } else {
        // Input not ready yet, try again after render
        setTimeout(focusSearchInput, 10);
      }
    };

    // Trigger focus attempt
    focusSearchInput();
  }, [state.showNotesList, state.semanticSearchEnabled]);

  // Load notes when navigating to notes list from a different page
  useEffect(() => {
    // Only load if we just navigated to notes list (from a different view)
    const hasOtherView = state.showNoteDetail || state.showNoteEditor || state.showHelpView || state.showCreateForm;
    if (state.showNotesList && !hasOtherView && state.authState.isAuthenticated) {
      loadNotes();
    }
  }, [state.showNotesList, state.showNoteDetail, state.showNoteEditor, state.showHelpView, state.showCreateForm, state.authState.isAuthenticated]);

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

  /**
   * Create a new note from NoteEditor (handles tag autocomplete enabled creation)
   * @param noteData - Note data from NoteEditor component
   */
  const handleCreateNote = async (noteData: { title?: string; content: string }): Promise<void> => {
    console.log('handleCreateNote called with:', noteData);

    // Validate input
    if (!noteData.content || noteData.content.trim().length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Note content cannot be empty',
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
      // Prepare create request
      const createRequest: CreateNoteRequest = {
        title: noteData.title?.trim() || undefined,
        content: noteData.content.trim()
      };

      console.log('Sending create request:', createRequest);

      // Call API to create the note
      const response = await apiService.createNote(createRequest);

      if (response.success && response.data) {
        // Successfully created the note
        console.log('Successfully created note:', response.data);

        // Update currentNote with the newly created note
        setState(prev => ({
          ...prev,
          currentNote: response.data || null,
          editingNote: null,
          showNoteEditor: false,
          isLoading: false,
          error: null
        }));

        // Refresh the notes list to show new note
        await loadNotes();

        // Set detail view state after loadNotes to show the new note
        setState(prev => ({
          ...prev,
          showNoteDetail: true,
          showNotesList: false
        }));
      } else {
        // Handle API error
        const errorMessage = response.error || 'Failed to create note';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false
        }));
        console.error('Failed to create note:', errorMessage);
      }
    } catch (error) {
      // Handle network or unexpected error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        error: `Failed to create note: ${errorMessage}`,
        isLoading: false
      }));
      console.error('Failed to create note:', error);
    }
  };

  const handleAuthSuccess = () => {
    // Auth state will be updated via subscription
    // Load notes after successful authentication
    loadNotes();
  };

  const handleLogout = async () => {
    // Actually call the auth service logout
    await authService.logout();

    // Then clear UI state
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
    setState(prev => {
      // If already in note editor, don't push to history
      if (prev.showNoteEditor) {
        return prev;
      }

      // Push current state to history before navigating
      const newHistoryEntry: HistoryState = {
        view: prev.showHelpView ? 'help' : (prev.showNotesList ? 'notesList' : 'welcome'),
        searchQuery: prev.searchQuery,
        timestamp: Date.now(),
        // Preserve form state when navigating away from editor
        newNoteTitle: prev.newNoteTitle,
        newNoteContent: prev.newNoteContent,
        editingNote: prev.editingNote
      };

      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
        editingNote: null,           // Clear editingNote for new note (no note = create mode)
        showNoteEditor: true,        // Use NoteEditor instead of showCreateForm
        showCreateForm: false,       // Deprecated - no longer used
        showNotesList: false,
        showHelpView: false,
        error: null
      };
    });
  };

  const handleViewAllNotesClick = async () => {
    // Push current state to history before navigating to notes list
    setState(prev => {
      // If already on notes list, don't push to history
      if (prev.showNotesList && !prev.searchQuery) {
        return prev;
      }

      const newHistoryEntry: HistoryState = {
        view: prev.showHelpView ? 'help' :
             prev.showNoteEditor ? 'noteEditor' :
             prev.showNoteDetail ? 'noteDetail' : 'welcome',
        searchQuery: prev.searchQuery,
        noteId: prev.currentNote?.id,
        timestamp: Date.now(),
        // Preserve form state
        newNoteTitle: prev.newNoteTitle,
        newNoteContent: prev.newNoteContent,
        editingNote: prev.editingNote
      };

      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
      };
    });

    await loadNotes();
  };

  const handleHelpClick = () => {
    setState(prev => {
      // Prevent duplicate Help entries
      if (prev.showHelpView) {
        return prev;
      }

      // Push current state to history before navigating to Help
      const newHistoryEntry: HistoryState = {
        view: prev.showNotesList ? 'notesList' :
             prev.showNoteEditor ? 'noteEditor' :
             prev.showNoteDetail ? 'noteDetail' : 'welcome',
        searchQuery: prev.searchQuery,
        noteId: prev.currentNote?.id,
        timestamp: Date.now(),
        // Preserve form state
        newNoteTitle: prev.newNoteTitle,
        newNoteContent: prev.newNoteContent,
        editingNote: prev.editingNote
      };

      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
        showHelpView: true,
        showNotesList: false,
        showNoteEditor: false,
        showNoteDetail: false,
        showCreateForm: false,
      };
    });
  };

  const handleBackFromHelp = () => {
    const history = state.navigationHistory;
    if (history.length === 0) {
      // If no history, just go back to welcome
      setState(prev => ({
        ...prev,
        showHelpView: false,
        showNotesList: false,
      }));
      return;
    }

    // Get the previous state from history
    const previousState = history[history.length - 1];

    // Remove it from history
    const newHistory = history.slice(0, -1);

    // Restore the previous state with form data
    setState(prev => ({
      ...prev,
      navigationHistory: newHistory,
      showHelpView: false,
      showNotesList: previousState.view === 'notesList',
      showNoteEditor: previousState.view === 'noteEditor',
      showNoteDetail: previousState.view === 'noteDetail',
      searchQuery: previousState.searchQuery || '',
      // Restore form state if available
      newNoteTitle: previousState.newNoteTitle ?? '',
      newNoteContent: previousState.newNoteContent ?? '',
      editingNote: previousState.editingNote ?? null,
      // Restore note detail if applicable
      currentNote: previousState.noteId
        ? prev.notes.find(n => n.id === previousState.noteId) || null
        : null
    }));
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

  const formatMemberSinceDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    // Add ordinal suffix to day
    const getOrdinalSuffix = (n: number) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${month} ${day}${getOrdinalSuffix(day)} ${year}`;
  };

  // ===== NAVIGATION FUNCTIONS FOR NOTE DETAIL AND EDIT VIEWS =====

  /**
   * Navigate to note detail view when a note is clicked
   * @param noteId - The ID of the note to view
   */
  const handleNoteClick = async (noteId: string): Promise<void> => {
    console.log('handleNoteClick called with noteId:', noteId);

    // Push current state to history before navigating
    setState(prev => {
      const newHistoryEntry: HistoryState = {
        view: prev.showNotesList ? 'notesList' : 'welcome',
        searchQuery: prev.searchQuery,
        timestamp: Date.now()
      };
      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
        isLoading: true,
        error: null,
        showNotesList: false,
        showNoteDetail: true,
        currentNote: null // Clear previous note while loading
      };
    });

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
    console.log('Note data:', JSON.stringify(note, null, 2));
    console.log('Current state before:', {
      showNoteDetail: state.showNoteDetail,
      showNoteEditor: state.showNoteEditor,
      editingNote: state.editingNote?.id
    });

    setState(prev => {
      console.log('Setting new state:', {
        editingNote: note.id,
        showNoteDetail: false,
        showNoteEditor: true
      });

      // Push current state to history before navigating
      const newHistoryEntry: HistoryState = {
        view: 'noteDetail',
        noteId: note.id,
        timestamp: Date.now()
      };

      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
        editingNote: note,
        showNoteDetail: false,
        showNoteEditor: true
      };
    });

    console.log('State updated successfully');
  };

  /**
   * Handle note deletion with confirmation
   * @param noteId - The ID of the note to delete
   */
  const handleDeleteNote = async (noteId: string): Promise<void> => {
    console.log('handleDeleteNote called with noteId:', noteId);

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
   * Copy note content to clipboard with visual feedback
   * @param content - The note content to copy
   * @param noteId - The ID of the note being copied (for feedback tracking)
   * @param event - The click event (to stop propagation)
   */
  const handleCopyNoteContent = async (content: string, noteId: string, event: React.MouseEvent): Promise<void> => {
    event.stopPropagation(); // Prevent triggering handleNoteClick

    try {
      await navigator.clipboard.writeText(stripHashtags(content));

      // Show visual feedback by setting the copied note ID
      setState(prev => ({ ...prev, copiedNoteId: noteId }));

      // Clear the feedback after 2 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, copiedNoteId: null }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy note content:', error);
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

  // =============================================

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
          isLoading: false,
          error: null
        }));

        // Refresh the notes list to show updated data
        await loadNotes();

        // Set detail view state after loadNotes to preserve it
        setState(prev => ({
          ...prev,
          showNoteDetail: true,
          showNotesList: false
        }));
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

  // ===== SEARCH HANDLERS =====

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setState(prev => ({ ...prev, searchQuery: query }));
  };

  const handleClearSearch = () => {
    setState(prev => ({ ...prev, searchQuery: '' }));
  };

  // Enable semantic search mode
  const enableSemanticSearch = () => {
    setState(prev => ({ ...prev, semanticSearchEnabled: true }));
  };

  // Enable keyword search mode
  const enableKeywordSearch = () => {
    setState(prev => ({ ...prev, semanticSearchEnabled: false }));
  };

  // Handle semantic search with debouncing
  useEffect(() => {
    if (!state.semanticSearchEnabled || !state.searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setState(prev => ({ ...prev, isSemanticSearching: true }));

        const response = await apiService.semanticSearch(state.searchQuery);

        if (response.success && response.data) {
          const notesData = response.data as any;
          setState(prev => ({
            ...prev,
            notes: notesData.notes || [],
            searchDuration: notesData.duration ? `Took ${notesData.duration.toFixed(2)}s` : null,
            isSemanticSearching: false,
          }));
        } else {
          // Show error but allow fallback
          setState(prev => ({
            ...prev,
            error: 'Semantic search unavailable. Try keyword search.',
            semanticSearchEnabled: false,
            isSemanticSearching: false,
          }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          error: `Search failed: ${errorMessage}`,
          semanticSearchEnabled: false,
          isSemanticSearching: false,
        }));
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [state.semanticSearchEnabled, state.searchQuery]);

  // Handle Ctrl+B - Navigate back in history
  const handleBack = (): void => {
    const history = state.navigationHistory;
    if (history.length === 0) return;

    // Get the previous state (last item in history)
    const previousState = history[history.length - 1];

    // Remove it from history
    const newHistory = history.slice(0, -1);

    // Restore the previous state
    setState(prev => ({
      ...prev,
      navigationHistory: newHistory,
      searchQuery: previousState.searchQuery || '',
      showNotesList: previousState.view === 'notesList',
      showNoteDetail: previousState.view === 'noteDetail',
      showNoteEditor: previousState.view === 'noteEditor',
      showCreateForm: previousState.view === 'createForm',
      showHelpView: previousState.view === 'help',
      currentNote: previousState.noteId ? prev.notes.find(n => n.id === previousState.noteId) || null : null,
      // Restore form state if available
      newNoteTitle: previousState.newNoteTitle ?? '',
      newNoteContent: previousState.newNoteContent ?? '',
      editingNote: previousState.editingNote ?? null,
    }));
  };

  /**
   * Navigate to notes list and enable search mode (keyword or semantic)
   * This is called by Ctrl+F and Ctrl+Shift+F global shortcuts
   * @param mode - 'keyword' for Ctrl+F, 'semantic' for Ctrl+Shift+F
   */
  const handleNavigateToSearch = (mode: 'keyword' | 'semantic'): void => {
    console.log('handleNavigateToSearch called with mode:', mode);

    setState(prev => {
      // If already on notes list, just update search mode
      if (prev.showNotesList) {
        return {
          ...prev,
          semanticSearchEnabled: mode === 'semantic'
        };
      }

      // Otherwise, navigate to notes list and preserve history
      const newHistoryEntry: HistoryState = {
        view: prev.showNoteEditor ? 'noteEditor' :
               prev.showNoteDetail ? 'noteDetail' :
               prev.showHelpView ? 'help' : 'welcome',
        searchQuery: prev.searchQuery,  // Preserve search query
        noteId: prev.currentNote?.id,
        timestamp: Date.now(),
        // Preserve form state when navigating from editor
        newNoteTitle: prev.newNoteTitle,
        newNoteContent: prev.newNoteContent,
        editingNote: prev.editingNote
      };

      return {
        ...prev,
        navigationHistory: [...prev.navigationHistory, newHistoryEntry],
        showNotesList: true,
        showNoteDetail: false,
        showNoteEditor: false,
        showHelpView: false,
        showCreateForm: false,
        semanticSearchEnabled: mode === 'semantic'
      };
    });
  };

  // Keyboard shortcut: Ctrl+C to clear search query
  useEffect(() => {
    if (!state.showNotesList) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+C or Command+C (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Only clear if there's an active search query
        if (state.searchQuery) {
          e.preventDefault(); // Prevent default copy behavior
          handleClearSearch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.showNotesList, state.searchQuery]);

  // Keyboard shortcuts: Ctrl+N, Ctrl+F, Ctrl+B (work on all pages including Help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl or Command (Mac) modifier
      if (!(e.ctrlKey || e.metaKey)) return;

      // Ctrl+N: Navigate to create note form (works everywhere including Help)
      if (e.key === 'n') {
        e.preventDefault();
        handleCreateNoteClick();
        return;
      }

      // Ctrl+Shift+F: Navigate to list and enable semantic search (works globally)
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleNavigateToSearch('semantic');
        return;
      }

      // Ctrl+F: Navigate to list and enable keyword search (works globally)
      if (e.key === 'f') {
        e.preventDefault();
        handleNavigateToSearch('keyword');
        return;
      }

      // Ctrl+H: Navigate to Help page (works everywhere)
      if (e.key === 'h') {
        e.preventDefault();
        handleHelpClick();
        return;
      }

      // Ctrl+B: Navigate back in history
      if (e.key === 'b') {
        e.preventDefault();
        if (state.showHelpView) {
          handleBackFromHelp();
        } else {
          handleBack();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.showNotesList, state.showCreateForm, state.showNoteDetail, state.showNoteEditor, state.showHelpView, state.navigationHistory]);

  const handleTagClick = (tag: string): void => {
    // Strip # prefix from tag to get search term
    const searchTerm = tag.startsWith('#') ? tag.substring(1) : tag;

    // Set search query and navigate back to notes list
    setState(prev => ({
      ...prev,
      searchQuery: searchTerm,
      showNotesList: true,
      showNoteDetail: false,
      currentNote: null
    }));
  };

  const handleNoteChange = (updatedNote: Note): void => {
    // Update the note in the notes array and currentNote state
    // NOTE: Don't call loadNotes() - it causes redirect to list view
    setState(prev => {
      // Create NoteResponse with required tags field
      const noteWithTags: NoteResponse = {
        ...updatedNote,
        tags: updatedNote.tags ?? []
      };

      // Update the note in the notes array
      const updatedNotes = prev.notes.map(note =>
        note.id === updatedNote.id ? noteWithTags : note
      );

      return {
        ...prev,
        notes: updatedNotes,
        currentNote: noteWithTags
      };
    });
  };

  // Filtered notes based on search query
  const filteredNotes = useMemo(() => {
    const query = state.searchQuery.toLowerCase().trim();

    if (!query) {
      return state.notes;
    }

    // In semantic mode, notes are already filtered by API
    if (state.semanticSearchEnabled) {
      return state.notes;
    }

    // Keyword mode: client-side filtering
    return state.notes.filter(note => {
      const searchableText = `${note.title || ''} ${note.content}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [state.notes, state.searchQuery, state.semanticSearchEnabled]);

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
                {getUserInitials(state.authState.user?.email || '', state.authState.user?.email || '')}
              </div>
              <div className="user-info">
                <div className="user-email">{state.authState.user?.email}</div>
                <div className="user-name">
                  {state.authState.user?.created_at && `Noting quietly since ${formatMemberSinceDate(state.authState.user.created_at)}`}
                </div>
              </div>
              <button className="btn-logout-icon" onClick={handleLogout} aria-label="Logout">
                <LogOut size={18} strokeWidth={2} />
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
          <div className="notes-search-header">
            <div className={`search-bar-container ${state.semanticSearchEnabled ? 'semantic-mode' : ''}`}>
              <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className={`search-input ${state.semanticSearchEnabled ? 'semantic-mode' : ''}`}
                placeholder="Search notes..."
                value={state.searchQuery}
                onChange={handleSearchChange}
              />
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, semanticSearchEnabled: !prev.semanticSearchEnabled }))}
              className={`btn-semantic-search ${state.semanticSearchEnabled ? 'active' : ''}`}
              aria-label="Toggle semantic search"
              title={state.semanticSearchEnabled ? "Disable semantic search" : "Enable semantic search"}
            >
              <Brain size={18} strokeWidth={2} />
            </button>
            {state.searchDuration && (
              <span className="search-duration">{state.searchDuration}</span>
            )}
            <button
              onClick={handleCreateNoteClick}
              className="btn-primary"
            >
              + New Note
            </button>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FileText size={48} strokeWidth={1.5} />
              </div>
              <h3 className="empty-title">{state.searchQuery ? 'No notes match your search' : 'No notes yet'}</h3>
              <p className="empty-text">{state.searchQuery ? 'Try a different search term' : 'Create your first note to get started!'}</p>
              {!state.searchQuery && (
                <button onClick={handleCreateNoteClick} className="btn-primary">
                  Create Note
                </button>
              )}
            </div>
          ) : (
            <div className="grid-cols-1">
              {filteredNotes.map(note => (
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
                          onClick={(e) => handleCopyNoteContent(note.content, note.id, e)}
                          className="mini-action-btn copy-mini-btn"
                          title="Copy content"
                          aria-label={`Copy content from: ${note.title || 'Untitled Note'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
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

          <div className="section section-with-top-margin">
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
          <Suspense fallback={
            <div className="loading-state">
              <div className="spinner"></div>
              <p className="loading-text">Loading note...</p>
            </div>
          }>
            <NoteView
              note={state.currentNote}
              onEdit={() => handleEditNote(state.currentNote!)}
              onDelete={() => handleDeleteNote(state.currentNote!.id)}
              onClose={handleBackToNotes}
              onTagClick={handleTagClick}
              onNoteChange={handleNoteChange}
            />
          </Suspense>
        </div>
      );
    }

    // Show note editor view
    if (state.showNoteEditor) {
      const isEditMode = !!state.editingNote; // true for edit, false for create

      return (
        <div className="note-editor-view">
          <Suspense fallback={
            <div className="loading-state">
              <div className="spinner"></div>
              <p className="loading-text">Loading editor...</p>
            </div>
          }>
            <NoteEditor
              note={state.editingNote ?? undefined} // undefined for create mode
              onSave={isEditMode ? updateNote : handleCreateNote}
              onCancel={handleBackToNotes}
              loading={state.isLoading}
              autoFocus={true}
              placeholder={isEditMode ? "Start editing your note..." : "Start typing your note..."}
            />
          </Suspense>
        </div>
      );
    }

    // Show Help view
    if (state.showHelpView) {
      return (
        <div className="main">
          <div className="header">
            <div className="header-content">
              <button className="btn-back-icon" onClick={handleBackFromHelp} aria-label="Back">
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <div className="header-title">Keyboard Shortcuts</div>
              <button className="btn-logout-icon" onClick={handleLogout} aria-label="Logout">
                <LogOut size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="content-section content-section--help">
            <p className="text-sm"><strong>Global Shortcuts</strong></p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>N</strong> New note</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>F</strong> Keyword search <span className="text-xs text-muted">(works everywhere)</span></p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>Shift</strong> + <strong>F</strong> Semantic search <span className="text-xs text-muted">(works everywhere)</span></p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>H</strong> Help</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>B</strong> Back</p>
            <hr className="help-separator" />
            <p className="text-sm"><strong>Search Modes</strong></p>
            <p className="text-sm"><strong>Ctrl+F:</strong> Keyword search (text matching in titles/content)</p>
            <p className="text-sm"><strong>Ctrl+Shift+F:</strong> Semantic search (LLM-powered understanding)</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>C</strong> Clear search <span className="text-xs text-muted">(list page only)</span></p>
            <hr className="help-separator" />
            <p className="text-sm"><strong>Note Editing Shortcuts</strong></p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>Z</strong> Undo changes</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>S</strong> Save note</p>
            <p className="text-sm"><strong>Tab</strong> Indent (2 spaces)</p>
            <hr className="help-separator" />
            <p className="text-sm"><strong>Tags Suggestion Shortcuts</strong></p>
            <p className="text-sm"><strong>#</strong> Show tags suggestion (during edit)</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>J</strong> Move down</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>K</strong> Move up</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>M</strong> Select tag</p>
            <hr className="help-separator" />
            <p className="text-sm"><strong>Note Detail Shortcuts</strong></p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>C</strong> Copy content</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>E</strong> Edit note</p>
            <p className="text-sm"><strong>Ctrl</strong> + <strong>P</strong> Prettify note</p>
            <p className="text-sm"><strong>Prettify:</strong> LLM-powered note improvements</p>
            <p className="text-sm">Click tag to filter notes</p>
          </div>
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
                {getUserInitials(state.authState.user?.email || '', state.authState.user?.email || '')}
              </div>
              <div className="user-info">
                <div className="user-email">{state.authState.user?.email}</div>
                <div className="user-name">
                  {state.authState.user?.created_at && `Noting quietly since ${formatMemberSinceDate(state.authState.user.created_at)}`}
                </div>
              </div>
            </div>
            <button className="btn-logout-icon" onClick={handleLogout} aria-label="Logout">
              <LogOut size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <h1 className="welcome-title font-display">Silence Notes</h1>
          <p className="welcome-subtitle">Welcome!</p>
          <p className="text-sm">Your brutalist note-taking companion</p>
        </div>

        <div className="action-grid">
          <div className="action-card" onClick={handleCreateNoteClick} role="button" tabIndex={0} aria-label="Create Note" title="New Note">
            <div className="action-icon">
              <FileText size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="action-card" onClick={handleViewAllNotesClick} role="button" tabIndex={0} aria-label="View All Notes" title="Show Notes">
            <div className="action-icon">
              <BookOpen size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="action-card" onClick={handleHelpClick} role="button" tabIndex={0} aria-label="Help" title="Help">
            <div className="action-icon">
              <HelpCircle size={20} strokeWidth={2} />
            </div>
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

export default PopupApp;

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<PopupApp />);
  }
});
