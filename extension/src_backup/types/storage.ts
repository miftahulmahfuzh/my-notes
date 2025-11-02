/**
 * Storage types for Chrome extension local storage
 */

import { Note } from './index';

// Local storage data structure
export interface LocalStorageData {
  notes: Note[];
  tags: string[];
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  } | null;
  settings: {
    theme: 'light' | 'dark';
    language: string;
    autoSave: boolean;
    syncEnabled: boolean;
  };
  sync: {
    lastSyncAt: string | null;
    pendingChanges: string[]; // Note IDs that need to be synced
    conflicts: SyncConflict[];
  };
  metadata: {
    version: string;
    createdAt: string;
    updatedAt: string;
    storageSize: number;
  };
}

// Sync conflict representation
export interface SyncConflict {
  id: string;
  type: 'note' | 'settings';
  localData: any;
  remoteData: any;
  resolved: boolean;
  createdAt: string;
}

// Storage quota information
export interface StorageQuota {
  usageInBytes: number;
  quotaInBytes: number;
  usagePercentage: number;
  availableInBytes: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

// Storage operation types
export type StorageOperation = 'create' | 'update' | 'delete' | 'sync';

// Storage operation result
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  operation: StorageOperation;
  timestamp: string;
}

// Batch storage operation
export interface BatchStorageOperation {
  type: 'create' | 'update' | 'delete';
  entity: 'note' | 'tag' | 'settings';
  data: any;
  id?: string;
}

// Cache configuration
export interface CacheConfig {
  maxNotes: number;
  maxAge: number; // in milliseconds
  cleanupThreshold: number; // percentage of quota to trigger cleanup
}

// Offline status
export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineAt: string | null;
  connectionType: string;
  effectiveType: string;
}

// Sync status
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  failedChanges: number;
  lastError?: string;
}

// Local storage error types
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNKNOWN = 'UNKNOWN'
}

// Storage error
export interface StorageError extends Error {
  type: StorageErrorType;
  operation?: StorageOperation;
  data?: any;
}

// Storage event types
export interface StorageEvent {
  type: 'change' | 'quota_warning' | 'sync_complete' | 'conflict_detected';
  data?: any;
  timestamp: string;
}

// Storage listener
export type StorageEventListener = (event: StorageEvent) => void;

// Migration interface
export interface DataMigration {
  version: string;
  description: string;
  migrate: (data: any) => Promise<any>;
  rollback?: (data: any) => Promise<any>;
}

// Storage statistics
export interface StorageStats {
  totalNotes: number;
  totalTags: number;
  oldestNote: string | null;
  newestNote: string | null;
  storageSize: number;
  lastSyncAt: string | null;
  conflictsResolved: number;
  syncFailures: number;
}