/**
 * Authentication service tests for Silence Notes Chrome Extension
 * Fixed version that avoids memory leaks and infinite loops
 */

import { AuthService } from '../src/services/auth';
import { AuthStorage } from '../src/utils/storage';
import { User, AuthTokens } from '../src/types/auth';
import { CONFIG } from '../src/utils/config';

// Mock the storage utilities to avoid real Chrome API calls
jest.mock('../src/utils/storage', () => ({
  AuthStorage: {
    getAuthState: jest.fn(),
    getUser: jest.fn(),
    getTokens: jest.fn(),
    saveTokens: jest.fn(),
    saveUser: jest.fn(),
    saveAuthState: jest.fn(),
    saveOAuthState: jest.fn(),
    getOAuthState: jest.fn(),
    clearOAuthState: jest.fn(),
    shouldRefreshTokens: jest.fn(),
    clearAuth: jest.fn(),
  },
  ExtensionStorage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    getMultiple: jest.fn(),
  },
}));

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
  },
  identity: {
    getRedirectURL: jest.fn(() => 'https://test.auth.redirect'),
    launchWebAuthFlow: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
  },
};

global.chrome = mockChrome as any;
global.fetch = jest.fn();

describe('AuthService', () => {
  let authService: AuthService;
  let mockUser: User;
  let mockTokens: AuthTokens;

  beforeEach(() => {
    jest.clearAllMocks();

    authService = AuthService.getInstance();

    mockUser = {
      id: 'test-user-id',
      googleId: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      preferences: {
        theme: 'light',
        language: 'en',
        timeZone: 'UTC',
        emailNotifications: true,
        autoSave: true,
        defaultNoteView: 'grid'
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    mockTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      expiresAt: Date.now() + (900 * 1000)
    };

    // Set up default AuthStorage mocks
    (AuthStorage.getAuthState as jest.Mock).mockResolvedValue(null);
    (AuthStorage.getUser as jest.Mock).mockResolvedValue(null);
    (AuthStorage.getTokens as jest.Mock).mockResolvedValue(null);
    (AuthStorage.saveTokens as jest.Mock).mockResolvedValue(true);
    (AuthStorage.saveUser as jest.Mock).mockResolvedValue(true);
    (AuthStorage.saveAuthState as jest.Mock).mockResolvedValue(true);
    (AuthStorage.saveOAuthState as jest.Mock).mockResolvedValue(true);
    (AuthStorage.getOAuthState as jest.Mock).mockResolvedValue(null);
    (AuthStorage.clearOAuthState as jest.Mock).mockResolvedValue(true);
    (AuthStorage.shouldRefreshTokens as jest.Mock).mockResolvedValue(false);
    (AuthStorage.clearAuth as jest.Mock).mockResolvedValue(true);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should return unauthenticated state when no auth data exists', async () => {
      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
      expect(authState.tokens).toBeNull();
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
    });

    it('should return authenticated state when valid auth data exists', async () => {
      (AuthStorage.getAuthState as jest.Mock).mockResolvedValue(true);
      (AuthStorage.getUser as jest.Mock).mockResolvedValue(mockUser);
      (AuthStorage.getTokens as jest.Mock).mockResolvedValue(mockTokens);
      (AuthStorage.shouldRefreshTokens as jest.Mock).mockResolvedValue(false);

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockUser);
      expect(authState.tokens).toEqual(mockTokens);
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock console.error to suppress expected error logging during this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (AuthStorage.getAuthState as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(false);
      // The AuthService catches and processes the error, returning a generic error message
      expect(authState.error).toBe('An unknown error occurred.');

      // Restore console.error to avoid affecting other tests
      consoleErrorSpy.mockRestore();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', async () => {
      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true when authenticated', async () => {
      (AuthStorage.getAuthState as jest.Mock).mockResolvedValue(true);
      (AuthStorage.getTokens as jest.Mock).mockResolvedValue(mockTokens);
      (AuthStorage.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no tokens exist', async () => {
      const token = await authService.getAccessToken();
      expect(token).toBeNull();
    });

    it('should return valid access token', async () => {
      (AuthStorage.getTokens as jest.Mock).mockResolvedValue(mockTokens);
      (AuthStorage.shouldRefreshTokens as jest.Mock).mockResolvedValue(false);

      const token = await authService.getAccessToken();
      expect(token).toBe('test-access-token');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      (AuthStorage.getTokens as jest.Mock).mockResolvedValue(mockTokens);
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Logout successful' })
      });

      await authService.logout();

      expect(fetch).toHaveBeenCalledWith(
        `${CONFIG.API_BASE_URL}/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token'
          })
        })
      );

      expect(AuthStorage.clearAuth).toHaveBeenCalled();
    });
  });
});

describe('AuthStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldRefreshTokens', () => {
    it('should return false when no tokens exist', async () => {
      (AuthStorage.getTokens as jest.Mock).mockResolvedValue(null);

      const shouldRefresh = await AuthStorage.shouldRefreshTokens();
      expect(shouldRefresh).toBe(false);
    });
  });
});