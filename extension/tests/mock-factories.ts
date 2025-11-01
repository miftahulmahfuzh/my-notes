/**
 * Comprehensive Mock Factories for Service Testing
 * Provides robust, consistent mocking for all services
 */

import { Note } from '@/types';
import {
  LocalStorageData,
  SyncStatus,
  SyncResult,
  SyncConflict,
  StorageQuota,
  StorageStats
} from '@/types/storage';

// Test data factories
export const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  title: 'Test Note',
  content: 'This is test content #hashtag',
  created_at: '2023-01-01T10:00:00Z',
  updated_at: '2023-01-01T10:00:00Z',
  user_id: 'user-123',
  version: 1,
  ...overrides,
});

export const createMockLocalStorageData = (overrides: Partial<LocalStorageData> = {}): LocalStorageData => ({
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
    lastSyncAt: null,
    pendingChanges: [],
    conflicts: []
  },
  metadata: {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storageSize: 0
  },
  ...overrides,
});

export const createMockSyncStatus = (overrides: Partial<SyncStatus> = {}): SyncStatus => ({
  isSyncing: false,
  lastSyncAt: null,
  pendingChanges: 0,
  failedChanges: 0,
  ...overrides,
});

export const createMockSyncResult = (overrides: Partial<SyncResult> = {}): SyncResult => ({
  success: true,
  uploaded: 0,
  downloaded: 0,
  conflicts: [],
  errors: [],
  timestamp: new Date().toISOString(),
  ...overrides,
});

export const createMockStorageQuota = (overrides: Partial<StorageQuota> = {}): StorageQuota => ({
  usage: 1024,
  quota: 1024 * 1024, // 1MB
  percentage: 0.1,
  ...overrides,
});

export const createMockStorageStats = (overrides: Partial<StorageStats> = {}): StorageStats => ({
  totalNotes: 0,
  totalTags: 0,
  storageSize: 0,
  lastCleanup: null,
  ...overrides,
});

// Mock service factories
export const createMockStorageService = () => {
  const mockData = createMockLocalStorageData();

  return {
    // Core storage methods
    getData: jest.fn().mockResolvedValue(mockData),
    getNotes: jest.fn().mockResolvedValue([]),
    saveNote: jest.fn().mockImplementation(async (note: Note) => ({
      success: true,
      data: note,
      error: null
    })),
    deleteNote: jest.fn().mockResolvedValue({
      success: true,
      error: null
    }),
    getNote: jest.fn().mockImplementation(async (id: string) => {
      const note = mockData.notes.find(n => n.id === id);
      return note ? { success: true, data: note } : { success: false, error: 'Note not found' };
    }),
    saveNotesBatch: jest.fn().mockResolvedValue({
      success: true,
      results: [],
      error: null
    }),

    // Storage management methods
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),

    // Utility methods
    getStorageQuota: jest.fn().mockResolvedValue(createMockStorageQuota()),
    getStorageStats: jest.fn().mockResolvedValue(createMockStorageStats()),
    cleanupOldData: jest.fn().mockResolvedValue({
      success: true,
      deletedCount: 0,
      error: null
    }),

    // Internal methods (accessed via bracket notation in tests)
    'setRawData': jest.fn().mockImplementation(async (data: LocalStorageData) => {
      Object.assign(mockData, data);
      return { success: true };
    }),

    // Legacy methods for compatibility
    saveNotes: jest.fn(),
  };
};

