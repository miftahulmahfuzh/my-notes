/**
 * Authentication service for Silence Notes Chrome Extension
 */

import { CONFIG, ERROR_MESSAGES } from '../utils/config';
import { AuthStorage } from '../utils/storage';
import {
  AuthState,
  AuthTokens,
  User,
  AuthError,
  GoogleAuthResponse,
  RefreshTokenRequest,
  TokenRefreshResponse,
  AuthMessage,
  AuthResponseMessage
} from '../types/auth';

/**
 * Authentication service handling OAuth flow and token management
 */
export class AuthService {
  private static instance: AuthService;
  private authStateChangeListeners: ((authState: AuthState) => void)[] = [];

  private constructor() {}

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
   * Initialize authentication service and check existing auth state
   */
  async initialize(): Promise<AuthState> {
    try {
      const isAuthenticated = await AuthStorage.getAuthState();
      const user = await AuthStorage.getUser();
      const tokens = await AuthStorage.getTokens();

      // Validate tokens if they exist
      let validTokens = tokens;
      if (tokens && await AuthStorage.shouldRefreshTokens()) {
        validTokens = await this.refreshTokens(tokens.refreshToken);
        if (!validTokens) {
          // Token refresh failed, clear auth state
          await this.clearAuthState();
          return this.createAuthState(false, null, null, false);
        }
      }

      const authState = this.createAuthState(
        !!isAuthenticated && !!user && !!validTokens,
        user,
        validTokens,
        false
      );

      this.notifyAuthStateChange(authState);
      return authState;
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      return this.createAuthState(false, null, null, false, ERROR_MESSAGES.UNKNOWN_ERROR);
    }
  }

  /**
   * Start Google OAuth flow
   */
  async startGoogleAuth(): Promise<GoogleAuthResponse> {
    try {
      // Generate secure state parameter
      const state = this.generateSecureState();

      // Save state for verification
      await AuthStorage.saveOAuthState(state);

      // Get auth URL from backend
      const response = await this.apiRequest<GoogleAuthResponse>(
        '/auth/google',
        'POST',
        { redirect: chrome.identity.getRedirectURL() }
      );

      return response;
    } catch (error) {
      console.error('Failed to start Google auth:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Launch Google OAuth flow using Chrome Identity API
   */
  async launchGoogleOAuth(): Promise<void> {
    try {
      const authUrl = await this.getGoogleAuthUrl();

      // Launch OAuth flow in a popup/tab
      const responseUrl = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true
          },
          (responseUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(responseUrl);
            }
          }
        );
      });

