/**
 * Conflict Resolution Service
 * Handles detection, resolution, and management of sync conflicts
 */

import { Note } from '../types';
import { SyncConflict } from '../types/storage';
import { storageService } from '../services/storage';
import { SyncQueueItem } from '../background/sync';

export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge' | 'manual';

export interface ConflictResolution {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolvedAt: string;
  resolvedData?: any;
  notes?: string;
}

export interface MergeResult {
  success: boolean;
  mergedData?: any;
  conflicts: Array<{
    field: string;
    localValue: any;
    remoteValue: any;
    reason: string;
  }>;
  notes?: string;
}

export interface ConflictStats {
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  autoResolvedConflicts: number;
  manuallyResolvedConflicts: number;
  averageResolutionTime: number; // in minutes
  conflictRate: number; // conflicts per 1000 syncs
}

export class ConflictManager {
  private resolutionHistory: Map<string, ConflictResolution> = new Map();
  private autoResolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map();

  constructor() {
    this.initializeAutoResolutionStrategies();
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflicts(localNotes: Note[], remoteNotes: Note[]): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];
    const remoteNotesMap = new Map(remoteNotes.map(note => [note.id, note]));

    for (const localNote of localNotes) {
      const remoteNote = remoteNotesMap.get(localNote.id);

      if (remoteNote) {
        const conflict = await this.compareNotes(localNote, remoteNote);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Create a new conflict
   */
  async createConflict(
    syncItem: SyncQueueItem,
    error: Error
  ): Promise<SyncConflict> {
    const conflict: SyncConflict = {
      id: this.generateConflictId(),
      type: 'note',
      localData: syncItem.data,
      remoteData: null, // Will be populated when remote data is available
      resolved: false,
      createdAt: new Date().toISOString()
    };

    // Save conflict to storage
    const data = await storageService.getData();
    data.sync.conflicts.push(conflict);
    await storageService['setRawData'](data);

    console.log(`Created conflict ${conflict.id} for note ${syncItem.entityId}`);
    return conflict;
  }

  /**
   * Resolve a conflict with specified strategy
   */
  async resolveConflict(
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    customData?: any
  ): Promise<boolean> {
    try {
      const data = await storageService.getData();
      const conflict = data.sync.conflicts.find(c => c.id === conflictId);

      if (!conflict) {
        console.error(`Conflict ${conflictId} not found`);
        return false;
      }

      let resolvedData: any;
      let notes: string = '';

      switch (strategy) {
        case 'local':
          resolvedData = conflict.localData;
          notes = 'Local version kept';
          break;

        case 'remote':
          resolvedData = conflict.remoteData;
          notes = 'Remote version kept';
          break;

        case 'merge':
          const mergeResult = await this.mergeNotes(conflict.localData, conflict.remoteData);
          if (mergeResult.success && mergeResult.mergedData) {
            resolvedData = mergeResult.mergedData;
            notes = `Auto-merged: ${mergeResult.notes}`;
          } else {
            // Merge failed, fall back to local
            resolvedData = conflict.localData;
            notes = `Merge failed, kept local: ${mergeResult.notes}`;
          }
          break;

        case 'manual':
          if (customData) {
            resolvedData = customData;
            notes = 'Manually resolved';
          } else {
            console.error('Manual resolution requires custom data');
            return false;
          }
          break;

        default:
          console.error(`Unknown conflict resolution strategy: ${strategy}`);
          return false;
      }

      // Apply the resolution
      if (conflict.type === 'note') {
        await storageService.saveNote(resolvedData);
      }

      // Mark conflict as resolved
      conflict.resolved = true;
      conflict.resolvedAt = new Date().toISOString();
      conflict.resolution = resolvedData;
      conflict.resolutionNotes = notes;

      // Save resolution history
      this.resolutionHistory.set(conflictId, {
        conflictId,
        strategy,
        resolvedAt: new Date().toISOString(),
        resolvedData,
        notes
      });

      await storageService['setRawData'](data);

      console.log(`Resolved conflict ${conflictId} with strategy: ${strategy}`);
      return true;

    } catch (error) {
      console.error(`Failed to resolve conflict ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Attempt automatic conflict resolution
   */
  async attemptAutoResolution(conflictId: string): Promise<boolean> {
    try {
      const data = await storageService.getData();
      const conflict = data.sync.conflicts.find(c => c.id === conflictId);

      if (!conflict || conflict.resolved) {
        return false;
      }

      // Get auto-resolution strategy for this type of conflict
      const strategy = this.getAutoResolutionStrategy(conflict);

      if (strategy !== 'manual') {
        console.log(`Attempting auto-resolution of conflict ${conflictId} with strategy: ${strategy}`);
        return await this.resolveConflict(conflictId, strategy);
      }

      return false;
    } catch (error) {
      console.error(`Auto-resolution failed for conflict ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    try {
      const data = await storageService.getData();
      return data.sync.conflicts.filter(c => !c.resolved);
    } catch (error) {
      console.error('Failed to get unresolved conflicts:', error);
      return [];
    }
  }

  /**
   * Get conflict statistics
   */
  async getConflictStats(): Promise<ConflictStats> {
    try {
      const data = await storageService.getData();
      const conflicts = data.sync.conflicts;

      const totalConflicts = conflicts.length;
      const resolvedConflicts = conflicts.filter(c => c.resolved).length;
      const pendingConflicts = totalConflicts - resolvedConflicts;

      // Count auto vs manual resolutions
      const autoResolvedConflicts = resolvedConflicts.filter(c =>
        c.resolutionNotes?.includes('Auto-merged') ||
        c.resolutionNotes?.includes('kept') && !c.resolutionNotes?.includes('Manually')
      ).length;

      const manuallyResolvedConflicts = resolvedConflicts.filter(c =>
        c.resolutionNotes?.includes('Manually')
      ).length;

      // Calculate average resolution time
      const resolvedConflictsWithTime = conflicts.filter(c =>
        c.resolved && c.resolvedAt && c.createdAt
      );

      let averageResolutionTime = 0;
      if (resolvedConflictsWithTime.length > 0) {
        const totalTime = resolvedConflictsWithTime.reduce((sum, conflict) => {
          const resolutionTime = new Date(conflict.resolvedAt!).getTime() - new Date(conflict.createdAt).getTime();
          return sum + resolutionTime;
        }, 0);
        averageResolutionTime = totalTime / resolvedConflictsWithTime.length / (1000 * 60); // Convert to minutes
      }

      // Calculate conflict rate (conflicts per 1000 syncs)
      const syncHistory = data.sync.lastSyncResult ? 1 : 0; // Simplified for now
      const conflictRate = syncHistory > 0 ? (totalConflicts / syncHistory) * 1000 : 0;

      return {
        totalConflicts,
        resolvedConflicts,
        pendingConflicts,
        autoResolvedConflicts,
        manuallyResolvedConflicts,
        averageResolutionTime,
        conflictRate
      };

    } catch (error) {
      console.error('Failed to get conflict stats:', error);
      return {
        totalConflicts: 0,
        resolvedConflicts: 0,
        pendingConflicts: 0,
        autoResolvedConflicts: 0,
        manuallyResolvedConflicts: 0,
        averageResolutionTime: 0,
        conflictRate: 0
      };
    }
  }

  /**
   * Clear old resolved conflicts
   */
  async clearOldConflicts(olderThanDays: number = 30): Promise<void> {
    try {
      const data = await storageService.getData();
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const originalCount = data.sync.conflicts.length;
      data.sync.conflicts = data.sync.conflicts.filter(conflict =>
        !conflict.resolved || new Date(conflict.resolvedAt || conflict.createdAt) > cutoffDate
      );

      const clearedCount = originalCount - data.sync.conflicts.length;

      if (clearedCount > 0) {
        await storageService['setRawData'](data);
        console.log(`Cleared ${clearedCount} old conflicts`);
      }

    } catch (error) {
      console.error('Failed to clear old conflicts:', error);
    }
  }

  /**
   * Compare two notes and detect conflicts
   */
  private async compareNotes(localNote: Note, remoteNote: Note): Promise<SyncConflict | null> {
    // If versions match, no conflict
    if (localNote.version === remoteNote.version) {
      return null;
    }

    // If remote is newer, no conflict (just update)
    if (new Date(remoteNote.updated_at) > new Date(localNote.updated_at)) {
      return null;
    }

    // If local is newer, no conflict (will be synced)
    if (new Date(localNote.updated_at) > new Date(remoteNote.updated_at)) {
      return null;
    }

    // If both were updated around the same time, we have a conflict
    const timeDiff = Math.abs(
      new Date(localNote.updated_at).getTime() - new Date(remoteNote.updated_at).getTime()
    );

    if (timeDiff < 5000) { // Within 5 seconds = potential conflict
      return {
        id: this.generateConflictId(),
        type: 'note',
        localData: localNote,
        remoteData: remoteNote,
        resolved: false,
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Merge two note versions
   */
  private async mergeNotes(localNote: Note, remoteNote: Note): Promise<MergeResult> {
    const conflicts: Array<{
      field: string;
      localValue: any;
      remoteValue: any;
      reason: string;
    }> = [];

    try {
      const mergedNote: Note = { ...localNote };

      // Merge title
      if (localNote.title !== remoteNote.title) {
        if (!localNote.title && remoteNote.title) {
          mergedNote.title = remoteNote.title;
        } else if (localNote.title && !remoteNote.title) {
          mergedNote.title = localNote.title;
        } else {
          // Both have titles, choose the longer one and note conflict
          if (remoteNote.title.length > localNote.title.length) {
            mergedNote.title = remoteNote.title;
          }
          conflicts.push({
            field: 'title',
            localValue: localNote.title,
            remoteValue: remoteNote.title,
            reason: 'Both versions have different titles'
          });
        }
      }

      // Merge content - more complex
      if (localNote.content !== remoteNote.content) {
        const contentMerge = await this.mergeTextContent(localNote.content, remoteNote.content);
        mergedNote.content = contentMerge.mergedContent;
        conflicts.push(...contentMerge.conflicts);
      }

      // Update metadata
      mergedNote.updated_at = new Date().toISOString();
      mergedNote.version = Math.max(localNote.version || 1, remoteNote.version || 1) + 1;

      return {
        success: conflicts.length === 0,
        mergedData: mergedNote,
        conflicts,
        notes: conflicts.length > 0 ? `Merged with ${conflicts.length} conflicts` : 'Clean merge'
      };

    } catch (error) {
      console.error('Merge failed:', error);
      return {
        success: false,
        conflicts: [{
          field: 'merge',
          localValue: localNote,
          remoteValue: remoteNote,
          reason: error instanceof Error ? error.message : 'Unknown merge error'
        }],
        notes: 'Merge operation failed'
      };
    }
  }

  /**
   * Merge text content with simple conflict resolution
   */
  private async mergeTextContent(localContent: string, remoteContent: string): Promise<{
    mergedContent: string;
    conflicts: Array<{
      field: string;
      localValue: any;
      remoteValue: any;
      reason: string;
    }>;
  }> {
    const conflicts = [];

    // Simple merge strategy: if one is significantly longer, use that one
    if (remoteContent.length > localContent.length * 1.2) {
      // Remote is significantly longer
      return {
        mergedContent: remoteContent,
        conflicts: [{
          field: 'content',
          localValue: localContent,
          remoteValue: remoteContent,
          reason: 'Remote content is significantly longer'
        }]
      };
    } else if (localContent.length > remoteContent.length * 1.2) {
      // Local is significantly longer
      return {
        mergedContent: localContent,
        conflicts: [{
          field: 'content',
          localValue: localContent,
          remoteValue: remoteContent,
          reason: 'Local content is significantly longer'
        }]
      };
    } else {
      // Similar length, combine them
      const mergedContent = `${localContent}\n\n--- Merged Content ---\n\n${remoteContent}`;
      return {
        mergedContent,
        conflicts: [{
          field: 'content',
          localValue: localContent,
          remoteValue: remoteContent,
          reason: 'Similar length, combined both versions'
        }]
      };
    }
  }

  /**
   * Get auto-resolution strategy for a conflict
   */
  private getAutoResolutionStrategy(conflict: SyncConflict): ConflictResolutionStrategy {
    // Check if we have a learned strategy for this type
    const conflictKey = this.getConflictKey(conflict);
    return this.autoResolutionStrategies.get(conflictKey) || 'merge';
  }

  /**
   * Get conflict key for categorization
   */
  private getConflictKey(conflict: SyncConflict): string {
    if (conflict.type === 'note') {
      const localLength = conflict.localData?.content?.length || 0;
      const remoteLength = conflict.remoteData?.content?.length || 0;

      if (localLength === 0) return 'empty_local';
      if (remoteLength === 0) return 'empty_remote';
      if (Math.abs(localLength - remoteLength) < 50) return 'similar_length';
      if (localLength > remoteLength * 1.5) return 'much_longer_local';
      if (remoteLength > localLength * 1.5) return 'much_longer_remote';

      return 'standard_note';
    }

    return 'unknown';
  }

  /**
   * Initialize auto-resolution strategies
   */
  private initializeAutoResolutionStrategies(): void {
    // Empty content prefers non-empty version
    this.autoResolutionStrategies.set('empty_local', 'remote');
    this.autoResolutionStrategies.set('empty_remote', 'local');

    // Similar length tries merge
    this.autoResolutionStrategies.set('similar_length', 'merge');

    // Much longer content gets preference
    this.autoResolutionStrategies.set('much_longer_local', 'local');
    this.autoResolutionStrategies.set('much_longer_remote', 'remote');

    // Standard note conflicts attempt merge
    this.autoResolutionStrategies.set('standard_note', 'merge');
  }

  /**
   * Generate unique conflict ID
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const conflictManager = new ConflictManager();