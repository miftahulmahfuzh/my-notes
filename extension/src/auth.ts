/**
 * Authentication Service for Silence Notes Chrome Extension
 * Handles Google OAuth using Chrome Identity API and token management
 */

// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
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
}

// Storage Keys
const STORAGE_KEYS = {
  AUTH_STATE: 'auth_state',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRY: 'token_expiry',
  USER_INFO: 'user_info'
} as const;

/**
 * Authentication Service Class
 */
class AuthService {
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

    if (!token || !expiry) {
      return false;
    }

    // Check if token is expired
    if (Date.now() >= parseInt(expiry)) {
      // Try to refresh token
      const refreshed = await this.refreshToken();
      return refreshed;
    }

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
    try {
      // First, we need to get a one-time authorization code from Google
      // For Chrome extensions, we use the token directly in some cases,
      // but let's try to use the standard OAuth flow first

      const response = await fetch('http://localhost:8080/api/v1/auth/chrome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: googleToken // Chrome Identity API token
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        expiresIn: data.expires_in
      };
    } catch (error) {
      console.error('Token exchange failed:', error);
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

      const response = await fetch('http://localhost:8080/api/v1/auth/refresh', {
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

      // Update stored tokens
      await this.storeToken(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
      await this.storeToken(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);

      const expiryTime = Date.now() + (data.expires_in * 1000);
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
      await fetch('http://localhost:8080/api/v1/auth/logout', {
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

    if (isAuth) {
      const token = await this.getStoredToken(STORAGE_KEYS.ACCESS_TOKEN);
      return {
        'Authorization': `Bearer ${token}`
      };
    }

    return {};
  }

  /**
   * Storage helper methods
   */
  private async storeTokens(authResponse: AuthResponse): Promise<void> {
    await this.storeToken(STORAGE_KEYS.ACCESS_TOKEN, authResponse.accessToken);
    await this.storeToken(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);

    const expiryTime = Date.now() + (authResponse.expiresIn * 1000);
    await this.storeToken(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
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