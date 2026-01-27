/**
 * Authentication Service for Silence Notes Chrome Extension
 * Handles Google OAuth using Chrome Identity API and token management
 */

import { CONFIG } from './utils/config';

// Authentication Types
export interface User {
  id: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  session_id: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  sessionId: string;
}

// Storage Keys
const STORAGE_KEYS = {
  AUTH_STATE: 'auth_state',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRY: 'token_expiry',
  SESSION_ID: 'session_id',
  USER_INFO: 'user_info'
} as const;

/**
 * Authentication Service Class
 */
export class AuthService {
  private static instance: AuthService;
  private authState: AuthState;
  private listeners: Set<(state: AuthState) => void> = new Set();

  private constructor() {
    this.authState = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update auth state and notify listeners
   */
  setAuthState(updates: Partial<AuthState>): void {
    this.authState = { ...this.authState, ...updates };
    this.listeners.forEach(listener => listener({ ...this.authState }));
  }

  /**
   * Check if user is authenticated and token is valid
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredToken(STORAGE_KEYS.ACCESS_TOKEN);
    const expiry = await this.getStoredToken(STORAGE_KEYS.TOKEN_EXPIRY);

    console.log('[Auth] isAuthenticated - token exists:', !!token);
    console.log('[Auth] isAuthenticated - expiry exists:', !!expiry);

    if (!token || !expiry) {
      console.log('[Auth] isAuthenticated: false - missing token or expiry');
      return false;
    }

    // Check if token is expired
    const now = Date.now();
    const expiryTime = parseInt(expiry);
    console.log('[Auth] isAuthenticated - now:', now);
    console.log('[Auth] isAuthenticated - expiry:', expiryTime);
    console.log('[Auth] isAuthenticated - expired:', now >= expiryTime);

    if (now >= expiryTime) {
      console.log('[Auth] isAuthenticated: token expired, attempting refresh');
      // Try to refresh token
      const refreshed = await this.refreshToken();
      console.log('[Auth] isAuthenticated: refresh result:', refreshed);
      return refreshed;
    }

    console.log('[Auth] isAuthenticated: true - token valid');
    return true;
  }

  /**
   * Initialize authentication service
   */
  async initialize(): Promise<AuthState> {
    this.setAuthState({ isLoading: true });

    try {
      const isAuth = await this.isAuthenticated();

      if (isAuth) {
        const user = await this.getStoredUser();
        this.setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null
        });
      } else {
        this.setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
      }
    } catch (error) {
      this.setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Failed to initialize authentication'
      });
    }

    return this.getAuthState();
  }

  /**
   * Authenticate with Google using Chrome Identity API
   */
  async authenticate(): Promise<boolean> {
    this.setAuthState({ isLoading: true, error: null });

    try {
      // Get OAuth token using Chrome Identity API
      const token = await this.getAuthToken();

      if (!token) {
        throw new Error('Failed to obtain OAuth token');
      }

      // Exchange token with backend
      const authResponse = await this.exchangeTokenForAuth(token);

      if (authResponse) {
        // Store tokens and user info
        await this.storeTokens(authResponse);
        await this.storeUser(authResponse.user);

        this.setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: authResponse.user,
          error: null
        });

        return true;
      } else {
        throw new Error('Failed to exchange token with backend');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage
      });
      return false;
    }
  }

  /**
   * Get OAuth token from Chrome Identity API
   */
  private async getAuthToken(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({
        interactive: true,
        scopes: ['openid', 'email', 'profile']
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('No token received'));
        }
      });
    });
  }

  /**
   * Exchange Google OAuth token for backend auth tokens
   */
  private async exchangeTokenForAuth(googleToken: string): Promise<AuthResponse | null> {
    const authUrl = `${CONFIG.API_BASE_URL}/api/v1/auth/chrome`;
    console.log('[Auth] === Starting token exchange ===');
    console.log('[Auth] CONFIG.API_BASE_URL:', CONFIG.API_BASE_URL);
    console.log('[Auth] Full URL:', authUrl);
    console.log('[Auth] Has google token:', !!googleToken);

    try {
      const requestBody = {
        token: googleToken
      };
      console.log('[Auth] Request body keys:', Object.keys(requestBody));

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[Auth] Response status:', response.status);
      console.log('[Auth] Response ok:', response.ok);
      console.log('[Auth] Response statusText:', response.statusText);

      if (!response.ok) {
        let errorText = '';
        let errorJson = null;
        try {
          errorText = await response.text();
          console.log('[Auth] Error response body (raw):', errorText);
          try {
            errorJson = JSON.parse(errorText);
            console.log('[Auth] Error response (parsed):', JSON.stringify(errorJson, null, 2));
          } catch {
            // Not JSON, use raw text
          }
        } catch (e) {
          console.log('[Auth] Could not read error response body');
        }

        const errorMessage = errorJson?.error?.message || errorJson?.error || errorText || `HTTP ${response.status}`;
        throw new Error(`Auth failed: ${errorMessage}`);
      }

      const responseText = await response.text();
      console.log('[Auth] Success response body (raw):', responseText);

      const data = JSON.parse(responseText);
      console.log('[Auth] Parsed response keys:', Object.keys(data));

      // The backend wraps responses in APIResponse format: { success: true, data: {...} }
      const responseData = data.success ? data.data : data;

      console.log('[Auth] Response data keys:', Object.keys(responseData));

      // Validate required fields exist in response
      if (!responseData.user || !responseData.access_token || !responseData.refresh_token) {
        console.error('[Auth] Invalid response - missing fields:', {
          hasUser: !!responseData.user,
          hasAccessToken: !!responseData.access_token,
          hasRefreshToken: !!responseData.refresh_token
        });
        return null;
      }

      const authResponse = {
        user: responseData.user,
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token,
        tokenType: responseData.token_type,
        expiresIn: responseData.expires_in,
        sessionId: responseData.session_id
      };

      console.log('[Auth] === Token exchange successful ===');
      console.log('[Auth] User email:', authResponse.user?.email);
      console.log('[Auth] Session ID:', authResponse.sessionId);

      return authResponse;
    } catch (error) {
      console.log('[Auth] === Token exchange FAILED ===');
      console.log('[Auth] Error type:', error?.constructor?.name || typeof error);
      console.log('[Auth] Error name:', (error as Error)?.name);
      console.log('[Auth] Error message:', (error as Error)?.message);
      console.log('[Auth] Error toString():', String(error));
      console.log('[Auth] Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getStoredToken(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        await this.logout();
        return false;
      }

      const data = await response.json();

      // The backend wraps responses in APIResponse format: { success: true, data: {...} }
      const responseData = data.success ? data.data : data;

      // Update stored tokens
      await this.storeToken(STORAGE_KEYS.ACCESS_TOKEN, responseData.access_token);
      await this.storeToken(STORAGE_KEYS.REFRESH_TOKEN, responseData.refresh_token);

      const expiryTime = Date.now() + (responseData.expires_in * 1000);
      await this.storeToken(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
      return false;
    }
  }

  /**
   * Logout user and clear tokens
   */
  async logout(): Promise<void> {
    try {
      // Revoke Chrome token
      const token = await this.getStoredToken(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        chrome.identity.removeCachedAuthToken({ token: token }, () => {});
      }

      // Call backend logout if possible
      await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/logout`, {
        method: 'DELETE'
      }).catch(() => {
        // Ignore logout errors
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all stored data
      await this.clearStoredData();

      this.setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
      });
    }
  }

  /**
   * Get authorization header for API requests
   */
  async getAuthHeader(): Promise<Record<string, string>> {
    const isAuth = await this.isAuthenticated();
    console.log('[Auth] isAuthenticated:', isAuth);

    if (isAuth) {
      const token = await this.getStoredToken(STORAGE_KEYS.ACCESS_TOKEN);
      console.log('[Auth] Retrieved token (first 10 chars):', token ? token.substring(0, 10) + '...' : 'null');

      if (token) {
        return {
          'Authorization': `Bearer ${token}`
        };
      } else {
        console.error('[Auth] isAuthenticated returned true but no token found');
      }
    } else {
      console.log('[Auth] User not authenticated, no auth header');
    }

    return {};
  }

  /**
   * Storage helper methods
   */
  private async storeTokens(authResponse: AuthResponse): Promise<void> {
    console.log('[Auth] Storing tokens...');
    console.log('[Auth] Access token (first 10 chars):', authResponse.accessToken ? authResponse.accessToken.substring(0, 10) + '...' : 'null');
    console.log('[Auth] Refresh token (first 10 chars):', authResponse.refreshToken ? authResponse.refreshToken.substring(0, 10) + '...' : 'null');
    console.log('[Auth] Session ID:', authResponse.sessionId);
    console.log('[Auth] Expires in:', authResponse.expiresIn, 'seconds');

    await this.storeToken(STORAGE_KEYS.ACCESS_TOKEN, authResponse.accessToken);
    await this.storeToken(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
    await this.storeToken(STORAGE_KEYS.SESSION_ID, authResponse.sessionId);

    const expiryTime = Date.now() + (authResponse.expiresIn * 1000);
    await this.storeToken(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());

    console.log('[Auth] Tokens and session stored successfully');
  }

  private async storeToken(key: string, value: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  private async getStoredToken(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  private async storeUser(user: User): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.USER_INFO]: user }, resolve);
    });
  }

  private async getStoredUser(): Promise<User | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.USER_INFO], (result) => {
        resolve(result[STORAGE_KEYS.USER_INFO] || null);
      });
    });
  }

  private async clearStoredData(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRY,
        STORAGE_KEYS.USER_INFO
      ], resolve);
    });
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;