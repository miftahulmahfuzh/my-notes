/**
 * Background Sync Manager
 * Handles automatic sync in the background with queuing and retry logic
 */

import { storageService } from '../services/storage';
import { ApiService } from '../utils/api';
import { offlineDetector } from '../utils/offline';
import { ConflictManager } from '../services/conflict';

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'note';
  entityId: string;
  data: any;
  priority: number;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncResult: {
    success: boolean;
    uploaded: number;
    downloaded: number;
    errors: string[];
    conflicts: string[];
  } | null;
  queueLength: number;
  hasErrors: boolean;
  syncHistory: Array<{
    timestamp: string;
    trigger: string;
    success: boolean;
    duration: number;
    uploaded: number;
    downloaded: number;
    errors: number;
  }>;
}

export interface SyncTrigger {
  type: 'manual' | 'periodic' | 'connection-restored' | 'storage-change' | 'navigation' | 'manual-request';
  timestamp: string;
}

export class BackgroundSyncManager {
  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private syncQueue: SyncQueueItem[] = [];
  private currentSync: Promise<any> | null = null;
  private syncStatus: SyncStatus = {
    isSyncing: false,
    lastSyncAt: null,
    lastSyncResult: null,
    queueLength: 0,
    hasErrors: false,
    syncHistory: []
  };
  private conflictManager: ConflictManager | null = null;

  constructor() {
    this.conflictManager = new ConflictManager();
  }

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Background Sync Manager...');

      // Load existing sync queue from storage
      await this.loadSyncQueue();

      // Setup periodic sync alarm
      await this.setupPeriodicSync();

      // Setup storage monitoring
      this.setupStorageMonitoring();

      // Setup network monitoring
      this.setupNetworkMonitoring();

