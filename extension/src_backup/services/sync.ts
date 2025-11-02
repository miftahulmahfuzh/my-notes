/**
 * Sync Service for handling data synchronization between local storage and remote API
 */

import { Note } from '../types';
import { storageService } from './storage';
import { ApiService } from '../utils/api';
import { offlineDetector } from '../utils/offline';
import {
  SyncStatus,
  SyncConflict,
  StorageResult,
  StorageEvent,
  StorageEventListener
} from '../types/storage';

export interface SyncOptions {
  autoSync: boolean;
  syncInterval: number; // in milliseconds
  batchSyncSize: number;
  conflictResolution: 'local' | 'remote' | 'manual';
}

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: string[];
  timestamp: string;
}

export class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private options: SyncOptions = {
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5 minutes
    batchSyncSize: 50,
    conflictResolution: 'local'
  };
  private listeners: StorageEventListener[] = [];

  private constructor() {
    // Don't initialize during module load - will be initialized lazily
    this.isInitialized = false;
  }

  private isInitialized: boolean = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeSync();
      this.isInitialized = true;
    }
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Configure sync options
   */
  public configure(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options };

    if (this.options.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<SyncStatus> {
    try {
      await this.ensureInitialized();
      const data = await storageService.getData();
      const pendingChanges = data.sync.pendingChanges.length;
      const failedChanges = data.sync.conflicts.filter(c => !c.resolved).length;

      return {
        isSyncing: this.isSyncing,
        lastSyncAt: data.sync.lastSyncAt,
        pendingChanges,
        failedChanges,
        lastError: undefined // Will be populated by sync operations
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        isSyncing: false,
        lastSyncAt: null,
        pendingChanges: 0,
        failedChanges: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform full sync with remote server
   */
  public async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        errors: ['Sync already in progress'],
        timestamp: new Date().toISOString()
      };
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    try {
      const result = await offlineDetector.executeWhenOnline(
        async () => {
          const data = await storageService.getData();
          const result: SyncResult = {
            success: true,
            uploaded: 0,
            downloaded: 0,
            conflicts: [],
            errors: [],
            timestamp: new Date().toISOString()
          };

          // Phase 1: Upload local changes
          const uploadResult = await this.uploadLocalChanges(data);
          result.uploaded = uploadResult.uploaded;
          result.conflicts.push(...uploadResult.conflicts);
          result.errors.push(...uploadResult.errors);

          // Phase 2: Download remote changes
          const downloadResult = await this.downloadRemoteChanges(data);
          result.downloaded = downloadResult.downloaded;
          result.conflicts.push(...downloadResult.conflicts);
          result.errors.push(...downloadResult.errors);

          // Phase 3: Update sync metadata
          if (result.errors.length === 0) {
            await this.updateSyncMetadata();
          }

          result.success = result.errors.length === 0 && result.conflicts.length === 0;
          return result;
        },
        {
          maxRetries: 3,
          retryDelay: 2000,
          retryBackoff: true
        }
      );

      this.notifySyncComplete(result);
      return result;

    } catch (error) {
      const result: SyncResult = {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        timestamp: new Date().toISOString()
      };

      this.notifySyncComplete(result);
      return result;

    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Sync a single note
   */
  public async syncNote(noteId: string): Promise<StorageResult<Note>> {
    try {
      const note = await storageService.getNote(noteId);
      if (!note) {
        return {
          success: false,
          error: 'Note not found',
          operation: 'sync',
          timestamp: new Date().toISOString()
        };
      }

      const result = await offlineDetector.executeWhenOnline(async () => {
        // Try to upload the note
        if (note.id && note.id.startsWith('note_')) {
          // This is a local note, create it on server
          const createResult = await ApiService.createNote({
            title: note.title,
            content: note.content
          });

          if (createResult.success && createResult.data) {
            // Update local note with server ID
            const updatedNote = { ...createResult.data, localId: note.id };
            await storageService.saveNote(updatedNote);
            return updatedNote;
          } else {
            throw new Error(createResult.error || 'Failed to create note');
          }
        } else {
          // This is a server note, update it
          const updateResult = await ApiService.updateNote(note.id, {
            title: note.title,
            content: note.content,
            version: note.version
          });

          if (updateResult.success && updateResult.data) {
            await storageService.saveNote(updateResult.data);
            return updateResult.data;
          } else {
            throw new Error(updateResult.error || 'Failed to update note');
          }
        }
      });

      // Remove from pending changes
      const data = await storageService.getData();
      data.sync.pendingChanges = data.sync.pendingChanges.filter(id => id !== noteId);
      await storageService['setRawData'](data);

      return {
        success: true,
        data: result,
        operation: 'sync',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        operation: 'sync',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Force full sync (clear cache and re-sync everything)
   */
  public async forceSync(): Promise<SyncResult> {
    try {
      // Clear sync metadata
      const data = await storageService.getData();
      data.sync.lastSyncAt = null;
      data.sync.pendingChanges = data.notes.map(note => note.id);
      await storageService['setRawData'](data);

      // Perform full sync
      return await this.sync();
    } catch (error) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Force sync failed'],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Resolve a sync conflict
   */
  public async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote'
  ): Promise<boolean> {
    try {
      const data = await storageService.getData();
      const conflict = data.sync.conflicts.find(c => c.id === conflictId);

      if (!conflict) {
        return false;
      }

      let resolvedData: any;

      if (resolution === 'local') {
        resolvedData = conflict.localData;
      } else {
        resolvedData = conflict.remoteData;
      }

      // Apply the resolved data
      if (conflict.type === 'note') {
        await storageService.saveNote(resolvedData);
      }

      // Mark conflict as resolved
      conflict.resolved = true;
      conflict.resolvedAt = new Date().toISOString();

      await storageService['setRawData'](data);

      // If resolving with remote data, remove from pending changes
      if (resolution === 'remote') {
        data.sync.pendingChanges = data.sync.pendingChanges.filter(
          id => id !== conflictId
        );
        await storageService['setRawData'](data);
      }

      this.notifyConflictResolved(conflictId, resolution);
      return true;

    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }

  /**
   * Add event listener
   */
  public addEventListener(listener: StorageEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: StorageEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Pause sync operations
   */
  public async pauseSync(): Promise<void> {
    this.stopAutoSync();
    // Any additional pause logic can be added here
  }

  /**
   * Resume sync operations
   */
  public async resumeSync(): Promise<void> {
    if (this.options.autoSync) {
      this.startAutoSync();
    }
    // Any additional resume logic can be added here
  }

  /**
   * Destroy sync service
   */
  public destroy(): void {
    this.stopAutoSync();
    this.listeners = [];
  }

  // Private methods

  private async initializeSync(): Promise<void> {
    // Check if we should start auto-sync
    const data = await storageService.getData();
    if (data.settings.syncEnabled && this.options.autoSync) {
      this.startAutoSync();
    }

    // Listen for online/offline events
    offlineDetector.addListener((status) => {
      if (status.isOnline && data.sync.pendingChanges.length > 0) {
        // Try to sync when we come back online
        setTimeout(() => this.sync(), 1000);
      }
    });
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (!this.isSyncing) {
        this.sync().catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
    }, this.options.syncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async uploadLocalChanges(data: any): Promise<{
    uploaded: number;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    const result = { uploaded: 0, conflicts: [], errors: [] };

    try {
      const pendingNoteIds = data.sync.pendingChanges;
      const notesToUpload = data.notes.filter((note: Note) =>
        pendingNoteIds.includes(note.id)
      );

      // Process in batches
      for (let i = 0; i < notesToUpload.length; i += this.options.batchSyncSize) {
        const batch = notesToUpload.slice(i, i + this.options.batchSyncSize);

        for (const note of batch) {
          try {
            let uploadResult;

            if (note.id && note.id.startsWith('note_')) {
              // Create new note
              uploadResult = await ApiService.createNote({
                title: note.title,
                content: note.content
              });
            } else {
              // Update existing note
              uploadResult = await ApiService.updateNote(note.id, {
                title: note.title,
                content: note.content,
                version: note.version
              });
            }

            if (uploadResult.success && uploadResult.data) {
              // Update local note with server data
              await storageService.saveNote(uploadResult.data);

              // Remove from pending changes
              data.sync.pendingChanges = data.sync.pendingChanges.filter(
                (id: string) => id !== note.id
              );

              result.uploaded++;
            } else {
              result.errors.push(uploadResult.error || `Failed to upload note ${note.id}`);
            }

          } catch (error) {
            result.errors.push(`Error uploading note ${note.id}: ${error}`);
          }
        }
      }

    } catch (error) {
      result.errors.push(`Batch upload failed: ${error}`);
    }

    return result;
  }

  private async downloadRemoteChanges(data: any): Promise<{
    downloaded: number;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    const result = { downloaded: 0, conflicts: [], errors: [] };

    try {
      // Get notes updated since last sync
      const lastSyncAt = data.sync.lastSyncAt;
      const notesResponse = await ApiService.getNotes({
        limit: this.options.batchSyncSize,
        updated_since: lastSyncAt
      });

      if (notesResponse.success && notesResponse.data) {
        for (const remoteNote of notesResponse.data.notes) {
          try {
            const localNote = data.notes.find((note: Note) => note.id === remoteNote.id);

            if (!localNote) {
              // New note from server
              await storageService.saveNote(remoteNote);
              result.downloaded++;
            } else if (new Date(remoteNote.updated_at) > new Date(localNote.updated_at)) {
              // Remote note is newer
              if (new Date(localNote.updated_at) > new Date(lastSyncAt)) {
                // Both local and remote have changes - conflict!
                const conflict: SyncConflict = {
                  id: remoteNote.id,
                  type: 'note',
                  localData: localNote,
                  remoteData: remoteNote,
                  resolved: false,
                  createdAt: new Date().toISOString()
                };

                result.conflicts.push(conflict);
                data.sync.conflicts.push(conflict);

                // Resolve based on strategy
                if (this.options.conflictResolution === 'local') {
                  await this.resolveConflict(conflict.id, 'local');
                } else if (this.options.conflictResolution === 'remote') {
                  await this.resolveConflict(conflict.id, 'remote');
                  result.downloaded++;
                }
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
        result.errors.push(notesResponse.error || 'Failed to download remote changes');
      }

    } catch (error) {
      result.errors.push(`Download failed: ${error}`);
    }

    return result;
  }

  private async updateSyncMetadata(): Promise<void> {
    try {
      const data = await storageService.getData();
      data.sync.lastSyncAt = new Date().toISOString();
      await storageService['setRawData'](data);
    } catch (error) {
      console.error('Failed to update sync metadata:', error);
    }
  }

  private notifyStatusChange(): void {
    this.getStatus().then(status => {
      this.listeners.forEach(listener => {
        try {
          listener({
            type: 'change',
            data: { syncStatus: status },
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error in sync event listener:', error);
        }
      });
    });
  }

  private notifySyncComplete(result: SyncResult): void {
    this.listeners.forEach(listener => {
      try {
        listener({
          type: 'sync_complete',
          data: result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  private notifyConflictResolved(conflictId: string, resolution: string): void {
    this.listeners.forEach(listener => {
      try {
        listener({
          type: 'conflict_detected',
          data: { conflictId, resolution },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();