/**
 * Background Script for Chrome Extension
 * Handles background sync, notifications, and extension lifecycle events
 */

import { BackgroundSyncManager } from './sync';
import { ConflictManager } from '../services/conflict';
import { storageService } from '../services/storage';
import { offlineDetector } from '../utils/offline';

// Initialize background services
let syncManager: BackgroundSyncManager;
let conflictManager: ConflictManager;

/**
 * Initialize background services
 */
async function initializeBackgroundServices(): Promise<void> {
  try {
    console.log('Initializing background services...');

    // Initialize storage and run migrations if needed
    const { storageMigrationManager } = await import('../utils/storage-migration');
    const needsMigration = await storageMigrationManager.needsMigration();

    if (needsMigration) {
      console.log('Running storage migrations in background...');
      await storageMigrationManager.migrate();
    }

    // Initialize sync manager
    syncManager = new BackgroundSyncManager();
    await syncManager.initialize();

    // Initialize conflict manager
    conflictManager = new ConflictManager();

    console.log('Background services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize background services:', error);
  }
}

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup - background script loaded');
  await initializeBackgroundServices();
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation - initializing...');
    await initializeBackgroundServices();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated - reinitializing...');
    await initializeBackgroundServices();
  }
});

/**
 * Handle extension browser action click (icon click)
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if we should open the popup or perform a quick action
    const settings = await storageService.getData().then(data => data.settings);

    if (settings.quickAction) {
      // Perform quick action (like quick note capture)
      await performQuickAction(tab);
    } else {
      // Open popup (default behavior)
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error('Failed to handle action click:', error);
  }
});

/**
 * Handle alarm events for periodic tasks
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);

  switch (alarm.name) {
    case 'periodic-sync':
      await performPeriodicSync();
      break;
    case 'cleanup-storage':
      await performStorageCleanup();
      break;
    case 'health-check':
      await performHealthCheck();
      break;
    default:
      console.log('Unknown alarm:', alarm.name);
  }
});

/**
 * Handle web navigation events
 */
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only handle main frame completions
  if (details.frameId === 0) {
    try {
      // Check if we should auto-sync based on navigation
      const settings = await storageService.getData().then(data => data.settings);

      if (settings.autoSyncNavigation && offlineDetector.isCurrentlyOnline()) {
        console.log('Triggering sync due to navigation');
        syncManager.triggerSync('navigation');
      }
    } catch (error) {
      console.error('Failed to handle navigation event:', error);
    }
  }
});

/**
 * Handle network state changes
 */
chrome.offline.addListener(async () => {
  console.log('Browser went offline');
  try {
    await syncManager.pauseSync();
  } catch (error) {
    console.error('Failed to pause sync on offline:', error);
  }
});

chrome.online.addListener(async () => {
  console.log('Browser came online');
  try {
    await syncManager.resumeSync();
    // Trigger sync when coming back online
    setTimeout(() => {
      syncManager.triggerSync('connection-restored');
    }, 1000);
  } catch (error) {
    console.error('Failed to resume sync on online:', error);
  }
});

/**
 * Handle extension messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Background script received message:', message.type);

  try {
    switch (message.type) {
      case 'SYNC_REQUEST':
        const syncResult = await syncManager.triggerSync('manual-request');
        sendResponse({ success: true, data: syncResult });
        break;

      case 'SYNC_STATUS':
        const status = await syncManager.getStatus();
        sendResponse({ success: true, data: status });
        break;

      case 'QUICK_NOTE':
        const noteResult = await createQuickNote(message.data);
        sendResponse({ success: true, data: noteResult });
        break;

      case 'CAPTURE_PAGE':
        const captureResult = await capturePageContent(sender.tab);
        sendResponse({ success: true, data: captureResult });
        break;

      case 'CONFLICT_RESOLVE':
        const conflictResult = await conflictManager.resolveConflict(
          message.data.conflictId,
          message.data.resolution
        );
        sendResponse({ success: true, data: conflictResult });
        break;

      case 'STORAGE_STATS':
        const stats = await storageService.getStorageStats();
        sendResponse({ success: true, data: stats });
        break;

      case 'HEALTH_CHECK':
        const health = await performHealthCheck();
        sendResponse({ success: true, data: health });
        break;

      case 'PING':
        sendResponse({ success: true, data: { pong: true, timestamp: Date.now() } });
        break;

      default:
        console.log('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }

  // Return true to indicate async response
  return true;
});

/**
 * Handle browser storage changes
 */
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    console.log('Local storage changed:', Object.keys(changes));

    // Check if notes were changed and trigger sync if needed
    if (changes['silence_notes_data']) {
      const oldData = changes['silence_notes_data'].oldValue;
      const newData = changes['silence_notes_data'].newValue;

      // Compare note arrays to detect changes
      if (oldData && newData) {
        const oldNotes = oldData.notes || [];
        const newNotes = newData.notes || [];

        if (JSON.stringify(oldNotes) !== JSON.stringify(newNotes)) {
          console.log('Notes changed, triggering sync');
          syncManager.triggerSync('storage-change');
        }
      }
    }
  }
});

