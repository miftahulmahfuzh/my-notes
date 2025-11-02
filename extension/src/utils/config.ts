/**
 * Configuration constants for Silence Notes Chrome Extension
 */

export const CONFIG = {
  // API Configuration - Chrome extensions always use development URLs
  API_BASE_URL: 'http://localhost:8080/api/v1',

  // Google OAuth Configuration
  GOOGLE_OAUTH: {
    CLIENT_ID: '1019738114244-ml2i0sqpfauqpaq2568qgbhqmd4t881j.apps.googleusercontent.com',
    SCOPES: [
      'openid',
      'email',
      'profile'
    ],
    REDIRECT_URI: chrome.identity.getRedirectURL()
  },

  // Token Management
  TOKEN: {
    REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
  },

  // Storage Keys
  STORAGE_KEYS: {
    AUTH_STATE: 'silence_notes_auth_state',
    USER_DATA: 'silence_notes_user_data',
    TOKENS: 'silence_notes_tokens',
    OAUTH_STATE: 'silence_notes_oauth_state',
    SETTINGS: 'silence_notes_settings',
    LAST_SYNC: 'silence_notes_last_sync'
  },

  // Timeouts
  TIMEOUTS: {
    AUTH_FLOW: 5 * 60 * 1000, // 5 minutes
    TOKEN_REFRESH: 30 * 1000, // 30 seconds
    API_REQUEST: 10 * 1000 // 10 seconds
  }
} as const;

// Default user preferences
export const DEFAULT_USER_PREFERENCES = {
  theme: 'light' as const,
  language: 'en',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  emailNotifications: true,
  autoSave: true,
  defaultNoteView: 'grid' as const
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_REQUIRED: 'Authentication required. Please sign in.',
  INVALID_TOKEN: 'Invalid authentication token.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  OAUTH_ERROR: 'OAuth authentication failed.',
  STORAGE_ERROR: 'Failed to access local storage.',
  UNKNOWN_ERROR: 'An unknown error occurred.'
} as const;

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;