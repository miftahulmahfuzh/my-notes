// Mock Chrome API for testing
import { Note } from '../src/types';

type MockedFn = ReturnType<typeof jest.fn> & {
  mockResolvedValue: (value: any) => any;
  mockRejectedValue: (value: any) => any;
};

const createMockChromeStorage = () => ({
  get: jest.fn().mockImplementation((keys: any, callback?: (result: any) => void) => {
    const result: any = {};
    if (callback) callback(result);
    return Promise.resolve(result);
  }) as MockedFn,
  set: jest.fn().mockImplementation((items: any, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve(undefined);
  }) as MockedFn,
  remove: jest.fn().mockImplementation((keys: any, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve(undefined);
  }) as unknown as MockedFn,
  clear: jest.fn().mockResolvedValue(undefined) as unknown as MockedFn,
});

const mockChrome = {
  storage: {
    local: createMockChromeStorage(),
    sync: createMockChromeStorage(),
  },
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({}),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
      dispatch: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    onConnect: {
      addListener: jest.fn(),
    },
    onSuspend: {
      addListener: jest.fn(),
    },
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
    id: 'test-extension-id',
    lastError: null,
  },
  identity: {
    getRedirectURL: jest.fn(() => 'https://test.auth.redirect'),
    launchWebAuthFlow: jest.fn(),
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn(),
    getProfileUserInfo: jest.fn(),
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    sendMessage: jest.fn().mockResolvedValue({}),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    getAll: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setTitle: jest.fn(),
    setIcon: jest.fn(),
  },
};

global.chrome = mockChrome as any;

// Mock navigator.storage.estimate
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: jest.fn().mockResolvedValue({
      usage: 1024 * 1024, // 1MB
      quota: 5 * 1024 * 1024, // 5MB
    }),
  },
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});


// Setup test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset Chrome storage mocks to default state
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.local.clear as jest.Mock).mockResolvedValue(undefined);

  (chrome.storage.sync.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.sync.remove as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.sync.clear as jest.Mock).mockResolvedValue(undefined);

  // Reset fetch mock
  (global.fetch as jest.Mock).mockClear();
});

// Global test utilities
(global as any).createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'test-note-id',
  title: 'Test Note',
  content: 'Test content #hashtag',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'test-user-id',
  version: 1,
  ...overrides,
});

// Silence console warnings and errors that are expected during tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Filter out expected error messages that are part of testing error scenarios
    if (
      typeof args[0] === 'string' && (
        args[0].includes('Warning: ReactDOM.render is deprecated') ||
        args[0].includes('Failed to get sync status') ||
        args[0].includes('Failed to get raw data') ||
        args[0].includes('Failed to get data') ||
        args[0].includes('Failed to get notes') ||
        args[0].includes('Failed to set raw data') ||
        args[0].includes('Failed to save note') ||
        args[0].includes('Storage error') ||
        args[0].includes('Storage access denied') ||
        args[0].includes('No data found in storage') ||
        args[0].includes('Storage quota exceeded') ||
        args[0].includes('Failed to retrieve data')
      )
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    // Filter out expected warning messages that are part of testing fallback scenarios
    if (
      typeof args[0] === 'string' && (
        args[0].includes('navigator.storage.estimate failed, using fallback')
      )
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.log = (...args: any[]) => {
    // Filter out expected log messages that are part of testing cleanup scenarios
    if (
      typeof args[0] === 'string' && (
        args[0].includes('Cleaned up') && args[0].includes('old notes from storage')
      )
    ) {
      return;
    }
    originalLog.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});