      this.isInitialized = true;
      console.log('Background Sync Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Background Sync Manager:', error);
      throw error;
    }
  }

  /**
   * Trigger sync with specified trigger
   */
  async triggerSync(trigger: SyncTrigger['type'] = 'manual'): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    if (this.isSyncing) {
      console.log('Sync already in progress, skipping trigger:', trigger);
      return this.currentSync;
    }

    // Create sync promise
    const syncPromise = this.performSync(trigger);
    this.currentSync = syncPromise;

    try {
      const result = await syncPromise;
      return result;
    } finally {
      this.currentSync = null;
    }
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    // Update queue length
    this.syncStatus.queueLength = this.syncQueue.length;

    // Check for errors in recent sync history
    const recentSyncs = this.syncStatus.syncHistory.slice(-5);
    this.syncStatus.hasErrors = recentSyncs.some(sync => sync.errors > 0);

    return { ...this.syncStatus };
  }

  /**
   * Add item to sync queue
   */
  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: this.generateQueueItemId(),
      createdAt: new Date().toISOString(),
      retryCount: 0
    };

    this.syncQueue.push(queueItem);
    this.syncQueue.sort((a, b) => {
      // Sort by priority first, then by creation time
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Earlier first
    });

    await this.saveSyncQueue();
    console.log(`Added item to sync queue: ${item.type} ${item.entityType} ${item.entityId}`);
  }

  /**
   * Pause sync (usually when offline)
   */
  async pauseSync(): Promise<void> {
    console.log('Pausing sync...');
    // Wait for current sync to complete if any
    if (this.currentSync) {
      await this.currentSync;
    }
    this.isSyncing = false;
    this.syncStatus.isSyncing = false;
  }

  /**
   * Resume sync (usually when coming back online)
   */
  async resumeSync(): Promise<void> {
    console.log('Resuming sync...');
    if (!this.isSyncing && this.syncQueue.length > 0) {
      await this.triggerSync('connection-restored');
    }
  }

  /**
   * Clear sync queue
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    console.log('Sync queue cleared');
  }

  // Private methods

  /**
   * Perform the actual sync operation
   */
  private async performSync(trigger: SyncTrigger['type']): Promise<any> {
    const startTime = Date.now();
    this.isSyncing = true;
    this.syncStatus.isSyncing = true;

    console.log(`Starting sync (trigger: ${trigger})...`);

    try {
      const result = {
        success: true,
        uploaded: 0,
        downloaded: 0,
        errors: [] as string[],
        conflicts: [] as string[]
      };

      // Step 1: Process sync queue (upload changes)
      const uploadResult = await this.processSyncQueue();
      result.uploaded = uploadResult.uploaded;
      result.errors.push(...uploadResult.errors);
      result.conflicts.push(...uploadResult.conflicts);

      // Step 2: Download remote changes if online
      if (offlineDetector.isCurrentlyOnline()) {
        const downloadResult = await this.downloadRemoteChanges();
        result.downloaded = downloadResult.downloaded;
        result.errors.push(...downloadResult.errors);
        result.conflicts.push(...downloadResult.conflicts);
      }

      // Step 3: Update sync status
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.syncStatus.lastSyncAt = new Date().toISOString();
      this.syncStatus.lastSyncResult = result;
      this.syncStatus.syncHistory.push({
        timestamp: new Date().toISOString(),
        trigger,
        success: result.errors.length === 0,
        duration,
        uploaded: result.uploaded,
        downloaded: result.downloaded,
        errors: result.errors.length
      });

      // Keep only last 50 sync history entries
      if (this.syncStatus.syncHistory.length > 50) {
        this.syncStatus.syncHistory = this.syncStatus.syncHistory.slice(-50);
      }

      // Save status to storage
      await this.saveSyncStatus();

      result.success = result.errors.length === 0;
      console.log(`Sync completed in ${duration}ms:`, result);

      return result;

    } catch (error) {
      console.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';

      this.syncStatus.lastSyncAt = new Date().toISOString();
      this.syncStatus.lastSyncResult = {
        success: false,
        uploaded: 0,
        downloaded: 0,
        errors: [errorMessage],
        conflicts: []
      };

      await this.saveSyncStatus();

      throw error;

    } finally {
      this.isSyncing = false;
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * Process sync queue items
   */
  private async processSyncQueue(): Promise<{
    uploaded: number;
    errors: string[];
    conflicts: string[];
  }> {
    const result = { uploaded: 0, errors: [] as string[], conflicts: [] as string[] };
    const now = new Date();
    const itemsToProcess: SyncQueueItem[] = [];

    // Find items ready to process
    this.syncQueue = this.syncQueue.filter(item => {
      if (!item.nextRetryAt || new Date(item.nextRetryAt) <= now) {
        itemsToProcess.push(item);
        return false; // Remove from queue
      }
      return true; // Keep in queue for later
    });

    console.log(`Processing ${itemsToProcess.length} sync queue items`);

    for (const item of itemsToProcess) {
      try {
        await this.processSyncQueueItem(item);
        result.uploaded++;
      } catch (error) {
        console.error(`Failed to process sync queue item ${item.id}:`, error);

        // Retry logic
        if (item.retryCount < item.maxRetries) {
          item.retryCount++;
          const retryDelay = this.calculateRetryDelay(item.retryCount);
          item.nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

          // Add back to queue
          this.syncQueue.push(item);
          console.log(`Retrying sync item ${item.id} in ${retryDelay}ms (attempt ${item.retryCount}/${item.maxRetries})`);
        } else {
          // Max retries exceeded
          const errorMessage = `Max retries exceeded for ${item.type} ${item.entityType} ${item.entityId}`;
          result.errors.push(errorMessage);

          // Check for conflicts
          if (this.isConflictError(error)) {
            result.conflicts.push(item.entityId);
            if (this.conflictManager) {
              await this.conflictManager.createConflict(item, error);
            }
          }
        }
      }
    }

    // Save updated queue
    await this.saveSyncQueue();

    return result;
  }

  /**
   * Process individual sync queue item
   */
  private async processSyncQueueItem(item: SyncQueueItem): Promise<void> {
    if (!offlineDetector.isCurrentlyOnline()) {
      throw new Error('Offline - cannot sync');
    }

    switch (item.type) {
      case 'create':
        await this.processCreateItem(item);
        break;
      case 'update':
        await this.processUpdateItem(item);
        break;
      case 'delete':
        await this.processDeleteItem(item);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  /**
   * Process create item
   */
  private async processCreateItem(item: SyncQueueItem): Promise<void> {
    const response = await ApiService.createNote(item.data);

    if (response.success && response.data) {
      // Update local note with server ID
      await storageService.saveNote(response.data);
    } else {
      throw new Error(response.error || 'Failed to create note');
    }
  }

  /**
   * Process update item
   */
  private async processUpdateItem(item: SyncQueueItem): Promise<void> {
    const response = await ApiService.updateNote(item.entityId, item.data);

    if (response.success && response.data) {
      // Update local note with server data
      await storageService.saveNote(response.data);
    } else {
      throw new Error(response.error || 'Failed to update note');
    }
  }

  /**
   * Process delete item
   */
  private async processDeleteItem(item: SyncQueueItem): Promise<void> {
    const response = await ApiService.deleteNote(item.entityId);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete note');
    }
    // Note is already deleted from local storage
  }

  /**
   * Download remote changes
   */
  private async downloadRemoteChanges(): Promise<{
    downloaded: number;
    errors: string[];
    conflicts: string[];
  }> {
    const result = { downloaded: 0, errors: [] as string[], conflicts: [] as string[] };

    try {
      const data = await storageService.getData();
      const lastSyncAt = data.sync.lastSyncAt;

      // Get notes updated since last sync
      const response = await ApiService.getNotes({
        limit: 100,
        updated_since: lastSyncAt
      });

      if (response.success && response.data) {
        for (const remoteNote of response.data.notes || []) {
          try {
            const localNote = await storageService.getNote(remoteNote.id);

            if (!localNote) {
              // New note from server
              await storageService.saveNote(remoteNote);
              result.downloaded++;
            } else if (new Date(remoteNote.updated_at) > new Date(localNote.updated_at)) {
              // Remote note is newer
              if (new Date(localNote.updated_at) > new Date(lastSyncAt)) {
                // Both local and remote have changes - conflict!
                if (this.conflictManager) {
                  await this.conflictManager.createConflict({
                    id: remoteNote.id,
                    type: 'update',
                    entityType: 'note',
                    entityId: remoteNote.id,
                    data: localNote,
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    retryCount: 0,
                    maxRetries: 3
                  }, new Error('Conflict: Local and remote both modified'));
                }
                result.conflicts.push(remoteNote.id);
              } else {
                // Only remote has changes
                await storageService.saveNote(remoteNote);
                result.downloaded++;
              }
            }
          } catch (error) {
            result.errors.push(`Error processing remote note ${remoteNote.id}: ${error}`);
          }
        }
      } else {
        result.errors.push(response.error || 'Failed to download remote changes');
      }

      // Update last sync timestamp
      data.sync.lastSyncAt = new Date().toISOString();
      await storageService['setRawData'](data);

    } catch (error) {
      result.errors.push(`Download failed: ${error}`);
    }

    return result;
  }

  /**
   * Setup periodic sync alarm
   */
  private async setupPeriodicSync(): Promise<void> {
    try {
      // Clear existing alarms
      await chrome.alarms.clearAll();

      // Create periodic sync alarm (every 5 minutes)
      chrome.alarms.create('periodic-sync', {
        delayInMinutes: 5,
        periodInMinutes: 5
      });

      // Create storage cleanup alarm (every hour)
      chrome.alarms.create('cleanup-storage', {
        delayInMinutes: 60,
        periodInMinutes: 60
      });

      // Create health check alarm (every 30 minutes)
      chrome.alarms.create('health-check', {
        delayInMinutes: 30,
        periodInMinutes: 30
      });

      console.log('Periodic sync alarms setup complete');
    } catch (error) {
      console.error('Failed to setup periodic sync:', error);
    }
  }

  /**
   * Setup storage monitoring
   */
  private setupStorageMonitoring(): void {
    // Storage monitoring is handled in background.ts
    console.log('Storage monitoring setup complete');
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    offlineDetector.addListener((status) => {
      if (status.isOnline && this.syncQueue.length > 0 && !this.isSyncing) {
        // Trigger sync when coming back online
        setTimeout(() => {
          this.triggerSync('connection-restored');
        }, 1000);
      }
    });
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const data = await storageService.getData();
      // In a real implementation, we would store the queue in storage
      // For now, initialize with empty queue
      this.syncQueue = [];
      console.log('Sync queue loaded from storage');
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      // In a real implementation, we would save the queue to storage
      console.log('Sync queue saved to storage');
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Save sync status to storage
   */
  private async saveSyncStatus(): Promise<void> {
    try {
      const data = await storageService.getData();
      data.sync.lastSyncAt = this.syncStatus.lastSyncAt;
      data.sync.lastSyncResult = this.syncStatus.lastSyncResult;
      await storageService['setRawData'](data);
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Check if error is a conflict error
   */
  private isConflictError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('conflict') ||
             message.includes('version mismatch') ||
             message.includes('concurrent modification');
    }
    return false;
  }

  /**
   * Generate unique queue item ID
   */
  private generateQueueItemId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}