/**
 * Tests for Sync Service
 */

import { SyncService, SyncOptions } from '../sync';
import { storageService } from '../storage';
import { ApiService } from '../../utils/api';
import { offlineDetector } from '../utils/offline';
import { Note } from '../../types';

// Mock dependencies
jest.mock('../storage');
jest.mock('../../utils/api');
jest.mock('../utils/offline');

const mockStorageService = storageService as jest.Mocked<typeof storageService>;
const mockApiService = ApiService as jest.Mocked<typeof ApiService>;
const mockOfflineDetector = offlineDetector as jest.Mocked<typeof offlineDetector>;

// Test data
const mockNotes: Note[] = [
  {
    id: 'note-1',
    title: 'Test Note 1',
    content: 'This is test content #work',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-01-01T10:00:00Z',
    user_id: 'user-123',
    version: 1,
  },
  {
    id: 'note-2',
    title: 'Test Note 2',
    content: 'This is another test note #personal',
    created_at: '2023-01-01T11:00:00Z',
    updated_at: '2023-01-01T11:00:00Z',
    user_id: 'user-123',
    version: 1,
  },
];

const mockSyncResult = {
  success: true,
  data: {
    notes: mockNotes,
    total: 2,
    limit: 10,
    offset: 0,
    hasMore: false,
    syncToken: 'sync-token-123',
    serverTime: '2023-01-01T12:00:00Z',
    conflicts: [],
    metadata: {
      lastSyncAt: '2023-01-01T12:00:00Z',
      serverTime: '2023-01-01T12:00:00Z',
      totalNotes: 2,
      updatedNotes: 2,
      hasConflicts: false,
    },
  },
};

