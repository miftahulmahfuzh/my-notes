/**
 * Authentication service tests for Silence Notes Chrome Extension
 * Tests AuthService class with comprehensive coverage of all methods
 */

import { AuthService, User, AuthTokens, AuthState, AuthResponse } from '../src/auth';
import { CONFIG } from '../src/utils/config';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUser: User;
  let mockAuthResponse: AuthResponse;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Chrome runtime.lastError
    (chrome.runtime as any).lastError = null;

    // Reset Chrome storage mocks
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
      const result: Record<string, any> = {};
      if (callback) callback(result);
      return Promise.resolve(result);
    });
    (chrome.storage.local.set as jest.Mock).mockImplementation((items: any, callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve(undefined);
    });
    (chrome.storage.local.remove as jest.Mock).mockImplementation((keys: any, callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve(undefined);
    });

    // Reset Chrome identity mocks
    (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
      if (callback) callback('mock-google-token');
      return Promise.resolve('mock-google-token');
    });
    (chrome.identity.removeCachedAuthToken as jest.Mock).mockImplementation((params, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });

    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();

    authService = AuthService.getInstance();

    // Reset auth state for each test
    authService.setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    });

    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockAuthResponse = {
      user: mockUser,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      sessionId: 'test-session-id'
    };
  });

  describe('1. Singleton Pattern', () => {
    it('should return same instance from getInstance()', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return identical reference on multiple calls', () => {
      const instances = Array.from({ length: 5 }, () => AuthService.getInstance());
      instances.forEach(instance => {
        expect(instance).toBe(authService);
      });
    });
  });

  describe('2. State Management', () => {
    it('getAuthState() should return a copy of state (not reference)', () => {
      const state1 = authService.getAuthState();
      const state2 = authService.getAuthState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('subscribe() should add listener and return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = authService.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Cleanup
    });

    it('unsubscribe should remove listener', () => {
      const listener = jest.fn();
      const unsubscribe = authService.subscribe(listener);

      unsubscribe();
      authService.setAuthState({ isAuthenticated: true });

      expect(listener).not.toHaveBeenCalled();
    });

    it('setAuthState() should update state and notify all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      authService.subscribe(listener1);
      authService.subscribe(listener2);

      authService.setAuthState({ isAuthenticated: true });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      const calls1 = listener1.mock.calls[0][0];
      const calls2 = listener2.mock.calls[0][0];

      expect(calls1.isAuthenticated).toBe(true);
      expect(calls2.isAuthenticated).toBe(true);
    });

    it('setAuthState() should merge partial updates', () => {
      const listener = jest.fn();
      authService.subscribe(listener);

      authService.setAuthState({ isAuthenticated: true });
      authService.setAuthState({ error: 'test error' });

      const state = listener.mock.calls[1][0];
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBe('test error');
      expect(state.isLoading).toBe(false); // Default value
    });
  });

  describe('3. Initialization', () => {
    it('initialize() with no existing data returns unauthenticated state', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
    });

    it('initialize() with valid tokens returns authenticated state', async () => {
      const expiryTime = Date.now() + (900 * 1000);

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'test-access-token',
          token_expiry: expiryTime.toString(),
          user_info: mockUser
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockUser);
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
    });

    it('initialize() with expired tokens attempts refresh', async () => {
      const expiredTime = Date.now() - 1000;

      (chrome.storage.local.get as jest.Mock)
        .mockImplementationOnce((keys: any, callback: any) => {
          const result: Record<string, any> = {
            access_token: 'expired-token',
            token_expiry: expiredTime.toString(),
            refresh_token: 'valid-refresh-token',
            user_info: mockUser
          };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
        .mockImplementationOnce((keys: any, callback: any) => {
          const result: Record<string, any> = {
            token_expiry: expiredTime.toString()
          };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
        .mockImplementationOnce((keys: any, callback: any) => {
          const result: Record<string, any> = {
            refresh_token: 'valid-refresh-token'
          };
          if (callback) callback(result);
          return Promise.resolve(result);
        });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 900
          }
        })
      });

      const authState = await authService.initialize();

      // Should attempt refresh
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('refresh_token')
        })
      );
    });

    it('initialize() handles storage errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const authState = await authService.initialize();

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBe('Failed to initialize authentication');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('4. Authentication', () => {
    it('authenticate() successfully gets token and exchanges with backend', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-oauth-token');
        return Promise.resolve('google-oauth-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'backend-access-token',
            refresh_token: 'backend-refresh-token',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session-123'
          }
        })
      });

      const result = await authService.authenticate();

      expect(result).toBe(true);
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        { interactive: true, scopes: ['openid', 'email', 'profile'] },
        expect.any(Function)
      );
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/chrome',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('google-oauth-token')
        })
      );
    });

    it('authenticate() handles token retrieval failure', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        (chrome.runtime as any).lastError = { message: 'OAuth error' };
        if (callback) callback();
        return Promise.resolve();
      });

      const result = await authService.authenticate();

      expect(result).toBe(false);

      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('OAuth error');
    });

    it('authenticate() handles backend exchange failure', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Invalid token' })
      });

      const result = await authService.authenticate();

      expect(result).toBe(false);
      const state = authService.getAuthState();
      expect(state.error).toBeTruthy();
    });

    it('authenticate() stores tokens correctly on success', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'backend-token',
            refresh_token: 'refresh-token',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session-123'
          }
        })
      });

      await authService.authenticate();

      // Verify storage calls
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(5); // access_token, refresh_token, session_id, token_expiry, user_info

      const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
      const storedData = setCalls.reduce((acc, [data]) => ({ ...acc, ...data }), {});

      expect(storedData.access_token).toBe('backend-token');
      expect(storedData.refresh_token).toBe('refresh-token');
      expect(storedData.session_id).toBe('session-123');
    });

    it('authenticate() updates state on success', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session-123'
          }
        })
      });

      await authService.authenticate();

      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('5. Token Validation', () => {
    it('isAuthenticated() returns true for valid non-expired token', async () => {
      const expiryTime = Date.now() + (900 * 1000);

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'valid-token',
          token_expiry: expiryTime.toString()
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('isAuthenticated() returns false for missing token', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });

    it('isAuthenticated() returns false for expired token when refresh fails', async () => {
      const expiredTime = Date.now() - 1000;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'expired-token',
          token_expiry: expiredTime.toString(),
          refresh_token: 'invalid-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });

    it('isAuthenticated() attempts refresh on expiry', async () => {
      const expiredTime = Date.now() - 1000;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'expired-token',
          token_expiry: expiredTime.toString(),
          refresh_token: 'valid-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 900
        })
      });

      const result = await authService.isAuthenticated();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/refresh',
        expect.any(Object)
      );
    });

    it('isAuthenticated() handles refresh failure', async () => {
      const expiredTime = Date.now() - 1000;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'expired-token',
          token_expiry: expiredTime.toString(),
          refresh_token: 'bad-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('6. Token Refresh', () => {
    it('refreshToken() successfully refreshes valid token', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          refresh_token: 'valid-refresh-token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 900
        })
      });

      const result = await authService.refreshToken();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('valid-refresh-token')
        })
      );
    });

    it('refreshToken() fails with invalid refresh token', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          refresh_token: 'invalid-refresh-token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await authService.refreshToken();

      expect(result).toBe(false);
    });

    it('refreshToken() fails on backend error', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          refresh_token: 'valid-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await authService.refreshToken();

      expect(result).toBe(false);
    });

    it('refreshToken() logs out on failure', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'old-access',
          refresh_token: 'bad-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      await authService.refreshToken();

      // Verify logout was called (data cleared)
      expect(chrome.storage.local.remove).toHaveBeenCalled();
      expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalled();
    });

    it('refreshToken() updates stored tokens on success', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          refresh_token: 'valid-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 1800
        })
      });

      await authService.refreshToken();

      const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
      expect(setCalls.length).toBeGreaterThanOrEqual(2);

      // Verify new tokens were stored
      const allStoredData = setCalls.reduce((acc, [data]) => ({ ...acc, ...data }), {});
      expect(allStoredData.access_token).toBe('new-access');
      expect(allStoredData.refresh_token).toBe('new-refresh');
    });
  });

  describe('7. Token Storage', () => {
    it('stores all token fields correctly', async () => {
      // This is tested indirectly through authenticate() but let's verify storage structure
      const expiryTime = Date.now() + (900 * 1000);

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'access-123',
            refresh_token: 'refresh-123',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session-123'
          }
        })
      });

      await authService.authenticate();

      const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
      const storedData = setCalls.reduce((acc, [data]) => ({ ...acc, ...data }), {});

      expect(storedData.access_token).toBe('access-123');
      expect(storedData.refresh_token).toBe('refresh-123');
      expect(storedData.session_id).toBe('session-123');
      expect(storedData.token_expiry).toBeDefined();
    });

    it('retrieves token value by key', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'test-token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(false); // No expiry, so false
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['access_token'], expect.any(Function));
    });

    it('stores data to chrome.storage.local', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session'
          }
        })
      });

      await authService.authenticate();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('calculates token expiry correctly (Date.now() + expiresIn * 1000)', async () => {
      const beforeTime = Date.now();

      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session'
          }
        })
      });

      await authService.authenticate();

      const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
      const expiryCall = setCalls.find(call => call[0].token_expiry);

      expect(expiryCall).toBeDefined();

      const storedExpiry = parseInt(expiryCall![0].token_expiry);
      const afterTime = Date.now();

      // Should be roughly now + 900000ms (900 seconds)
      const expectedMin = beforeTime + (900 * 1000);
      const expectedMax = afterTime + (900 * 1000);

      expect(storedExpiry).toBeGreaterThanOrEqual(expectedMin);
      expect(storedExpiry).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('8. User Storage', () => {
    it('stores user info correctly', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: mockUser,
            access_token: 'token',
            refresh_token: 'refresh',
            token_type: 'Bearer',
            expires_in: 900,
            session_id: 'session'
          }
        })
      });

      await authService.authenticate();

      const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
      const userCall = setCalls.find(call => call[0].user_info);

      expect(userCall).toBeDefined();
      expect(userCall![0].user_info).toEqual(mockUser);
    });

    it('retrieves user info correctly', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'token',
          token_expiry: (Date.now() + 900000).toString(),
          user_info: mockUser
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      await authService.initialize();

      const state = authService.getAuthState();
      expect(state.user).toEqual(mockUser);
    });
  });

  describe('9. Auth Header', () => {
    it('getAuthHeader() returns Authorization header when authenticated', async () => {
      const expiryTime = Date.now() + (900 * 1000);

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'valid-token',
          token_expiry: expiryTime.toString()
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const headers = await authService.getAuthHeader();

      expect(headers).toEqual({
        'Authorization': 'Bearer valid-token'
      });
    });

    it('getAuthHeader() returns empty object when not authenticated', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const headers = await authService.getAuthHeader();

      expect(headers).toEqual({});
    });

    it('getAuthHeader() refreshes token if expired', async () => {
      const expiredTime = Date.now() - 1000;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'expired-token',
          token_expiry: expiredTime.toString(),
          refresh_token: 'valid-refresh'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 900
        })
      });

      await authService.getAuthHeader();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/refresh',
        expect.any(Object)
      );
    });
  });

  describe('10. Logout', () => {
    it('logout() revokes chrome token', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'stored-token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      await authService.logout();

      expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
        { token: 'stored-token' },
        expect.any(Function)
      );
    });

    it('logout() calls backend logout endpoint', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      await authService.logout();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/logout',
        { method: 'DELETE' }
      );
    });

    it('logout() clears all stored data', async () => {
      await authService.logout();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'access_token',
        'refresh_token',
        'token_expiry',
        'user_info'
      ], expect.any(Function));
    });

    it('logout() resets auth state', async () => {
      // Set up authenticated state first
      authService.setAuthState({
        isAuthenticated: true,
        user: mockUser,
        error: null
      });

      await authService.logout();

      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
    });

    it('logout() handles network errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {
          access_token: 'token'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(authService.logout()).resolves.not.toThrow();

      // Should still clear data
      expect(chrome.storage.local.remove).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles null token from Chrome Identity API', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback(null);
        (chrome.runtime as any).lastError = null;
        return Promise.resolve(null);
      });

      const result = await authService.authenticate();

      expect(result).toBe(false);
    });

    it('handles malformed backend response', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      const result = await authService.authenticate();

      expect(result).toBe(false);
    });

    it('handles network error during token exchange', async () => {
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation((params, callback) => {
        if (callback) callback('google-token');
        return Promise.resolve('google-token');
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await authService.authenticate();

      expect(result).toBe(false);
      const state = authService.getAuthState();
      expect(state.error).toBeTruthy();
    });

    it('handles missing refresh token during refresh', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        const result: Record<string, any> = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      });

      const result = await authService.refreshToken();

      expect(result).toBe(false);
    });
  });
});
