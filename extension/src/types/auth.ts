/**
 * Authentication types for Silence Notes Chrome Extension
 */

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  timeZone: string;
  emailNotifications: boolean;
  autoSave: boolean;
  defaultNoteView: 'list' | 'grid';
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

export interface GoogleAuthResponse {
  authUrl: string;
  state: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export class AuthError extends Error {
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
  }
}

// Extension storage keys
export const STORAGE_KEYS = {
  AUTH_STATE: 'silence_notes_auth_state',
  USER_DATA: 'silence_notes_user_data',
  TOKENS: 'silence_notes_tokens',
  OAUTH_STATE: 'silence_notes_oauth_state',
  SETTINGS: 'silence_notes_settings'
} as const;

// Chrome extension messaging types
export interface AuthMessage {
  type: 'AUTH_START' | 'AUTH_CALLBACK' | 'AUTH_REFRESH' | 'AUTH_LOGOUT' | 'AUTH_CHECK';
  payload?: any;
}

export interface AuthResponseMessage {
  type: 'AUTH_SUCCESS' | 'AUTH_ERROR' | 'AUTH_STATE_CHANGED';
  payload: AuthState | AuthError;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}