export const createMockApiService = () => {
  return {
    // Core API methods
    syncNotes: jest.fn().mockResolvedValue({
      success: true,
      data: {
        notes: [],
        total: 0,
        limit: 10,
        offset: 0,
        hasMore: false,
        syncToken: 'sync-token-123',
        serverTime: new Date().toISOString(),
        conflicts: [],
        metadata: {
          lastSyncAt: new Date().toISOString(),
          serverTime: new Date().toISOString(),
          totalNotes: 0,
          updatedNotes: 0,
          hasConflicts: false,
        },
      },
    }),
    getNotes: jest.fn().mockResolvedValue({
      success: true,
      data: {
        notes: [],
        total: 0,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    }),
    createNote: jest.fn().mockImplementation(async (note: Partial<Note>) => ({
      success: true,
      data: createMockNote({ ...note, id: 'server-' + Date.now() }),
    })),
    updateNote: jest.fn().mockImplementation(async (note: Note) => ({
      success: true,
      data: { ...note, version: (note.version || 1) + 1 },
    })),
    deleteNote: jest.fn().mockResolvedValue({
      success: true,
    }),

    // Sync-specific methods
    forceSync: jest.fn().mockResolvedValue(createMockSyncResult()),

    // Utility methods
    uploadNote: jest.fn().mockResolvedValue({
      success: true,
      data: createMockNote(),
    }),
    downloadNotes: jest.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
  };
};

export const createMockOfflineDetector = () => {
  return {
    // Core status methods
    isOnline: jest.fn().mockReturnValue(true),
    isCurrentlyOnline: jest.fn().mockReturnValue(true),

    // Event listener methods
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),

    // Execution methods - IMPORTANT: This must actually call the callback
    executeWhenOnline: jest.fn().mockImplementation(async (callback, options = {}) => {
      if (jest.isMockFunction(this.isCurrentlyOnline) ? this.isCurrentlyOnline() : true) {
        return await callback();
      } else {
        throw new Error('Cannot execute while offline');
      }
    }),
  };
};

export const createMockAuthService = () => {
  return {
    // Core auth methods
    signIn: jest.fn().mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        token: 'jwt-token-123',
        refreshToken: 'refresh-token-123',
      },
    }),
    signOut: jest.fn().mockResolvedValue({
      success: true,
    }),
    getCurrentUser: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    }),
    refreshToken: jest.fn().mockResolvedValue({
      success: true,
      data: {
        token: 'new-jwt-token-123',
        refreshToken: 'new-refresh-token-123',
      },
    }),
    isAuthenticated: jest.fn().mockReturnValue(true),

    // Token management
    getToken: jest.fn().mockReturnValue('jwt-token-123'),
    getRefreshToken: jest.fn().mockReturnValue('refresh-token-123'),
    setToken: jest.fn(),
    clearTokens: jest.fn(),

    // Event methods
    addAuthListener: jest.fn(),
    removeAuthListener: jest.fn(),
  };
};

// Test helper functions
export const setupMockSuccess = (mock: jest.Mock, returnValue: any) => {
  mock.mockResolvedValue(returnValue);
};

export const setupMockFailure = (mock: jest.Mock, errorMessage: string) => {
  mock.mockRejectedValue(new Error(errorMessage));
};

export const setupMockSequential = (mock: jest.Mock, values: any[]) => {
  mock.mockResolvedValueOnce(values[0]);
  for (let i = 1; i < values.length; i++) {
    if (values[i] instanceof Error) {
      mock.mockRejectedValueOnce(values[i]);
    } else {
      mock.mockResolvedValueOnce(values[i]);
    }
  }
};

// Test constants
export const TEST_CONSTANTS = {
  USER_ID: 'user-123',
  NOTE_ID: 'note-1',
  JWT_TOKEN: 'jwt-token-123',
  REFRESH_TOKEN: 'refresh-token-123',
  SYNC_TOKEN: 'sync-token-123',
  API_BASE_URL: 'https://api.silence-notes.com',
  STORAGE_KEY: 'silence_notes_data',
  TIMEOUT: 5000,
} as const;

// Reset helpers for cleanup
export const resetAllMocks = (...mockServices: any[]) => {
  mockServices.forEach(service => {
    if (service && typeof jest.clearAllMocks === 'function') {
      Object.values(service).forEach(mock => {
        if (jest.isMockFunction(mock)) {
          mock.mockReset();
        }
      });
    }
  });
};