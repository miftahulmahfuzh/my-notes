import { useState, useEffect, useCallback } from 'react';
import { Note } from '../types';
import { ApiService } from '../utils/api';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { offlineDetector } from '../utils/offline';

interface UseNotesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialLimit?: number;
  preferLocal?: boolean; // If true, prioritize local storage over API
}

interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  page: number;

  // Actions
  fetchNotes: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  createNote: (note: { title?: string; content: string }) => Promise<Note | null>;
  updateNote: (id: string, updates: { title?: string; content?: string; version?: number }) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  searchNotes: (query: string, tags?: string[]) => Promise<void>;
  getNotesByTag: (tag: string) => Promise<void>;
  refresh: () => Promise<void>;

  // State setters
  setNotes: (notes: Note[]) => void;
  clearError: () => void;
}

const useNotes = (options: UseNotesOptions = {}): UseNotesReturn => {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    initialLimit = 20,
    preferLocal = true
  } = options;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [currentSearch, setCurrentSearch] = useState<{ query?: string; tags?: string[] }>({});

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load notes from local storage
  const loadLocalNotes = useCallback(async (searchQuery?: string, tags?: string[]): Promise<Note[]> => {
    try {
      const localNotes = await storageService.getNotes();
      let filteredNotes = localNotes;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredNotes = filteredNotes.filter(note =>
          note.title?.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
        );
      }

      // Apply tag filter
      if (tags && tags.length > 0) {
        filteredNotes = filteredNotes.filter(note => {
          const noteTags = note.content.match(/#\w+/g) || [];
          return tags.some(tag => noteTags.includes(tag));
        });
      }

      // Sort by updated_at (newest first)
      filteredNotes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return filteredNotes;
    } catch (error) {
      console.error('Failed to load local notes:', error);
      return [];
    }
  }, []);

  // Load notes from API
  const loadRemoteNotes = useCallback(async (
    searchQuery?: string,
    tags?: string[],
    pageToLoad: number = 1,
    limit: number = initialLimit
  ): Promise<{ notes: Note[]; hasMore: boolean; total: number }> => {
    try {
      const params: any = {
        limit,
        offset: (pageToLoad - 1) * limit
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (tags && tags.length > 0) {
        params.tags = tags.join(',');
      }

      const response = await ApiService.getNotes(params);

      if (response.success && response.data) {
        return {
          notes: response.data.notes || [],
          hasMore: response.data.hasMore || false,
          total: response.data.total || 0
        };
      } else {
        throw new Error(response.error || 'Failed to load remote notes');
      }
    } catch (error) {
      console.error('Failed to load remote notes:', error);
      throw error;
    }
  }, [initialLimit]);

  // Main fetch function
  const fetchNotes = useCallback(async (reset: boolean = false) => {
    if (loading) return;

    setLoading(true);
    clearError();

    try {
      let newNotes: Note[] = [];
      let newHasMore = false;
      let newTotal = 0;
      let newPage = reset ? 1 : page;

      if (preferLocal || !offlineDetector.isCurrentlyOnline()) {
        // Load from local storage
        newNotes = await loadLocalNotes(currentSearch.query, currentSearch.tags);
        newTotal = newNotes.length;
        newHasMore = false; // Local storage loads everything at once
      } else {
        // Load from API and update local storage
        const result = await loadRemoteNotes(
          currentSearch.query,
          currentSearch.tags,
          newPage,
          initialLimit
        );

        if (reset) {
          newNotes = result.notes;
          // Save to local storage
          await storageService.saveNotesBatch(result.notes);
        } else {
          newNotes = [...notes, ...result.notes];
          // Append to local storage
          await storageService.saveNotesBatch(result.notes);
        }

        newHasMore = result.hasMore;
        newTotal = result.total;
      }

      setNotes(newNotes);
      setHasMore(newHasMore);
      setTotal(newTotal);
      setPage(newPage);
      setOffset(reset ? 0 : offset + newNotes.length);

    } catch (error) {
      console.error('Failed to fetch notes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
      setError(errorMessage);

      // Fallback to local storage if API fails
      if (!preferLocal && offlineDetector.isCurrentlyOnline()) {
        try {
          const localNotes = await loadLocalNotes(currentSearch.query, currentSearch.tags);
          setNotes(localNotes);
          setTotal(localNotes.length);
          setHasMore(false);
        } catch (localError) {
          console.error('Failed to load local notes as fallback:', localError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [loading, currentSearch, page, offset, preferLocal, initialLimit, loadLocalNotes, loadRemoteNotes, notes, clearError]);

  // Load more notes
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setPage(prev => prev + 1);
    await fetchNotes(false);
  }, [hasMore, loading, fetchNotes]);

  // Create note
  const createNote = useCallback(async (noteData: { title?: string; content: string }): Promise<Note | null> => {
    try {
      const timestamp = new Date().toISOString();
      const newNote: Note = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: noteData.title || '',
        content: noteData.content,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        user_id: '' // Will be filled by sync service
      };

      // Save to local storage first
      const result = await storageService.saveNote(newNote);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save note locally');
      }

      // Update local state
      setNotes(prev => [newNote, ...prev]);
      setTotal(prev => prev + 1);

      // Try to sync with remote if online
      if (offlineDetector.isCurrentlyOnline()) {
        try {
          await syncService.syncNote(newNote.id);
        } catch (syncError) {
          console.warn('Failed to sync new note immediately:', syncError);
          // Don't throw here, the note will be synced later
        }
      }

      return newNote;

    } catch (error) {
      console.error('Failed to create note:', error);
      setError(error instanceof Error ? error.message : 'Failed to create note');
      return null;
    }
  }, []);

  // Update note
  const updateNote = useCallback(async (
    id: string,
    updates: { title?: string; content?: string; version?: number }
  ): Promise<Note | null> => {
    try {
      // Get existing note
      const existingNote = notes.find(note => note.id === id);
      if (!existingNote) {
        throw new Error('Note not found');
      }

      const updatedNote: Note = {
        ...existingNote,
        ...updates,
        updated_at: new Date().toISOString(),
        version: (updates.version || existingNote.version) + 1
      };

      // Save to local storage
      const result = await storageService.saveNote(updatedNote);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update note locally');
      }

      // Update local state
      setNotes(prev => prev.map(note => note.id === id ? updatedNote : note));

      // Try to sync with remote if online
      if (offlineDetector.isCurrentlyOnline()) {
        try {
          await syncService.syncNote(id);
        } catch (syncError) {
          console.warn('Failed to sync updated note immediately:', syncError);
          // Don't throw here, the note will be synced later
        }
      }

      return updatedNote;

    } catch (error) {
      console.error('Failed to update note:', error);
      setError(error instanceof Error ? error.message : 'Failed to update note');
      return null;
    }
  }, [notes]);

  // Delete note
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete from local storage
      const result = await storageService.deleteNote(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete note locally');
      }

      // Update local state
      setNotes(prev => prev.filter(note => note.id !== id));
      setTotal(prev => prev - 1);

      // Try to sync with remote if online
      if (offlineDetector.isCurrentlyOnline()) {
        try {
          await syncService.syncNote(id);
        } catch (syncError) {
          console.warn('Failed to sync note deletion immediately:', syncError);
          // Don't throw here, the deletion will be synced later
        }
      }

      return true;

    } catch (error) {
      console.error('Failed to delete note:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete note');
      return false;
    }
  }, []);

  // Search notes
  const searchNotes = useCallback(async (query: string, tags?: string[]) => {
    setCurrentSearch({ query, tags });
    setPage(1);
    setOffset(0);
    await fetchNotes(true);
  }, [fetchNotes]);

  // Get notes by tag
  const getNotesByTag = useCallback(async (tag: string) => {
    await searchNotes('', [tag]);
  }, [searchNotes]);

  // Refresh notes
  const refresh = useCallback(async () => {
    await fetchNotes(true);
  }, [fetchNotes]);

  // Manual set notes (for sync updates)
  const manualSetNotes = useCallback((newNotes: Note[]) => {
    setNotes(newNotes);
    setTotal(newNotes.length);
  }, []);

  // Initialize with local data
  useEffect(() => {
    const initialize = async () => {
      try {
        const localNotes = await loadLocalNotes();
        setNotes(localNotes);
        setTotal(localNotes.length);

        // If online and not preferring local, also fetch from API
        if (offlineDetector.isCurrentlyOnline() && !preferLocal) {
          await fetchNotes(true);
        }
      } catch (error) {
        console.error('Failed to initialize notes:', error);
        setError('Failed to initialize notes');
      }
    };

    initialize();
  }, [loadLocalNotes, preferLocal, fetchNotes]);

  // Auto refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (offlineDetector.isCurrentlyOnline() && !preferLocal) {
        fetchNotes(false);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, preferLocal, fetchNotes]);

  // Listen for sync events
  useEffect(() => {
    const handleSyncEvent = (event: any) => {
      if (event.type === 'sync_complete' && event.data.success) {
        // Reload notes from local storage after sync
        loadLocalNotes(currentSearch.query, currentSearch.tags).then(localNotes => {
          setNotes(localNotes);
          setTotal(localNotes.length);
        });
      }
    };

    syncService.addEventListener(handleSyncEvent);

    return () => {
      syncService.removeEventListener(handleSyncEvent);
    };
  }, [loadLocalNotes, currentSearch]);

  return {
    notes,
    loading,
    error,
    hasMore,
    total,
    page,
    fetchNotes,
    loadMore,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
    getNotesByTag,
    refresh,
    setNotes: manualSetNotes,
    clearError
  };
};

export default useNotes;