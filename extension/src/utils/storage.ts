/**
 * Chrome extension storage utilities for Silence Notes
 */

import { CONFIG, DEFAULT_USER_PREFERENCES } from './config';
import { AuthTokens, User, UserPreferences } from '../types/auth';

/**
 * Chrome Storage wrapper with error handling
 */
export class ExtensionStorage {
  /**
   * Get data from Chrome storage
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set data in Chrome storage
   */
  static async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove data from Chrome storage
   */
  static async remove(key: string): Promise<boolean> {
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove storage key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage data
   */
  static async clear(): Promise<boolean> {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get multiple storage keys
   */
  static async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const result = await chrome.storage.local.get(keys);
      const mapped: Record<string, T | null> = {};
      keys.forEach(key => {
        mapped[key] = result[key] || null;
      });
      return mapped;
    } catch (error) {
      console.error('Failed to get multiple storage keys:', error);
      const errorResult: Record<string, null> = {};
      keys.forEach(key => {
        errorResult[key] = null;
      });
      return errorResult as Record<string, T | null>;
    }
  }
}

/**
 * Authentication storage manager
 */
export class AuthStorage {
  /**
   * Save authentication tokens
   */
  static async saveTokens(tokens: AuthTokens): Promise<boolean> {
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.TOKENS, tokens);
  }

  /**
   * Get authentication tokens
   */
  static async getTokens(): Promise<AuthTokens | null> {
    return ExtensionStorage.get<AuthTokens>(CONFIG.STORAGE_KEYS.TOKENS);
  }

  /**
   * Save user data
   */
  static async saveUser(user: User): Promise<boolean> {
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.USER_DATA, user);
  }

  /**
   * Get user data
   */
  static async getUser(): Promise<User | null> {
    return ExtensionStorage.get<User>(CONFIG.STORAGE_KEYS.USER_DATA);
  }

  /**
   * Save authentication state
   */
  static async saveAuthState(isAuthenticated: boolean): Promise<boolean> {
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.AUTH_STATE, isAuthenticated);
  }

  /**
   * Get authentication state
   */
  static async getAuthState(): Promise<boolean | null> {
    return ExtensionStorage.get<boolean>(CONFIG.STORAGE_KEYS.AUTH_STATE);
  }

  /**
   * Save OAuth state for security verification
   */
  static async saveOAuthState(state: string): Promise<boolean> {
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.OAUTH_STATE, {
      state,
      timestamp: Date.now()
    });
  }

  /**
   * Get and verify OAuth state
   */
  static async getOAuthState(): Promise<{ state: string; timestamp: number } | null> {
    const oauthData = await ExtensionStorage.get<{ state: string; timestamp: number }>(
      CONFIG.STORAGE_KEYS.OAUTH_STATE
    );

    if (!oauthData) {
      return null;
    }

    // Check if state is expired (5 minutes)
    const isExpired = Date.now() - oauthData.timestamp > CONFIG.TIMEOUTS.AUTH_FLOW;
    if (isExpired) {
      await this.clearOAuthState();
      return null;
    }

    return oauthData;
  }

  /**
   * Clear OAuth state
   */
  static async clearOAuthState(): Promise<boolean> {
    return ExtensionStorage.remove(CONFIG.STORAGE_KEYS.OAUTH_STATE);
  }

  /**
   * Check if tokens are expired or need refresh
   */
  static async shouldRefreshTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) {
      return false;
    }

    const now = Date.now();
    const timeUntilExpiry = tokens.expiresAt - now;

    // Return true if token expires within the threshold
    return timeUntilExpiry <= CONFIG.TOKEN.REFRESH_THRESHOLD;
  }

  /**
   * Clear all authentication data
   */
  static async clearAuth(): Promise<boolean> {
    const keys = [
      CONFIG.STORAGE_KEYS.AUTH_STATE,
      CONFIG.STORAGE_KEYS.USER_DATA,
      CONFIG.STORAGE_KEYS.TOKENS,
      CONFIG.STORAGE_KEYS.OAUTH_STATE
    ];

    try {
      await chrome.storage.local.remove(keys);
      return true;
    } catch (error) {
      console.error('Failed to clear auth data:', error);
      return false;
    }
  }
}

/**
 * User preferences storage manager
 */
export class PreferencesStorage {
  /**
   * Get user preferences
   */
  static async getPreferences(): Promise<UserPreferences> {
    const preferences = await ExtensionStorage.get<UserPreferences>(CONFIG.STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_USER_PREFERENCES, ...preferences };
  }

  /**
   * Save user preferences
   */
  static async savePreferences(preferences: Partial<UserPreferences>): Promise<boolean> {
    const currentPreferences = await this.getPreferences();
    const updatedPreferences = { ...currentPreferences, ...preferences };
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.SETTINGS, updatedPreferences);
  }

  /**
   * Reset preferences to defaults
   */
  static async resetPreferences(): Promise<boolean> {
    return ExtensionStorage.set(CONFIG.STORAGE_KEYS.SETTINGS, DEFAULT_USER_PREFERENCES);
  }
}

// Legacy StorageService for backward compatibility
export class StorageService {
  // Notes storage
  static async getNotes(): Promise<any[]> {
    return ExtensionStorage.get<any[]>('notes') || [];
  }

  static async saveNotes(notes: any[]): Promise<void> {
    await ExtensionStorage.set('notes', notes);
  }

  static async addNote(note: any): Promise<void> {
    const notes = await this.getNotes();
    notes.push(note);
    await this.saveNotes(notes);
  }

  static async updateNote(id: string, updates: Partial<any>): Promise<void> {
    const notes = await this.getNotes();
    const index = notes.findIndex(note => note.id === id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updates, updated_at: new Date().toISOString() };
      await this.saveNotes(notes);
    }
  }

  static async deleteNote(id: string): Promise<void> {
    const notes = await this.getNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    await this.saveNotes(filteredNotes);
  }

  // Settings storage
  static async getSettings(): Promise<any> {
    return ExtensionStorage.get<any>('settings') || {
      autoSync: true,
      syncInterval: 30,
      theme: 'light'
    };
  }

  static async saveSettings(settings: any): Promise<void> {
    await ExtensionStorage.set('settings', settings);
  }

  // Clear all data
  static async clearAll(): Promise<void> {
    await ExtensionStorage.clear();
  }
}