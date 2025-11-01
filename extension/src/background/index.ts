/**
 * Background script for Silence Notes Chrome Extension
 */

import { AuthService, setupAuthMessageHandler } from '../services/auth';
import { AuthStorage } from '../utils/storage';

/**
 * Initialize background script
 */
async function initializeBackground(): Promise<void> {
  try {
    console.log('Silence Notes: Background script initializing...');

    // Initialize authentication service
    const authService = AuthService.getInstance();
    await authService.initialize();

    // Setup message handlers
    setupAuthMessageHandler();

    // Setup token refresh alarm
    setupTokenRefreshAlarm();

    // Setup extension install/update handlers
    chrome.runtime.onInstalled.addListener(handleInstallOrUpdate);

    // Listen for extension startup
    chrome.runtime.onStartup.addListener(handleStartup);

    console.log('Silence Notes: Background script initialized successfully');

  } catch (error) {
    console.error('Silence Notes: Failed to initialize background script:', error);
  }
}

/**
 * Handle extension installation or update
 */
async function handleInstallOrUpdate(details: chrome.runtime.OnInstalledDetailsType): Promise<void> {
  try {
    if (details.reason === 'install') {
      console.log('Silence Notes: Extension installed');

      // Initialize default settings
      await initializeDefaultSettings();

      // Optionally open welcome page
      if (process.env.NODE_ENV === 'development') {
        chrome.tabs.create({
          url: chrome.runtime.getURL('welcome.html')
        });
      }
    } else if (details.reason === 'update') {
      console.log(`Silence Notes: Extension updated to version ${chrome.runtime.getManifest().version}`);

      // Handle migration if needed
      await handleExtensionUpdate(details.previousVersion);
    }
  } catch (error) {
    console.error('Silence Notes: Failed to handle install/update:', error);
  }
}

/**
 * Handle extension startup
 */
async function handleStartup(): Promise<void> {
  try {
    console.log('Silence Notes: Extension started');

    // Check authentication state
    const authService = AuthService.getInstance();
    const authState = await authService.initialize();

    if (authState.isAuthenticated) {
      // Setup token refresh alarm for authenticated users
      setupTokenRefreshAlarm();
    }

    // Clean up expired data
    await cleanupExpiredData();

  } catch (error) {
    console.error('Silence Notes: Failed to handle startup:', error);
  }
}

/**
 * Setup periodic token refresh alarm
 */
function setupTokenRefreshAlarm(): void {
  // Clear existing alarms
  chrome.alarms.clearAll(() => {
    // Create alarm to check tokens every 30 minutes
    chrome.alarms.create('tokenRefreshCheck', {
      delayInMinutes: 30,
      periodInMinutes: 30
    });
  });

  // Listen for alarm events
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'tokenRefreshCheck') {
      await handleTokenRefreshCheck();
    }
  });
}

/**
 * Handle periodic token refresh check
 */
async function handleTokenRefreshCheck(): Promise<void> {
  try {
    const authService = AuthService.getInstance();
    const tokens = await AuthStorage.getTokens();

    if (tokens && await AuthStorage.shouldRefreshTokens()) {
      console.log('Silence Notes: Refreshing access token');

      const newTokens = await authService.refreshTokens(tokens.refreshToken);

      if (!newTokens) {
        console.warn('Silence Notes: Token refresh failed, user may need to re-authenticate');

        // Clear auth state and notify user
        await authService.logout();

        // Optionally show notification
        chrome.notifications.create('auth-expired', {
          type: 'basic',
          iconUrl: 'assets/icon48.png',
          title: 'Silence Notes - Session Expired',
          message: 'Please sign in again to continue using Silence Notes.'
        });
      }
    }
  } catch (error) {
    console.error('Silence Notes: Token refresh check failed:', error);
  }
}

/**
 * Initialize default settings
 */
async function initializeDefaultSettings(): Promise<void> {
  try {
    // Check if settings already exist
    const existingSettings = await chrome.storage.sync.get(['settings']);

    if (!existingSettings.settings) {
      const defaultSettings = {
        theme: 'light',
        language: 'en',
        autoSync: true,
        syncInterval: 30,
        showNotifications: true
      };

      await chrome.storage.sync.set({ settings: defaultSettings });
      console.log('Silence Notes: Default settings initialized');
    }
  } catch (error) {
    console.error('Silence Notes: Failed to initialize default settings:', error);
  }
}

/**
 * Handle extension update and migration
 */
async function handleExtensionUpdate(previousVersion?: string): Promise<void> {
  try {
    if (!previousVersion) return;

    console.log(`Silence Notes: Migrating from version ${previousVersion}`);

    // Add migration logic here as needed
    // For example, clearing old storage keys, updating data structures, etc.

    // Example: Clear old auth state if coming from very old version
    if (previousVersion.startsWith('0.') || previousVersion.startsWith('1.0')) {
      await AuthStorage.clearAuth();
      console.log('Silence Notes: Cleared old auth state during update');
    }

  } catch (error) {
    console.error('Silence Notes: Failed to handle extension update:', error);
  }
}

/**
 * Clean up expired data
 */
async function cleanupExpiredData(): Promise<void> {
  try {
    // Clean up expired OAuth states
    const oauthData = await AuthStorage.getOAuthState();
    if (oauthData) {
      const isExpired = Date.now() - oauthData.timestamp > 5 * 60 * 1000; // 5 minutes
      if (isExpired) {
        await AuthStorage.clearOAuthState();
        console.log('Silence Notes: Cleaned up expired OAuth state');
      }
    }

    // Add other cleanup tasks as needed
  } catch (error) {
    console.error('Silence Notes: Failed to cleanup expired data:', error);
  }
}

/**
 * Handle extension context invalidation
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('Silence Notes: Background script suspending');
});

/**
 * Handle extension context invalidation (for Manifest V3)
 */
chrome.runtime.onSuspendCanceled?.addListener(() => {
  console.log('Silence Notes: Background script suspension canceled');
});

// Initialize the background script
initializeBackground().catch((error) => {
  console.error('Silence Notes: Critical error during background initialization:', error);
});