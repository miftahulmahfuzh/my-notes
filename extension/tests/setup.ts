// Mock Chrome API for testing
const createMockChromeStorage = () => ({
  get: jest.fn().mockResolvedValue({}),
  set: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
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
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue(undefined);
  chrome.storage.local.remove.mockResolvedValue(undefined);
  chrome.storage.local.clear.mockResolvedValue(undefined);

  chrome.storage.sync.get.mockResolvedValue({});
  chrome.storage.sync.set.mockResolvedValue(undefined);
  chrome.storage.sync.remove.mockResolvedValue(undefined);
  chrome.storage.sync.clear.mockResolvedValue(undefined);

  // Reset fetch mock
  (global.fetch as jest.Mock).mockClear();
});

// Global test utilities
global.createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'test-note-id',
  title: 'Test Note',
  content: 'Test content #hashtag',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'test-user-id',
  version: 1,
  ...overrides,
});

// Silence console warnings about React act in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});