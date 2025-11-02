/**
 * React hook for managing sync functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncService, SyncOptions, SyncResult } from '../services/sync';
import { offlineDetector } from '../utils/offline';
import { SyncStatus, SyncConflict } from '../types/storage';

export interface UseSyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
  conflictResolution?: 'local' | 'remote' | 'manual';
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: string) => void;
  onConflict?: (conflict: SyncConflict) => void;
}

export interface UseSyncReturn {
  syncStatus: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  conflicts: SyncConflict[];
  sync: () => Promise<SyncResult>;
  forceSync: () => Promise<SyncResult>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<boolean>;
  configureSync: (options: Partial<SyncOptions>) => void;
  networkQuality: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    downlink: number | null;
    rtt: number | null;
    effectiveType: string;
  };
}

export const useSync = (options: UseSyncOptions = {}): UseSyncReturn => {
  const {
    autoSync = true,
    syncInterval = 5 * 60 * 1000, // 5 minutes
    conflictResolution = 'local',
    onSyncStart,
    onSyncComplete,
    onSyncError,
    onConflict
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0,
    failedChanges: 0
  });

  const [isOnline, setIsOnline] = useState(offlineDetector.isCurrentlyOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  const syncServiceRef = useRef(syncService);
  const offlineDetectorRef = useRef(offlineDetector);

  // Initialize sync configuration
  useEffect(() => {
    syncServiceRef.current.configure({
      autoSync,
      syncInterval,
      conflictResolution
    });
  }, [autoSync, syncInterval, conflictResolution]);

  // Listen to sync events
  useEffect(() => {
    const handleSyncEvent = (event: any) => {
      switch (event.type) {
        case 'sync_complete':
          setLastSyncResult(event.data);
          setIsSyncing(false);
          if (event.data.success) {
            onSyncComplete?.(event.data);
          } else {
            onSyncError?.(event.data.errors.join(', '));
          }
          break;

        case 'conflict_detected':
          if (event.data.resolution) {
            // Conflict was resolved, update conflicts list
            setConflicts(prev => prev.filter(c => c.id !== event.data.conflictId));
          } else {
            // New conflict detected
            onConflict?.(event.data);
          }
          break;

        case 'change':
          if (event.data.syncStatus) {
            setSyncStatus(event.data.syncStatus);
            setIsSyncing(event.data.syncStatus.isSyncing);
          }
          break;
      }
    };

    syncServiceRef.current.addEventListener(handleSyncEvent);

    return () => {
      syncServiceRef.current.removeEventListener(handleSyncEvent);
    };
  }, [onSyncComplete, onSyncError, onConflict]);

  // Listen to online/offline events
  useEffect(() => {
    const handleOfflineStatusChange = (status: any) => {
      setIsOnline(status.isOnline);
    };

    offlineDetectorRef.current.addListener(handleOfflineStatusChange);

    return () => {
      offlineDetectorRef.current.removeListener(handleOfflineStatusChange);
    };
  }, []);

  // Update sync status periodically
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const status = await syncServiceRef.current.getStatus();
        setSyncStatus(status);
        setIsSyncing(status.isSyncing);
      } catch (error) {
        console.error('Failed to get sync status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Load conflicts from storage
  useEffect(() => {
    const loadConflicts = async () => {
      try {
        const data = await import('../services/storage').then(m => m.storageService.getData());
        setConflicts(data.sync.conflicts.filter((c: SyncConflict) => !c.resolved));
      } catch (error) {
        console.error('Failed to load conflicts:', error);
      }
    };

    loadConflicts();
  }, []);

  const sync = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    onSyncStart?.();

    try {
      const result = await syncServiceRef.current.sync();
      setLastSyncResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      onSyncError?.(errorMessage);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncStart, onSyncError]);

  const forceSync = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    onSyncStart?.();

    try {
      const result = await syncServiceRef.current.forceSync();
      setLastSyncResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Force sync failed';
      onSyncError?.(errorMessage);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncStart, onSyncError]);

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote'
  ): Promise<boolean> => {
    try {
      const success = await syncServiceRef.current.resolveConflict(conflictId, resolution);
      if (success) {
        setConflicts(prev => prev.filter(c => c.id !== conflictId));
      }
      return success;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }, []);

  const configureSync = useCallback((newOptions: Partial<SyncOptions>) => {
    syncServiceRef.current.configure(newOptions);
  }, []);

  const networkQuality = offlineDetector.getNetworkQuality();

  return {
    syncStatus,
    isOnline,
    isSyncing,
    lastSyncResult,
    conflicts,
    sync,
    forceSync,
    resolveConflict,
    configureSync,
    networkQuality
  };
};

/**
 * Hook for sync status indicator
 */
export const useSyncStatus = () => {
  const [status, setStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncAt: string | null;
    pendingChanges: number;
  }>({
    isOnline: offlineDetector.isCurrentlyOnline(),
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0
  });

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const syncStatus = await syncService.getStatus();
        const offlineStatus = offlineDetector.getStatus();

        setStatus({
          isOnline: offlineStatus.isOnline,
          isSyncing: syncStatus.isSyncing,
          lastSyncAt: syncStatus.lastSyncAt,
          pendingChanges: syncStatus.pendingChanges
        });
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  return status;
};

/**
 * Hook for offline detection
 */
export const useOfflineDetection = () => {
  const [isOnline, setIsOnline] = useState(offlineDetector.isCurrentlyOnline());
  const [networkQuality, setNetworkQuality] = useState(
    offlineDetector.getNetworkQuality()
  );

  useEffect(() => {
    const handleStatusChange = (status: any) => {
      setIsOnline(status.isOnline);
      setNetworkQuality(offlineDetector.getNetworkQuality());
    };

    offlineDetector.addListener(handleStatusChange);

    return () => {
      offlineDetector.removeListener(handleStatusChange);
    };
  }, []);

  const waitForConnection = useCallback((timeoutMs?: number) => {
    return offlineDetector.waitForConnection(timeoutMs);
  }, []);

  const executeWhenOnline = useCallback(async <T>(
    fn: () => Promise<T>,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      retryBackoff?: boolean;
    }
  ) => {
    return offlineDetector.executeWhenOnline(fn, options);
  }, []);

  return {
    isOnline,
    networkQuality,
    waitForConnection,
    executeWhenOnline
  };
};