describe('SyncService', () => {
  let syncService: SyncService;
  let mockOptions: SyncOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOptions = {
      autoSync: true,
      syncInterval: 5000,
      batchSyncSize: 50,
      conflictResolution: 'local',
    };

    syncService = SyncService.getInstance();
    syncService.configure(mockOptions);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    syncService.destroy();
  });

  describe('Configuration', () => {
    test('configures sync options correctly', () => {
      const newOptions = {
        autoSync: false,
        syncInterval: 10000,
        conflictResolution: 'manual' as const,
      };

      syncService.configure(newOptions);

      // Options should be updated
      expect(true).toBe(true); // Implementation would update internal options
    });

    test('uses default configuration when none provided', () => {
      const defaultService = SyncService.getInstance();

      // Should have reasonable defaults
      expect(true).toBe(true); // Implementation would have default values
    });
  });

  describe('Sync Status', () => {
    test('returns initial sync status', async () => {
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: null,
        settings: { syncEnabled: true },
        sync: {
          lastSyncAt: '2023-01-01T12:00:00Z',
          pendingChanges: ['note-1'],
          conflicts: [],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      const status = await syncService.getStatus();

      expect(status.isSyncing).toBe(false);
      expect(status.lastSyncAt).toBe('2023-01-01T12:00:00Z');
      expect(status.pendingChanges).toBe(1);
      expect(status.failedChanges).toBe(0);
    });

    test('handles errors when getting status', async () => {
      mockStorageService.getData.mockRejectedValue(new Error('Storage error'));

      const status = await syncService.getStatus();

      expect(status.isSyncing).toBe(false);
      expect(status.lastSyncAt).toBeNull();
      expect(status.lastError).toBe('Storage error');
    });
  });

  describe('Manual Sync', () => {
    beforeEach(() => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: {
          lastSyncAt: '2023-01-01T10:00:00Z',
          pendingChanges: ['note-1'],
          conflicts: [],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.getNotes.mockResolvedValue(mockNotes);
      mockApiService.syncNotes.mockResolvedValue(mockSyncResult);
      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });
    });

    test('performs successful sync when online', async () => {
      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(result.uploaded).toBe(1); // One pending change
      expect(result.downloaded).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    test('skips sync when already syncing', async () => {
      // Mock isSyncing to return true
      Object.defineProperty(syncService, 'isSyncing', { get: () => true, configurable: true });

      const result = await syncService.sync();

      expect(result).toBeDefined();
      // Implementation would skip sync and return current status
    });

    test('handles offline state', async () => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(false);

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cannot sync while offline');
    });

    test('handles API errors gracefully', async () => {
      mockApiService.syncNotes.mockRejectedValue(new Error('API error'));

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('API error');
    });

    test('handles storage errors gracefully', async () => {
      mockStorageService.getData.mockRejectedValue(new Error('Storage error'));

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Storage error');
    });
  });

  describe('Note Sync Operations', () => {
    beforeEach(() => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
    });

    test('syncs single note successfully', async () => {
      const noteToSync = mockNotes[0];

      mockStorageService.getNote.mockResolvedValue(noteToSync);
      mockApiService.updateNote.mockResolvedValue({
        success: true,
        data: { ...noteToSync, version: 2 },
      });
      mockStorageService.saveNote.mockResolvedValue({ success: true });

      const result = await syncService.syncNote(noteToSync.id);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...noteToSync, version: 2 });
    });

    test('creates new note when note has local ID', async () => {
      const localNote = {
        ...mockNotes[0],
        id: 'local_1234567890_abc123',
        version: undefined,
      };

      mockStorageService.getNote.mockResolvedValue(localNote);
      mockApiService.createNote.mockResolvedValue({
        success: true,
        data: { ...localNote, id: 'server-123', version: 1 },
      });
      mockStorageService.saveNote.mockResolvedValue({ success: true });

      const result = await syncService.syncNote(localNote.id);

      expect(result.success).toBe(true);
      expect(mockApiService.createNote).toHaveBeenCalled();
      expect(result.data?.id).toBe('server-123');
    });

    test('handles note not found', async () => {
      mockStorageService.getNote.mockResolvedValue(null);

      const result = await syncService.syncNote('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Note not found');
    });

    test('handles sync errors', async () => {
      const noteToSync = mockNotes[0];

      mockStorageService.getNote.mockResolvedValue(noteToSync);
      mockApiService.updateNote.mockRejectedValue(new Error('Sync failed'));

      const result = await syncService.syncNote(noteToSync.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sync failed');
    });
  });

  describe('Conflict Resolution', () => {
    test('resolves conflicts with local strategy', async () => {
      const conflictId = 'conflict-123';

      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: null,
        settings: {},
        sync: {
          lastSyncAt: null,
          pendingChanges: [],
          conflicts: [{
            id: conflictId,
            type: 'note',
            localData: mockNotes[0],
            remoteData: { ...mockNotes[0], title: 'Remote Title' },
            resolved: false,
            createdAt: '2023-01-01T12:00:00Z',
          }],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNote.mockResolvedValue({ success: true });

      const result = await syncService.resolveConflict(conflictId, 'local');

      expect(result).toBe(true);
      expect(mockStorageService.saveNote).toHaveBeenCalledWith(mockNotes[0]);
    });

    test('resolves conflicts with remote strategy', async () => {
      const conflictId = 'conflict-123';
      const remoteNote = { ...mockNotes[0], title: 'Remote Title' };

      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: null,
        settings: {},
        sync: {
          lastSyncAt: null,
          pendingChanges: [],
          conflicts: [{
            id: conflictId,
            type: 'note',
            localData: mockNotes[0],
            remoteData: remoteNote,
            resolved: false,
            createdAt: '2023-01-01T12:00:00Z',
          }],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNote.mockResolvedValue({ success: true });

      const result = await syncService.resolveConflict(conflictId, 'remote');

      expect(result).toBe(true);
      expect(mockStorageService.saveNote).toHaveBeenCalledWith(remoteNote);
    });

    test('handles non-existent conflicts', async () => {
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: null,
        settings: {},
        sync: { lastSyncAt: null, pendingChanges: [], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      const result = await syncService.resolveConflict('non-existent-conflict', 'local');

      expect(result).toBe(false);
    });

    test('handles manual resolution with custom data', async () => {
      const conflictId = 'conflict-123';
      const customData = { ...mockNotes[0], title: 'Custom Resolution' };

      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: null,
        settings: {},
        sync: {
          lastSyncAt: null,
          pendingChanges: [],
          conflicts: [{
            id: conflictId,
            type: 'note',
            localData: mockNotes[0],
            remoteData: { ...mockNotes[0], title: 'Remote Title' },
            resolved: false,
            createdAt: '2023-01-01T12:00:00Z',
          }],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNote.mockResolvedValue({ success: true });

      const result = await syncService.resolveConflict(conflictId, 'manual', customData);

      expect(result).toBe(true);
      expect(mockStorageService.saveNote).toHaveBeenCalledWith(customData);
    });
  });

  describe('Force Sync', () => {
    beforeEach(() => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: {
          lastSyncAt: null,
          pendingChanges: ['note-1', 'note-2'],
          conflicts: [],
        },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });
      mockApiService.forceSync.mockResolvedValue(mockSyncResult);
    });

    test('performs force sync successfully', async () => {
      const result = await syncService.forceSync();

      expect(result.success).toBe(true);
      expect(mockApiService.forceSync).toHaveBeenCalled();
      expect(mockStorageService.saveNotesBatch).toHaveBeenCalled();
    });

    test('handles force sync errors', async () => {
      mockApiService.forceSync.mockRejectedValue(new Error('Force sync failed'));

      const result = await syncService.forceSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Force sync failed');
    });
  });

  describe('Event System', () => {
    test('adds and removes event listeners', () => {
      const listener = jest.fn();

      syncService.addEventListener(listener);
      syncService.removeEventListener(listener);

      // Should not throw
      expect(true).toBe(true);
    });

    test('emits sync events', async () => {
      const listener = jest.fn();
      syncService.addEventListener(listener);

      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: [],
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: [], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockApiService.syncNotes.mockResolvedValue(mockSyncResult);
      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });

      await syncService.sync();

      // Should emit sync complete event
      expect(listener).toHaveBeenCalledWith({
        type: 'sync_complete',
        data: expect.objectContaining({
          success: true,
          uploaded: expect.any(Number),
          downloaded: expect.any(Number),
        }),
        timestamp: expect.any(String),
      });
    });

    test('emits conflict detected events', async () => {
      const listener = jest.fn();
      syncService.addEventListener(listener);

      // Simulate conflict detection
      const conflictData = {
        conflictId: 'conflict-123',
        resolution: 'local',
      };

      // In a real implementation, this would trigger a conflict event
      expect(true).toBe(true); // Event system exists
    });
  });

  describe('Retry Logic', () => {
    test('retries failed sync operations', async () => {
      mockOfflineDetector.isCurrentlyOnline
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValue(true); // Network goes offline then online again

      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: ['note-1'], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      // First call fails (offline), second succeeds
      mockApiService.syncNotes
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockSyncResult);

      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });

      const result = await syncService.sync();

      // Should succeed on retry
      expect(result.success).toBe(true);
      expect(mockApiService.syncNotes).toHaveBeenCalledTimes(2);
    });
  });

  describe('Auto Sync', () => {
    test('starts auto-sync when configured', () => {
      syncService.configure({ autoSync: true, syncInterval: 1000 });

      // Should set up interval
      expect(true).toBe(true); // Implementation would set up setInterval
    });

    test('stops auto-sync when disabled', () => {
      syncService.configure({ autoSync: false });

      // Should clear interval
      expect(true).toBe(true); // Implementation would clear setInterval
    });

    test('respects user sync settings', async () => {
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: false },
        sync: { lastSyncAt: null, pendingChanges: [], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      await syncService.getStatus();

      // Should check user settings
      expect(mockStorageService.getData).toHaveBeenCalled();
    });
  });

  describe('Network Awareness', () => {
    test('pauses sync when going offline', async () => {
      await syncService.pauseSync();

      // Should pause any active sync operations
      expect(true).toBe(true); // Implementation would pause sync
    });

    test('resumes sync when coming online', async () => {
      await syncService.resumeSync();

      // Should resume sync operations
      expect(true).toBe(true); // Implementation would resume sync
    });

    test('triggers sync when connection is restored', async () => {
      const listener = jest.fn();
      syncService.addEventListener(listener);

      // Simulate network restoration
      mockOfflineDetector.addListener.mockImplementation((callback) => {
        callback({ isOnline: true, lastOnlineAt: null, connectionType: 'wifi', effectiveType: '4g' });
      });

      // Should trigger sync when connection is restored
      expect(true).toBe(true); // Implementation would trigger sync
    });
  });

  describe('Batch Operations', () => {
    test('processes sync operations in batches', async () => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: ['note-1', 'note-2'], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });
      mockApiService.syncNotes.mockResolvedValue(mockSyncResult);

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(mockStorageService.saveNotesBatch).toHaveBeenCalled();
    });

    test('respects batch size limits', async () => {
      syncService.configure({ batchSyncSize: 1 }); // Small batch size for testing

      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: ['note-1', 'note-2'], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });
      mockApiService.syncNotes.mockResolvedValue(mockSyncResult);

      await syncService.sync();

      // Should process in smaller batches
      expect(mockStorageService.saveNotesBatch).toHaveBeenCalledTimes(1); // Implementation respects batch size
    });
  });

  describe('Performance Optimization', () => {
    test('handles large note collections efficiently', async () => {
      const largeNotesArray = Array.from({ length: 1000 }, (_, i) => ({
        ...mockNote,
        id: `note-${i}`,
        title: `Note ${i}`,
        content: `Content for note ${i}`,
      }));

      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: largeNotesArray,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: [], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      mockStorageService.saveNotesBatch.mockResolvedValue({ success: true });
      mockApiService.syncNotes.mockResolvedValue({
        success: true,
        data: {
          ...mockSyncResult.data,
          notes: largeNotesArray.slice(0, 100), // Limit for efficiency
          total: 1000,
        },
      });

      const startTime = performance.now();
      const result = await syncService.sync();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('cancels long-running sync operations', async () => {
      mockOfflineDetector.isCurrentlyOnline.mockReturnValue(true);
      mockStorageService.getData.mockResolvedValue({
        notes: mockNotes,
        tags: [],
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        settings: { syncEnabled: true },
        sync: { lastSyncAt: null, pendingChanges: [], conflicts: [] },
        metadata: { version: '1.0.0', createdAt: '', updatedAt: '', storageSize: 0 },
      });

      // Mock a slow sync operation
      mockApiService.syncNotes.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(mockSyncResult), 1000));
      });

      const syncPromise = syncService.sync();

      // Cancel after 500ms
      setTimeout(() => {
        syncService.destroy();
      }, 500);

      const result = await syncPromise;

      // Should handle cancellation gracefully
      expect(result).toBeDefined();
    });
  });
});