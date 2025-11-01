/**
 * Authentication service tests for Silence Notes Chrome Extension
 */

import { AuthService } from '../src/services/auth';
import { AuthStorage } from '../src/utils/storage';
import { AuthState, User, AuthTokens } from '../src/types/auth';
import { CONFIG } from '../src/utils/config';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    getManifest: jest.fn(() => ({ version: '1.0.0' }))
  },
  identity: {
    getRedirectURL: jest.fn(() => 'https://test.auth.redirect'),
    launchWebAuthFlow: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  }
};

// Set up global Chrome mock
global.chrome = mockChrome as any;

// Mock fetch
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

    // Default successful storage operations
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
      let result: Record<string, any> = {};
      if (typeof keys === 'string') {
        result[keys] = null;
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = null;
        });
      }
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation(() => {
      return Promise.resolve();
    });

    (chrome.storage.local.remove as jest.Mock).mockImplementation(() => {
      return Promise.resolve();
    });
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
      // Mock existing auth data
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_auth_state') {
            return Promise.resolve({ [keys]: true });
          } else if (keys === 'silence_notes_tokens') {
            return Promise.resolve({ [keys]: mockTokens });
          } else if (keys === 'silence_notes_user_data') {
            return Promise.resolve({ [keys]: mockUser });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_auth_state') {
              result[key] = true;
            } else if (key === 'silence_notes_tokens') {
              result[key] = mockTokens;
            } else if (key === 'silence_notes_user_data') {
              result[key] = mockUser;
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockUser);
      expect(authState.tokens).toEqual(mockTokens);
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock storage error
      (chrome.storage.local.get as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBe('Storage error');
    });
  });

  describe('startGoogleAuth', () => {
    beforeEach(() => {
      // Mock successful API response
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          authUrl: 'https://accounts.google.com/oauth/authorize?state=test-state',
          state: 'test-state'
        })
      });
    });

    it('should initiate Google OAuth flow', async () => {
      const result = await authService.startGoogleAuth();

      expect(fetch).toHaveBeenCalledWith(
        `${CONFIG.API_BASE_URL}/auth/google`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('redirect')
        })
      );

      expect(result).toEqual({
        authUrl: 'https://accounts.google.com/oauth/authorize?state=test-state',
        state: 'test-state'
      });
    });

    it('should save OAuth state to storage', async () => {
      await authService.startGoogleAuth();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'silence_notes_oauth_state': expect.objectContaining({
            state: expect.any(String),
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should handle API errors', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'OAuth error' })
      });

      await expect(authService.startGoogleAuth()).rejects.toThrow('OAuth error');
    });
  });

  describe('launchGoogleOAuth', () => {
    beforeEach(() => {
      // Mock successful API response
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          authUrl: 'https://accounts.google.com/oauth/authorize?state=test-state',
          state: 'test-state'
        })
      });

      // Mock successful OAuth flow
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          callback?.('https://test.auth.redirect?code=test-code&state=test-state');
        }
      );

      // Mock successful token exchange
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          authUrl: 'https://accounts.google.com/oauth/authorize?state=test-state',
          state: 'test-state'
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: mockUser,
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 900
        })
      });

      // Mock OAuth state storage and retrieval
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_oauth_state') {
            return Promise.resolve({
              [keys]: { state: 'test-state', timestamp: Date.now() }
            });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_oauth_state') {
              result[key] = { state: 'test-state', timestamp: Date.now() };
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });
    });

    it('should launch Google OAuth flow', async () => {
      await authService.launchGoogleOAuth();

      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('accounts.google.com'),
          interactive: true
        }),
        expect.any(Function)
      );
    });

    it('should handle OAuth callback successfully', async () => {
      await authService.launchGoogleOAuth();

      // Verify token exchange was called
      expect(fetch).toHaveBeenCalledWith(
        `${CONFIG.API_BASE_URL}/auth/google/callback`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('code=test-code&state=test-state')
        })
      );

      // Verify auth data was saved
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'silence_notes_tokens': expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        }),
        'silence_notes_user_data': mockUser,
        'silence_notes_auth_state': true
      });
    });

    it('should handle OAuth flow errors', async () => {
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          callback?.(null);
        }
      );

      await expect(authService.launchGoogleOAuth()).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'refreshed-access-token',
          refresh_token: 'refreshed-refresh-token',
          token_type: 'Bearer',
          expires_in: 900
        })
      });

      // Mock token storage to handle refresh operations
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            result[key] = null;
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });
    });

    it('should refresh tokens successfully', async () => {
      const result = await authService.refreshTokens('test-refresh-token');

      expect(fetch).toHaveBeenCalledWith(
        `${CONFIG.API_BASE_URL}/auth/refresh`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'test-refresh-token' })
        })
      );

      expect(result).toEqual({
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: expect.any(Number)
      });
    });

    it('should save refreshed tokens', async () => {
      await authService.refreshTokens('test-refresh-token');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'silence_notes_tokens': expect.objectContaining({
          accessToken: 'refreshed-access-token',
          refreshToken: 'refreshed-refresh-token'
        })
      });
    });

    it('should return null on refresh failure', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid refresh token' })
      });

      const result = await authService.refreshTokens('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      // Mock existing tokens
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_tokens') {
            return Promise.resolve({ [keys]: mockTokens });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_tokens') {
              result[key] = mockTokens;
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Logout successful' })
      });
    });

    it('should logout successfully', async () => {
      await authService.logout();

      // Verify backend logout was called
      expect(fetch).toHaveBeenCalledWith(
        `${CONFIG.API_BASE_URL}/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token'
          })
        })
      );

      // Verify local data was cleared
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'silence_notes_auth_state',
        'silence_notes_user_data',
        'silence_notes_tokens',
        'silence_notes_oauth_state'
      ]);
    });

    it('should handle logout errors gracefully', async () => {
      // Mock runtime error
      (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
        (_, callback) => {
          (callback as any)?.({ type: 'AUTH_ERROR', payload: { error: 'Logout failed' } });
          return chrome.runtime.lastError = { message: 'Runtime error' };
        }
      );

      await authService.logout();

      // Should still clear local data even if backend communication fails
      expect(chrome.storage.local.remove).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', async () => {
      // Mock authenticated state
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_auth_state') {
            return Promise.resolve({ [keys]: true });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_auth_state') {
              result[key] = true;
            } else if (key === 'silence_notes_tokens') {
              result[key] = mockTokens;
            } else if (key === 'silence_notes_user_data') {
              result[key] = mockUser;
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false when not authenticated', async () => {
      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return valid access token', async () => {
      // Mock existing valid tokens
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_tokens') {
            return Promise.resolve({ [keys]: mockTokens });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_tokens') {
              result[key] = mockTokens;
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });

      const token = await authService.getAccessToken();
      expect(token).toBe('test-access-token');
    });

    it('should refresh expired tokens', async () => {
      // Mock expired tokens
      const expiredTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (typeof keys === 'string') {
          if (keys === 'silence_notes_tokens') {
            return Promise.resolve({ [keys]: expiredTokens });
          }
          return Promise.resolve({ [keys]: null });
        } else if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (key === 'silence_notes_tokens') {
              result[key] = expiredTokens;
            } else {
              result[key] = null;
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 900
        })
      });

      const token = await authService.getAccessToken();
      expect(token).toBe('new-access-token');
    });

    it('should return null when no tokens exist', async () => {
      const token = await authService.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('should add and remove auth state change listeners', () => {
      const callback = jest.fn();
      const unsubscribe = authService.onAuthStateChange(callback);

      // Trigger auth state change
      authService.notifyAuthStateChange({
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        isLoading: false,
        error: null
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          user: mockUser
        })
      );

      // Remove listener
      unsubscribe();

      // Trigger another change
      authService.notifyAuthStateChange({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: null
      });

      // Callback should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AuthStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('should save tokens to storage', async () => {
      const tokens: AuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + (900 * 1000)
      };

      await AuthStorage.saveTokens(tokens);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'silence_notes_tokens': tokens
      });
    });
  });

  describe('shouldRefreshTokens', () => {
    it('should return true when tokens expire within threshold', async () => {
      const tokens: AuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + (60 * 1000) // 1 minute from now
      };

      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        'silence_notes_tokens': tokens
      });

      const shouldRefresh = await AuthStorage.shouldRefreshTokens();
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when tokens are still valid', async () => {
      const tokens: AuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes from now
      };

      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        'silence_notes_tokens': tokens
      });

      const shouldRefresh = await AuthStorage.shouldRefreshTokens();
      expect(shouldRefresh).toBe(false);
    });
  });
});