      // Handle the OAuth callback
      await this.handleOAuthCallback(responseUrl);
    } catch (error) {
      console.error('Google OAuth flow failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get Google OAuth URL
   */
  private async getGoogleAuthUrl(): Promise<string> {
    try {
      const response = await this.apiRequest<GoogleAuthResponse>('/auth/google', 'POST');

      // Save the state for verification
      await AuthStorage.saveOAuthState(response.state);

      return response.authUrl;
    } catch (error) {
      console.error('Failed to get Google auth URL:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback from Google
   */
  private async handleOAuthCallback(responseUrl: string): Promise<void> {
    try {
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        throw new Error('Missing code or state in OAuth callback');
      }

      // Verify state
      const storedStateData = await AuthStorage.getOAuthState();
      if (!storedStateData || storedStateData.state !== state) {
        throw new Error('Invalid OAuth state');
      }

      // Clear OAuth state
      await AuthStorage.clearOAuthState();

      // Exchange code for tokens
      const authResponse = await this.apiRequest<any>('/auth/google/callback', 'POST', {
        code,
        state
      });

      // Save authentication data
      await this.saveAuthData(authResponse);

      // Notify listeners
      const authState = this.createAuthState(true, authResponse.user, {
        accessToken: authResponse.access_token,
        refreshToken: authResponse.refresh_token,
        tokenType: authResponse.token_type,
        expiresIn: authResponse.expires_in,
        expiresAt: Date.now() + (authResponse.expires_in * 1000)
      }, false);

      this.notifyAuthStateChange(authState);

    } catch (error) {
      console.error('OAuth callback handling failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Refresh access tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const response = await this.apiRequest<TokenRefreshResponse>(
        '/auth/refresh',
        'POST',
        { refresh_token: refreshToken }
      );

      const newTokens: AuthTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        tokenType: response.token_type,
        expiresIn: response.expires_in,
        expiresAt: Date.now() + (response.expires_in * 1000)
      };

      // Save new tokens
      await AuthStorage.saveTokens(newTokens);

      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const tokens = await AuthStorage.getTokens();

      if (tokens) {
        try {
          // Call backend logout endpoint
          await this.apiRequest('/auth/logout', 'POST', null, tokens.accessToken);
        } catch (error) {
          console.warn('Backend logout failed:', error);
        }
      }

      // Clear local auth data
      await this.clearAuthState();

      // Notify listeners
      const authState = this.createAuthState(false, null, null, false);
      this.notifyAuthStateChange(authState);

    } catch (error) {
      console.error('Logout failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const authState = await this.initialize();
      return authState.isAuthenticated;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    return AuthStorage.getUser();
  }

  /**
   * Get valid access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      let tokens = await AuthStorage.getTokens();

      if (!tokens) {
        return null;
      }

      // Check if token needs refresh
      if (await AuthStorage.shouldRefreshTokens()) {
        tokens = await this.refreshTokens(tokens.refreshToken);
        if (!tokens) {
          return null;
        }
      }

      return tokens.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChange(callback: (authState: AuthState) => void): () => void {
    this.authStateChangeListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authStateChangeListeners.indexOf(callback);
      if (index > -1) {
        this.authStateChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Make authenticated API request
   */
  async apiRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    token?: string
  ): Promise<T> {
    try {
      const url = `${CONFIG.API_BASE_URL}${endpoint}`;

      // Get token if not provided
      const accessToken = token || await this.getAccessToken();

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` })
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(CONFIG.TIMEOUTS.API_REQUEST)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Save authentication data to storage
   */
  private async saveAuthData(authResponse: any): Promise<void> {
    const tokens: AuthTokens = {
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      tokenType: authResponse.token_type,
      expiresIn: authResponse.expires_in,
      expiresAt: Date.now() + (authResponse.expires_in * 1000)
    };

    await Promise.all([
      AuthStorage.saveTokens(tokens),
      AuthStorage.saveUser(authResponse.user),
      AuthStorage.saveAuthState(true)
    ]);
  }

  /**
   * Clear authentication state
   */
  private async clearAuthState(): Promise<void> {
    await AuthStorage.clearAuth();
  }

  /**
   * Create auth state object
   */
  private createAuthState(
    isAuthenticated: boolean,
    user: User | null,
    tokens: AuthTokens | null,
    isLoading: boolean,
    error: string | null = null
  ): AuthState {
    return {
      isAuthenticated,
      user,
      tokens,
      isLoading,
      error
    };
  }

  /**
   * Notify all auth state change listeners
   */
  private notifyAuthStateChange(authState: AuthState): void {
    this.authStateChangeListeners.forEach(callback => {
      try {
        callback(authState);
      } catch (error) {
        console.error('Auth state change listener error:', error);
      }
    });
  }

  /**
   * Generate secure state parameter for OAuth
   */
  private generateSecureState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    const message = error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
    const code = error.code || 'UNKNOWN_ERROR';

    return {
      error: message,
      code,
      details: error
    };
  }
}

/**
 * Background script message handler for authentication
 */
export function setupAuthMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message: AuthMessage, sender, sendResponse) => {
    const authService = AuthService.getInstance();

    const handleMessage = async () => {
      try {
        switch (message.type) {
          case 'AUTH_START':
            await authService.launchGoogleOAuth();
            sendResponse({ type: 'AUTH_SUCCESS', payload: { success: true } });
            break;

          case 'AUTH_CHECK':
            const authState = await authService.initialize();
            sendResponse({ type: 'AUTH_SUCCESS', payload: authState });
            break;

          case 'AUTH_REFRESH':
            const tokens = await AuthStorage.getTokens();
            if (tokens) {
              const newTokens = await authService.refreshTokens(tokens.refreshToken);
              if (newTokens) {
                sendResponse({ type: 'AUTH_SUCCESS', payload: { success: true } });
              } else {
                sendResponse({ type: 'AUTH_ERROR', payload: { error: 'Token refresh failed' } });
              }
            } else {
              sendResponse({ type: 'AUTH_ERROR', payload: { error: 'No refresh token available' } });
            }
            break;

          case 'AUTH_LOGOUT':
            await authService.logout();
            sendResponse({ type: 'AUTH_SUCCESS', payload: { success: true } });
            break;

          default:
            throw new Error(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('Auth message handler error:', error);
        sendResponse({
          type: 'AUTH_ERROR',
          payload: {
            error: error.message || ERROR_MESSAGES.UNKNOWN_ERROR
          }
        });
      }
    };

    // Return true for async response
    handleMessage();
    return true;
  });
}

export default AuthService;