/**
 * Perform periodic sync
 */
async function performPeriodicSync(): Promise<void> {
  try {
    console.log('Performing periodic sync...');
    await syncManager.triggerSync('periodic');
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

/**
 * Perform storage cleanup
 */
async function performStorageCleanup(): Promise<void> {
  try {
    console.log('Performing storage cleanup...');

    const quotaInfo = await storageService.getQuotaInfo();
    console.log('Storage quota info:', quotaInfo);

    if (quotaInfo.isNearLimit) {
      console.log('Storage near limit, triggering cleanup');
      // Storage service automatically handles cleanup when quota is checked
      await storageService.getNotes(); // This will trigger cleanup if needed
    }
  } catch (error) {
    console.error('Storage cleanup failed:', error);
  }
}

/**
 * Perform health check
 */
async function performHealthCheck(): Promise<{
  status: 'healthy' | 'warning' | 'error';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  }>;
  timestamp: string;
}> {
  const checks = [];
  let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

  try {
    // Check storage integrity
    const { storageMigrationManager } = await import('../utils/storage-migration');
    const validation = await storageMigrationManager.validateData();
    checks.push({
      name: 'storage-integrity',
      status: validation.isValid ? 'pass' : 'fail',
      message: validation.isValid ? 'Storage data is valid' : `Issues: ${validation.errors.join(', ')}`
    });

    if (!validation.isValid) {
      overallStatus = 'error';
    } else if (validation.warnings.length > 0) {
      overallStatus = 'warning';
    }

    // Check network connectivity
    const isOnline = offlineDetector.isCurrentlyOnline();
    checks.push({
      name: 'network-connectivity',
      status: isOnline ? 'pass' : 'warning',
      message: isOnline ? 'Online' : 'Offline'
    });

    if (!isOnline && overallStatus === 'healthy') {
      overallStatus = 'warning';
    }

    // Check sync status
    const syncStatus = await syncManager.getStatus();
    checks.push({
      name: 'sync-status',
      status: syncStatus.hasErrors ? 'fail' : syncStatus.isSyncing ? 'warning' : 'pass',
      message: syncStatus.hasErrors ? 'Sync has errors' : syncStatus.isSyncing ? 'Sync in progress' : 'Sync healthy'
    });

    if (syncStatus.hasErrors) {
      overallStatus = 'error';
    }

    // Check storage quota
    const quotaInfo = await storageService.getQuotaInfo();
    checks.push({
      name: 'storage-quota',
      status: quotaInfo.isOverLimit ? 'fail' : quotaInfo.isNearLimit ? 'warning' : 'pass',
      message: quotaInfo.isOverLimit ? 'Over quota limit' : quotaInfo.isNearLimit ? 'Near quota limit' : 'Quota OK'
    });

    if (quotaInfo.isOverLimit) {
      overallStatus = 'error';
    } else if (quotaInfo.isNearLimit && overallStatus === 'healthy') {
      overallStatus = 'warning';
    }

  } catch (error) {
    console.error('Health check failed:', error);
    checks.push({
      name: 'health-check-error',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    overallStatus = 'error';
  }

  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create quick note from selected text
 */
async function createQuickNote(data: { content: string; url?: string; title?: string }): Promise<any> {
  try {
    const note = {
      title: data.title || 'Quick Note',
      content: data.content + (data.url ? `\n\nSource: ${data.url}` : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      user_id: 'temp'
    };

    const result = await storageService.saveNote(note);
    return result;
  } catch (error) {
    console.error('Failed to create quick note:', error);
    throw error;
  }
}

/**
 * Capture page content
 */
async function capturePageContent(tab: chrome.tabs.Tab | undefined): Promise<any> {
  if (!tab || !tab.id) {
    throw new Error('No valid tab provided');
  }

  try {
    // Inject content script to capture page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          title: document.title,
          url: window.location.href,
          selectedText: window.getSelection()?.toString() || '',
          pageContent: document.body.innerText?.substring(0, 1000) || ''
        };
      }
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    } else {
      throw new Error('Failed to capture page content');
    }
  } catch (error) {
    console.error('Failed to capture page content:', error);
    throw error;
  }
}

/**
 * Perform quick action based on settings
 */
async function performQuickAction(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!tab || !tab.id) {
    console.error('No valid tab for quick action');
    return;
  }

  try {
    // Capture selected text and create quick note
    const captureResult = await capturePageContent(tab);

    if (captureResult.selectedText) {
      await createQuickNote({
        content: captureResult.selectedText,
        url: captureResult.url,
        title: captureResult.title
      });

      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Silence Notes',
        message: 'Quick note created from selected text'
      });
    } else {
      // Open popup if no text selected
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error('Failed to perform quick action:', error);
  }
}

// Initialize on script load
initializeBackgroundServices().catch(error => {
  console.error('Failed to initialize background script:', error);
});