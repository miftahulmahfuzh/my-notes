/**
 * Local Storage Service for Chrome Extension
 * Handles offline data storage, caching, and data persistence
 */

import { Note } from '@/types';
import {
  LocalStorageData,
  StorageQuota,
  StorageResult,
  StorageOperation,
  BatchStorageOperation,
  StorageErrorType,
  StorageError,
  StorageEvent,
  StorageEventListener,
  CacheConfig,
  DataMigration,
  StorageStats
} from '@/types/storage';

const STORAGE_KEY = 'silence_notes_data';
const CURRENT_VERSION = '1.0.0';

export class StorageService {
  private static instance: StorageService;
  private listeners: Map<string, StorageEventListener[]> = new Map();
  private cacheConfig: CacheConfig = {
    maxNotes: 1000,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    cleanupThreshold: 80 // 80% of quota
  };
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.initializationPromise = this.initializeStorage();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Ensure initialization is complete before proceeding
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null; // Clear the promise after completion
    }
  }

  /**
   * Initialize storage with default values
   */
  private async initializeStorage(): Promise<void> {
    try {
      const existing = await this.getRawData();
      if (!existing) {
        const initialData: LocalStorageData = {
          notes: [],
          tags: [],
          user: null,
          settings: {
            theme: 'light',
            language: 'en',
            autoSave: true,
            syncEnabled: true
          },
          sync: {
            lastSyncAt: null,
            pendingChanges: [],
            conflicts: []
          },
          metadata: {
            version: CURRENT_VERSION,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            storageSize: 0
          }
        };
        await this.setRawData(initialData);
      } else {
        await this.migrateIfNeeded(existing);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw this.createStorageError(
        StorageErrorType.UNKNOWN,
        'Failed to initialize storage',
        undefined,
        error
      );
    }
  }

  /**
   * Get all stored data
   */
  public async getData(): Promise<LocalStorageData> {
    try {
      await this.ensureInitialized();
      const data = await this.getRawData();
      if (!data) {
        throw new Error('No data found in storage');
      }
      return data;
    } catch (error) {
      console.error('Failed to get data:', error);
      throw this.createStorageError(
        StorageErrorType.DATA_CORRUPTION,
        'Failed to retrieve data',
        undefined,
        error
      );
    }
  }

  /**
   * Get all notes
   */
  public async getNotes(): Promise<Note[]> {
    try {
      const data = await this.getData();
      return data.notes || [];
    } catch (error) {
      console.error('Failed to get notes:', error);
      return [];
    }
  }

  /**
   * Get a specific note by ID
   */
  public async getNote(id: string): Promise<Note | null> {
    try {
      const notes = await this.getNotes();
      return notes.find(note => note.id === id) || null;
    } catch (error) {
      console.error('Failed to get note:', error);
      return null;
    }
  }

  /**
   * Save a note (create or update)
   */
  public async saveNote(note: Note): Promise<StorageResult<Note>> {
    const timestamp = new Date().toISOString();
    let operation: StorageOperation = 'create'; // Default operation

    try {
      const data = await this.getData();
      const existingIndex = data.notes.findIndex(n => n.id === note.id);
      operation = existingIndex >= 0 ? 'update' : 'create';

      if (existingIndex >= 0) {
        // Update existing note
        data.notes[existingIndex] = { ...note, updated_at: timestamp };
      } else {
        // Create new note
        const newNote = {
          ...note,
          id: note.id || this.generateId(),
          created_at: timestamp,
          updated_at: timestamp,
          version: 1
        };
        data.notes.unshift(newNote);
      }

      // Add to pending changes for sync
      if (!data.sync.pendingChanges) {
        data.sync.pendingChanges = [];
      }
      if (data.sync.pendingChanges.indexOf(note.id) === -1) {
        data.sync.pendingChanges.push(note.id);
      }

      // Update metadata
      data.metadata.updatedAt = timestamp;
      data.metadata.storageSize = await this.calculateStorageSize(data);

      await this.setRawData(data);

      // Check quota and cleanup if needed, but don't fail the operation
      try {
        await this.checkQuotaAndCleanup();
      } catch (quotaError) {
        console.warn('Quota check failed, but note was saved:', quotaError);
      }

      this.emitEvent('change', { operation, noteId: note.id });

      return {
        success: true,
        data: note,
        operation,
        timestamp
      };
    } catch (error) {
      console.error('Failed to save note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
        timestamp
      };
    }
  }

  /**
   * Delete a note
   */
  public async deleteNote(id: string): Promise<StorageResult<string>> {
    try {
      const data = await this.getData();
      const noteIndex = data.notes.findIndex(n => n.id === id);

      if (noteIndex === -1) {
        return {
          success: false,
          error: 'Failed to delete note locally',
          operation: 'delete',
          timestamp: new Date().toISOString()
        };
      }

      const deletedNote = data.notes[noteIndex];
      data.notes.splice(noteIndex, 1);

      // Add to pending changes for sync
      if (!data.sync.pendingChanges) {
        data.sync.pendingChanges = [];
      }
      if (data.sync.pendingChanges.indexOf(id) === -1) {
        data.sync.pendingChanges.push(id);
      }

      // Update metadata
      data.metadata.updatedAt = new Date().toISOString();
      data.metadata.storageSize = await this.calculateStorageSize(data);

      await this.setRawData(data);

      this.emitEvent('change', { operation: 'delete', noteId: id });

      return {
        success: true,
        data: id,
        operation: 'delete',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to delete note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'delete',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Save multiple notes in batch
   */
  public async saveNotesBatch(notes: Note[]): Promise<StorageResult<Note[]>> {
    const timestamp = new Date().toISOString();

    try {
      const data = await this.getData();
      const noteIds = new Set<string>();

      notes.forEach(note => {
        const existingIndex = data.notes.findIndex(n => n.id === note.id);

        if (existingIndex >= 0) {
          data.notes[existingIndex] = { ...note, updated_at: timestamp };
        } else {
          const newNote = {
            ...note,
            id: note.id || this.generateId(),
            created_at: timestamp,
            updated_at: timestamp,
            version: 1
          };
          data.notes.unshift(newNote);
        }

        noteIds.add(note.id);
      });

      // Add all note IDs to pending changes
      noteIds.forEach(id => {
        if (data.sync.pendingChanges.indexOf(id) === -1) {
          data.sync.pendingChanges.push(id);
        }
      });

      // Update metadata
      data.metadata.updatedAt = timestamp;
      data.metadata.storageSize = await this.calculateStorageSize(data);

      await this.setRawData(data);

      // Check quota and cleanup if needed, but don't fail the operation
      try {
        await this.checkQuotaAndCleanup();
      } catch (quotaError) {
        console.warn('Quota check failed, but notes were saved:', quotaError);
      }

      this.emitEvent('change', { operation: 'sync', noteIds: Array.from(noteIds) });

      return {
        success: true,
        data: notes,
        operation: 'sync',
        timestamp
      };
    } catch (error) {
      console.error('Failed to save notes batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'sync',
        timestamp
      };
    }
  }

  /**
   * Get storage quota information
   */
  public async getQuotaInfo(): Promise<StorageQuota> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const usageInBytes = estimate.usage || 0;
          const quotaInBytes = estimate.quota || 0;
          const usagePercentage = quotaInBytes > 0 ? Math.round((usageInBytes / quotaInBytes) * 100) : 0;

          return {
            usageInBytes,
            quotaInBytes,
            usagePercentage,
            availableInBytes: quotaInBytes - usageInBytes,
            isNearLimit: usagePercentage > this.cacheConfig.cleanupThreshold,
            isOverLimit: usagePercentage >= 100
          };
        } catch (estimateError) {
          // If navigator.storage.estimate fails, fall back to manual calculation
          console.warn('navigator.storage.estimate failed, using fallback:', estimateError);
        }
      }

      // Fallback for browsers without storage.estimate
      const data = await this.getData();
      const sizeInBytes = await this.calculateStorageSize(data);
      const assumedQuota = 5 * 1024 * 1024; // 5MB assumed quota
      const usagePercentage = Math.round((sizeInBytes / assumedQuota) * 100);

      return {
        usageInBytes: sizeInBytes,
        quotaInBytes: assumedQuota,
        usagePercentage,
        availableInBytes: assumedQuota - sizeInBytes,
        isNearLimit: usagePercentage > this.cacheConfig.cleanupThreshold,
        isOverLimit: usagePercentage >= 100
      };
    } catch (error) {
      console.error('Failed to get quota info:', error);
      throw this.createStorageError(
        StorageErrorType.ACCESS_DENIED,
        'Failed to get storage quota information',
        undefined,
        error
      );
    }
  }

  /**
   * Clear all stored data
   */
  public async clearAll(): Promise<StorageResult<void>> {
    const timestamp = new Date().toISOString();

    try {
      await chrome.storage.local.clear();

      this.emitEvent('change', { operation: 'delete', all: true });

      return {
        success: true,
        operation: 'delete',
        timestamp
      };
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'delete',
        timestamp
      };
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<StorageStats> {
    try {
      const data = await this.getData();
      const notes = data.notes;

      const totalNotes = notes.length;
      const totalTags = data.tags.length;
      const oldestNote = notes.length > 0 ?
        notes.reduce((oldest, note) =>
          note.created_at < oldest.created_at ? note : oldest
        ).created_at : null;
      const newestNote = notes.length > 0 ?
        notes.reduce((newest, note) =>
          note.created_at > newest.created_at ? note : newest
        ).created_at : null;

      const storageSize = await this.calculateStorageSize(data);
      const conflictsResolved = data.sync.conflicts.filter(c => c.resolved).length;
      const syncFailures = data.sync.pendingChanges.length;

      return {
        totalNotes,
        totalTags,
        oldestNote,
        newestNote,
        storageSize,
        lastSyncAt: data.sync.lastSyncAt,
        conflictsResolved,
        syncFailures
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      throw this.createStorageError(
        StorageErrorType.UNKNOWN,
        'Failed to get storage statistics',
        undefined,
        error
      );
    }
  }

  /**
   * Perform manual cleanup of old notes
   * This method can be called explicitly to trigger cleanup
   */
  public async performManualCleanup(): Promise<{
    success: boolean;
    removedCount: number;
    error?: string;
  }> {
    try {
      const quotaInfo = await this.getQuotaInfo();
      const wasNearLimit = quotaInfo.isNearLimit || quotaInfo.isOverLimit;

      await this.performCleanup();

      // Get updated data to see what was removed
      const data = await this.getData();
      const removedCount = quotaInfo.isNearLimit || quotaInfo.isOverLimit ?
        Math.max(0, (quotaInfo.totalNotes || 0) - data.notes.length) : 0;

      return {
        success: true,
        removedCount
      };
    } catch (error) {
      console.error('Failed to perform manual cleanup:', error);
      return {
        success: false,
        removedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add event listener
   */
  public addEventListener(event: string, listener: StorageEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: string, listener: StorageEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Private helper methods

  private async getRawData(): Promise<LocalStorageData | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || null;
    } catch (error) {
      console.error('Failed to get raw data:', error);
      return null;
    }
  }

  private async setRawData(data: LocalStorageData): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (error) {
      console.error('Failed to set raw data:', error);
      throw error;
    }
  }

  private async calculateStorageSize(data: LocalStorageData): Promise<number> {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  private async checkQuotaAndCleanup(): Promise<void> {
    try {
      const quotaInfo = await this.getQuotaInfo();

      if (quotaInfo.isNearLimit || quotaInfo.isOverLimit) {
        await this.performCleanup();
        this.emitEvent('quota_warning', quotaInfo);
      }
    } catch (error) {
      console.error('Failed to check quota:', error);
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      const data = await this.getData();
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - this.cacheConfig.maxAge);

      // Remove old notes
      const originalCount = data.notes.length;
      data.notes = data.notes.filter(note =>
        new Date(note.updated_at) > cutoffDate
      );

      // Keep only the most recent notes if we still have too many
      if (data.notes.length > this.cacheConfig.maxNotes) {
        data.notes = data.notes
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, this.cacheConfig.maxNotes);
      }

      const removedCount = originalCount - data.notes.length;

      if (removedCount > 0) {
        data.metadata.updatedAt = now.toISOString();
        data.metadata.storageSize = await this.calculateStorageSize(data);
        await this.setRawData(data);

        console.log(`Cleaned up ${removedCount} old notes from storage`);
      }
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
    }
  }

  private async migrateIfNeeded(data: LocalStorageData): Promise<void> {
    if (data.metadata.version !== CURRENT_VERSION) {
      try {
        // Add migration logic here when needed
        data.metadata.version = CURRENT_VERSION;
        data.metadata.updatedAt = new Date().toISOString();
        await this.setRawData(data);
      } catch (error) {
        console.error('Failed to migrate data:', error);
        throw this.createStorageError(
          StorageErrorType.VERSION_MISMATCH,
          'Failed to migrate data to new version',
          undefined,
          error
        );
      }
    }
  }

  private generateId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createStorageError(
    type: StorageErrorType,
    message: string,
    operation?: StorageOperation,
    originalError?: any
  ): StorageError {
    const error = new Error(message) as StorageError;
    error.type = type;
    error.operation = operation;
    error.data = originalError;
    return error;
  }

  private emitEvent(type: string, data?: any): void {
    const event: StorageEvent = {
      type: type as any,
      data,
      timestamp: new Date().toISOString()
    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in storage event listener:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();