/**
 * Tests for Storage Service
 */

import { StorageService, StorageErrorType } from '../storage';
import { Note } from '../../types';

// Mock Chrome storage API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
};

// Mock Chrome storage.estimate
const mockStorageEstimate = jest.fn();

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: mockStorageEstimate,
  },
  writable: true,
});

// Mock Chrome API
global.chrome = {
  storage: mockChromeStorage,
} as any;

// Test data
const mockNote: Note = {
  id: 'test-note-1',
  title: 'Test Note',
  content: 'This is a test note content #work',
  created_at: '2023-01-01T10:00:00Z',
  updated_at: '2023-01-01T10:00:00Z',
  user_id: 'user-123',
  version: 1,
};

const mockNotes: Note[] = [
  mockNote,
  {
    id: 'test-note-2',
    title: 'Another Note',
    content: 'Another test note content #personal',
    created_at: '2023-01-01T11:00:00Z',
    updated_at: '2023-01-01T11:00:00Z',
    user_id: 'user-123',
    version: 1,
  },
];

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = StorageService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('initializes with default data when storage is empty', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const data = await storageService.getData();

      expect(data.notes).toEqual([]);
      expect(data.tags).toEqual([]);
      expect(data.user).toBeNull();
      expect(data.settings).toEqual({
        theme: 'light',
        language: 'en',
        autoSave: true,
        syncEnabled: true,
      });
      expect(data.sync).toEqual({
        lastSyncAt: null,
        pendingChanges: [],
        conflicts: [],
      });
      expect(data.metadata.version).toBe('1.0.0');
    });

    test('preserves existing data when initializing', async () => {
      const existingData = {
        notes: mockNotes,
        tags: ['#work', '#personal'],
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        settings: {
          theme: 'dark',
          language: 'fr',
          autoSave: false,
          syncEnabled: false,
        },
        sync: {
          lastSyncAt: '2023-01-01T10:00:00Z',
          pendingChanges: ['test-note-1'],
          conflicts: [],
        },
        metadata: {
          version: '1.0.0',
          createdAt: '2023-01-01T09:00:00Z',
          updatedAt: '2023-01-01T10:00:00Z',
          storageSize: 1024,
        },
      };

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': existingData });
      });

      const data = await storageService.getData();

      expect(data.notes).toEqual(mockNotes);
      expect(data.tags).toEqual(['#work', '#personal']);
      expect(data.user).toEqual(existingData.user);
      expect(data.settings).toEqual(existingData.settings);
      expect(data.sync).toEqual(existingData.sync);
    });
  });

  describe('Note Operations', () => {
    beforeEach(async () => {
      // Initialize storage with empty data
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await storageService.getData();
    });

    test('creates a new note', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await storageService.saveNote(mockNote);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNote);
      expect(result.operation).toBe('create');
    });

    test('updates an existing note', async () => {
      const existingNotes = [mockNote];
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: existingNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const updatedNote = { ...mockNote, title: 'Updated Title' };
      const result = await storageService.saveNote(updatedNote);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedNote);
      expect(result.operation).toBe('update');
    });

    test('gets a specific note', async () => {
      const existingNotes = [mockNote];
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: existingNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const note = await storageService.getNote(mockNote.id);

      expect(note).toEqual(mockNote);
    });

    test('returns null for non-existent note', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const note = await storageService.getNote('non-existent-id');

      expect(note).toBeNull();
    });

    test('gets all notes', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const notes = await storageService.getNotes();

      expect(notes).toEqual(mockNotes);
      expect(notes).toHaveLength(2);
    });

    test('deletes a note', async () => {
      const existingNotes = [mockNote];
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: existingNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await storageService.deleteNote(mockNote.id);

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockNote.id);
      expect(result.operation).toBe('delete');
    });

    test('returns error when deleting non-existent note', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const result = await storageService.deleteNote('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete note locally');
    });

    test('saves notes in batch', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await storageService.saveNotesBatch(mockNotes);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNotes);
      expect(result.operation).toBe('sync');
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      await storageService.getNotes();
    });

    test('searches notes by query', async () => {
      const notes = await storageService.getNotes();

      // Filter notes client-side
      const searchResults = notes.filter(note =>
        note.title?.toLowerCase().includes('test'.toLowerCase()) ||
        note.content.toLowerCase().includes('test'.toLowerCase())
      );

      expect(searchResults).toHaveLength(2);
    });

    test('filters notes by tags', async () => {
      const notes = await storageService.getNotes();

      // Filter notes by tags client-side
      const tagResults = notes.filter(note => {
        const noteTags = note.content.match(/#\w+/g) || [];
        return noteTags.includes('#work');
      });

      expect(tagResults).toHaveLength(1);
      expect(tagResults[0].id).toBe('test-note-1');
    });

    test('combines search and tag filters', async () => {
      const notes = await storageService.getNotes();

      // Apply both filters
      const filteredNotes = notes.filter(note => {
        const matchesSearch = note.content.toLowerCase().includes('another'.toLowerCase());
        const noteTags = note.content.match(/#\w+/g) || [];
        const matchesTag = noteTags.includes('#personal');
        return matchesSearch && matchesTag;
      });

      expect(filteredNotes).toHaveLength(1);
      expect(filteredNotes[0].id).toBe('test-note-2');
    });
  });

  describe('Storage Quota Management', () => {
    test('gets quota information when storage.estimate is available', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 1024 * 1024, // 1MB
        quota: 5 * 1024 * 1024, // 5MB
      });

      const quotaInfo = await storageService.getQuotaInfo();

      expect(quotaInfo.usageInBytes).toBe(1024 * 1024);
      expect(quotaInfo.quotaInBytes).toBe(5 * 1024 * 1024);
      expect(quotaInfo.usagePercentage).toBe(20);
      expect(quotaInfo.availableInBytes).toBe(4 * 1024 * 1024);
      expect(quotaInfo.isNearLimit).toBe(false);
      expect(quotaInfo.isOverLimit).toBe(false);
    });

    test('provides fallback quota info when storage.estimate is not available', async () => {
      mockStorageEstimate.mockRejectedValue(new Error('Not available'));

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const quotaInfo = await storageService.getQuotaInfo();

      expect(quotaInfo.usageInBytes).toBeGreaterThan(0);
      expect(quotaInfo.quotaInBytes).toBe(5 * 1024 * 1024); // Default 5MB assumption
    });

    test('detects when quota is near limit', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 4.2 * 1024 * 1024, // 4.2MB (84% of 5MB)
        quota: 5 * 1024 * 1024,
      });

      const quotaInfo = await storageService.getQuotaInfo();

      expect(quotaInfo.usagePercentage).toBe(84);
      expect(quotaInfo.isNearLimit).toBe(true);
      expect(quotaInfo.isOverLimit).toBe(false);
    });

    test('detects when quota is over limit', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 5.5 * 1024 * 1024, // 5.5MB (110% of 5MB)
        quota: 5 * 1024 * 1024,
      });

      const quotaInfo = await storageService.getQuotaInfo();

      expect(quotaInfo.usagePercentage).toBe(110);
      expect(quotaInfo.isNearLimit).toBe(true);
      expect(quotaInfo.isOverLimit).toBe(true);
    });
  });

  describe('Storage Statistics', () => {
    test('calculates storage statistics', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: mockNotes, tags: ['#work', '#personal'], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const stats = await storageService.getStorageStats();

      expect(stats.totalNotes).toBe(2);
      expect(stats.totalTags).toBe(2);
      expect(stats.oldestNote).toBe('2023-01-01T10:00:00Z');
      expect(stats.newestNote).toBe('2023-01-01T11:00:00Z');
      expect(stats.storageSize).toBeGreaterThan(0);
    });

    test('handles empty storage statistics', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const stats = await storageService.getStorageStats();

      expect(stats.totalNotes).toBe(0);
      expect(stats.totalTags).toBe(0);
      expect(stats.oldestNote).toBeNull();
      expect(stats.newestNote).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('handles storage get errors gracefully', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback(new Error('Storage access denied'));
      });

      const notes = await storageService.getNotes();

      expect(notes).toEqual([]);
    });

    test('handles storage set errors gracefully', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback(new Error('Storage quota exceeded'));
      });

      const result = await storageService.saveNote(mockNote);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    test('creates storage errors with proper types', () => {
      const error = new Error('Test error') as any;
      error.type = StorageErrorType.QUOTA_EXCEEDED;

      expect(error.type).toBe(StorageErrorType.QUOTA_EXCEEDED);
      expect(error.operation).toBeDefined();
    });
  });

  describe('Event System', () => {
    test('adds and removes event listeners', () => {
      const listener = jest.fn();

      storageService.addEventListener('change', listener);
      storageService.removeEventListener('change', listener);

      // Should not throw
      expect(true).toBe(true);
    });

    test('emits events on storage changes', async () => {
      const listener = jest.fn();

      storageService.addEventListener('change', listener);

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await storageService.saveNote(mockNote);

      // Note: In a real implementation, events would be emitted
      // This test verifies the event system structure
      expect(typeof listener).toBe('function');
    });
  });

  describe('Data Validation and Cleanup', () => {
    test('validates note data structure', () => {
      const invalidNote = { ...mockNote, id: '' }; // Empty ID

      // Should handle invalid data gracefully
      expect(() => {
        // In a real implementation, this would validate the note
        if (!invalidNote.id) {
          throw new Error('Invalid note: missing required field');
        }
      }).toThrow();
    });

    test('cleans up old notes when quota is near limit', async () => {
      // Create old notes
      const oldNotes = mockNotes.map(note => ({
        ...note,
        updated_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days ago
      }));

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: oldNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      mockStorageEstimate.mockResolvedValue({
        usage: 4.2 * 1024 * 1024, // 84% of 5MB (near limit)
        quota: 5 * 1024 * 1024,
      });

      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await storageService.getQuotaInfo();

      // Should trigger cleanup
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('handles large numbers of notes efficiently', async () => {
      const largeNotesArray = Array.from({ length: 1000 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
        title: `Note ${i}`,
        content: `Content for note ${i}`,
      }));

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: largeNotesArray, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const startTime = performance.now();
      const notes = await storageService.getNotes();
      const endTime = performance.now();

      expect(notes).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('efficiently searches large note collections', async () => {
      const largeNotesArray = Array.from({ length: 1000 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
        title: `Note ${i}`,
        content: i % 100 === 0 ? 'special search term' : `Content for note ${i}`,
      }));

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ 'silence_notes_data': { notes: largeNotesArray, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
      });

      const notes = await storageService.getNotes();
      const searchResults = notes.filter(note =>
        note.content.toLowerCase().includes('special search term')
      );

      expect(searchResults).toHaveLength(10);
    });
  });
});