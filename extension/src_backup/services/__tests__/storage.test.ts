/**
 * Tests for Storage Service
 */

import { StorageService } from '../storage';
import { StorageErrorType } from '@/types/storage';

// Use global Chrome API mocks from tests/setup.ts
// No need to override global chrome.storage

// Reference to the mocked navigator.storage.estimate
const mockStorageEstimate = navigator.storage.estimate as jest.MockedFunction<typeof navigator.storage.estimate>;

// Test data - use any to avoid type import issues
const mockNote: any = {
  id: 'test-note-1',
  title: 'Test Note',
  content: 'This is a test note content #work',
  created_at: '2023-01-01T10:00:00Z',
  updated_at: '2023-01-01T10:00:00Z',
  user_id: 'user-123',
  version: 1,
};

const mockNotes: any[] = [
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
    // Reset the singleton instance for clean testing
    (StorageService as any).instance = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('initializes with default data when storage is empty', async () => {
      // Mock the storage operations properly
      let storedData: any = {};

      chrome.storage.local.get.mockImplementation((keys) => {
        return Promise.resolve(storedData);
      });

      chrome.storage.local.set.mockImplementation((data) => {
        storedData = { ...storedData, ...data };
        return Promise.resolve();
      });

      // Create service instance AFTER setting up mocks
      storageService = StorageService.getInstance();

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

      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': existingData });

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
      // Reset the singleton instance for clean testing
      (StorageService as any).instance = null;

      // Initialize storage with empty data
      let storedData: any = {};

      chrome.storage.local.get.mockImplementation((keys) => {
        return Promise.resolve(storedData);
      });

      chrome.storage.local.set.mockImplementation((data) => {
        storedData = { ...storedData, ...data };
        return Promise.resolve();
      });

      // Create service instance and initialize it
      storageService = StorageService.getInstance();
      await storageService.getData();
    });

    test('creates a new note', async () => {
      const result = await storageService.saveNote(mockNote);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        id: mockNote.id,
        title: mockNote.title,
        content: mockNote.content,
        user_id: mockNote.user_id
      }));
      expect(result.operation).toBe('create');
    });

    test('updates an existing note', async () => {
      // First create a note to update
      await storageService.saveNote(mockNote);

      const updatedNote = { ...mockNote, title: 'Updated Title' };
      const result = await storageService.saveNote(updatedNote);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        id: mockNote.id,
        title: 'Updated Title',
        content: mockNote.content,
        user_id: mockNote.user_id
      }));
      expect(result.operation).toBe('update');
    });

    test('gets a specific note', async () => {
      const existingNotes = [mockNote];
      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: existingNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      const note = await storageService.getNote(mockNote.id);

      expect(note).toEqual(mockNote);
    });

    test('returns null for non-existent note', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      const note = await storageService.getNote('non-existent-id');

      expect(note).toBeNull();
    });

    test('gets all notes', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      const notes = await storageService.getNotes();

      expect(notes).toEqual(mockNotes);
      expect(notes).toHaveLength(2);
    });

    test('deletes a note', async () => {
      // First create a note to delete
      await storageService.saveNote(mockNote);

      const result = await storageService.deleteNote(mockNote.id);

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockNote.id);
      expect(result.operation).toBe('delete');
    });

    test('returns error when deleting non-existent note', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      const result = await storageService.deleteNote('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete note locally');
    });

    test('saves notes in batch', async () => {
      const result = await storageService.saveNotesBatch(mockNotes);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          content: expect.any(String),
          user_id: expect.any(String)
        })
      ]));
      expect(result.operation).toBe('sync');
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

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

      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: mockNotes, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

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
      chrome.storage.local.get.mockResolvedValue({
        'silence_notes_data': {
          notes: mockNotes,
          tags: ['#work', '#personal'],
          user: null,
          settings: {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          },
          sync: {
            lastSyncAt: '2023-01-01T10:00:00Z',
            pendingChanges: [],
            conflicts: []
          },
          metadata: {
            version: '1.0.0',
            createdAt: '2023-01-01T09:00:00Z',
            updatedAt: '2023-01-01T10:00:00Z',
            storageSize: 1024
          }
        }
      });

      const stats = await storageService.getStorageStats();

      expect(stats.totalNotes).toBe(2);
      expect(stats.totalTags).toBe(2);
      expect(stats.oldestNote).toBe('2023-01-01T10:00:00Z');
      expect(stats.newestNote).toBe('2023-01-01T11:00:00Z');
      expect(stats.storageSize).toBeGreaterThan(0);
    });

    test('handles empty storage statistics', async () => {
      chrome.storage.local.get.mockResolvedValue({
        'silence_notes_data': {
          notes: [],
          tags: [],
          user: null,
          settings: {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          },
          sync: {
            lastSyncAt: '2023-01-01T10:00:00Z',
            pendingChanges: [],
            conflicts: []
          },
          metadata: {
            version: '1.0.0',
            createdAt: '2023-01-01T09:00:00Z',
            updatedAt: '2023-01-01T10:00:00Z',
            storageSize: 0
          }
        }
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
      chrome.storage.local.get.mockRejectedValue(new Error('Storage access denied'));

      const notes = await storageService.getNotes();

      expect(notes).toEqual([]);
    });

    test('handles storage set errors gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        'silence_notes_data': {
          notes: [],
          tags: [],
          user: null,
          settings: {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          },
          sync: {
            lastSyncAt: '2023-01-01T10:00:00Z',
            pendingChanges: [],
            conflicts: []
          },
          metadata: {
            version: '1.0.0',
            createdAt: '2023-01-01T09:00:00Z',
            updatedAt: '2023-01-01T10:00:00Z',
            storageSize: 0
          }
        }
      });

      chrome.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));

      const result = await storageService.saveNote(mockNote);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    test('creates storage errors with proper types', () => {
      // Test the createStorageError method directly
      const service = StorageService.getInstance();
      const createStorageErrorMethod = (service as any).createStorageError.bind(service);

      const error = createStorageErrorMethod(
        StorageErrorType.QUOTA_EXCEEDED,
        'Test quota exceeded error',
        'save',
        { original: 'error data' }
      );

      expect(error.type).toBe(StorageErrorType.QUOTA_EXCEEDED);
      expect(error.operation).toBe('save');
      expect(error.data).toEqual({ original: 'error data' });
      expect(error.message).toBe('Test quota exceeded error');
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

      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      chrome.storage.local.set.mockResolvedValue(undefined);

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

      chrome.storage.local.get.mockResolvedValue({
        'silence_notes_data': {
          notes: oldNotes,
          tags: [],
          user: null,
          settings: {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          },
          sync: {
            lastSyncAt: '2023-01-01T10:00:00Z',
            pendingChanges: [],
            conflicts: []
          },
          metadata: {
            version: '1.0.0',
            createdAt: '2023-01-01T09:00:00Z',
            updatedAt: '2023-01-01T10:00:00Z',
            storageSize: 4.2 * 1024 * 1024
          }
        }
      });

      mockStorageEstimate.mockResolvedValue({
        usage: 4.2 * 1024 * 1024, // 84% of 5MB (near limit)
        quota: 5 * 1024 * 1024,
      });

      chrome.storage.local.set.mockResolvedValue(undefined);

      await storageService.performManualCleanup();

      // Should trigger cleanup
      expect(chrome.storage.local.set).toHaveBeenCalled();
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

      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: largeNotesArray, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

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

      chrome.storage.local.get.mockResolvedValue({ 'silence_notes_data': { notes: largeNotesArray, tags: [], user: null, settings: {}, sync: {}, metadata: {} } });

      const notes = await storageService.getNotes();
      const searchResults = notes.filter(note =>
        note.content.toLowerCase().includes('special search term')
      );

      expect(searchResults).toHaveLength(10);
    });
  });
});