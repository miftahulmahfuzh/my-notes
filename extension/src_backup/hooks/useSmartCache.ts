import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
}

interface SmartCacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  maxSize?: number; // Maximum cache size (default: 50 entries)
  enableBackgroundRefresh?: boolean; // Refresh data in background (default: true)
  refreshThreshold?: number; // Refresh when data is this old (default: 80% of TTL)
}

interface UseSmartCacheOptions<T> extends SmartCacheOptions {
  fetcher: (key: string) => Promise<T>;
  key: string;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

// Global cache instance
class SmartCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(options: SmartCacheOptions = {}) {
    this.maxSize = options.maxSize || 50;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes
  }

  set(key: string, data: T, customTtl?: number): void {
    const now = Date.now();
    const ttl = customTtl || this.ttl;
    const expiresAt = now + ttl;

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      key
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStale(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return true;
    }

    const now = Date.now();
    return now > entry.expiresAt;
  }

  getAge(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) {
      return -1;
    }

    return Date.now() - entry.timestamp;
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Cleanup expired entries
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let totalAge = 0;
    let oldest = 0;
    let newest = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }

      const age = now - entry.timestamp;
      totalAge += age;
      oldest = Math.max(oldest, age);
      newest = newest === 0 ? age : Math.min(newest, age);
    }

    return {
      size: this.cache.size,
      expired,
      maxSize: this.maxSize,
      ttl: this.ttl,
      avgAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
      oldest,
      newest
    };
  }
}

// Global cache instances
const caches = new Map<string, SmartCache>();

export const getCache = <T = any>(name: string, options?: SmartCacheOptions): SmartCache<T> => {
  if (!caches.has(name)) {
    caches.set(name, new SmartCache<T>(options));
  }
  return caches.get(name) as SmartCache<T>;
};

// Smart cache hook
export const useSmartCache = <T>({
  fetcher,
  key,
  initialData,
  ttl = 5 * 60 * 1000, // 5 minutes
  maxSize = 50,
  enableBackgroundRefresh = true,
  refreshThreshold = 0.8, // 80% of TTL
  onSuccess,
  onError
}: UseSmartCacheOptions<T>) => {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const cacheRef = useRef(getCache<T>('smart-cache', { ttl, maxSize }));
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch data function
  const fetchData = useCallback(async (forceRefresh = false) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cache = cacheRef.current;
    const now = Date.now();

    // Check cache first (unless force refresh)
    if (!forceRefresh && cache.has(key)) {
      const cachedData = cache.get(key);
      if (cachedData !== null) {
        setData(cachedData);
        setError(null);
        setLoading(false);

        // Check if we need background refresh
        if (enableBackgroundRefresh) {
          const age = cache.getAge(key);
          const refreshTime = ttl * refreshThreshold;

          if (age > refreshTime) {
            // Refresh in background
            setTimeout(() => {
              if (!abortControllerRef.current?.signal.aborted) {
                performFetch(true);
              }
            }, 100);
          }
        }

        return;
      }
    }

    await performFetch();
  }, [key, fetcher, ttl, refreshThreshold, enableBackgroundRefresh]);

  // Perform the actual fetch
  const performFetch = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }

    setError(null);

    try {
      abortControllerRef.current = new AbortController();

      const result = await fetcher(key);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Cache the result
      cacheRef.current.set(key, result);

      // Update state
      setData(result);
      setLastFetch(Date.now());

      // Call success callback
      onSuccess?.(result);

    } catch (err) {
      // Don't update state for background refresh errors
      if (!isBackground) {
        const error = err instanceof Error ? err : new Error('Fetch failed');
        setError(error);
        setData(undefined);
        onError?.(error);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [key, fetcher, onSuccess, onError]);

  // Initial fetch and cleanup
  useEffect(() => {
    fetchData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    cacheRef.current.delete(key);
  }, [key]);

  // Check if data is stale
  const isStale = useCallback(() => {
    return cacheRef.current.isStale(key);
  }, [key]);

  // Get cache age
  const getCacheAge = useCallback(() => {
    return cacheRef.current.getAge(key);
  }, [key]);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    isStale,
    getCacheAge,
    lastFetch
  };
};

// Cache utilities
export const useCacheCleanup = (intervalMs = 60 * 1000) => { // Default: 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      let totalCleaned = 0;
      for (const cache of caches.values()) {
        totalCleaned += cache.cleanup();
      }

      if (totalCleaned > 0 && process.env.NODE_ENV === 'development') {
        console.log(`🧹 Cache cleanup: removed ${totalCleaned} expired entries`);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);
};

// Preload data into cache
export const preloadData = async <T>(
  cacheName: string,
  key: string,
  fetcher: () => Promise<T>,
  options?: SmartCacheOptions
): Promise<T> => {
  const cache = getCache<T>(cacheName, options);

  // Check if already cached
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  try {
    const data = await fetcher();
    cache.set(key, data);
    return data;
  } catch (error) {
    console.error(`Failed to preload data for key ${key}:`, error);
    throw error;
  }
};

// Batch preload utility
export const batchPreload = async <T>(
  cacheName: string,
  items: Array<{ key: string; fetcher: () => Promise<T> }>,
  options?: SmartCacheOptions
): Promise<Array<{ key: string; success: boolean; data?: T; error?: Error }>> => {
  const cache = getCache<T>(cacheName, options);
  const results = [];

  for (const item of items) {
    try {
      if (cache.has(item.key)) {
        results.push({
          key: item.key,
          success: true,
          data: cache.get(item.key)!
        });
        continue;
      }

      const data = await item.fetcher();
      cache.set(item.key, data);
      results.push({
        key: item.key,
        success: true,
        data
      });
    } catch (error) {
      results.push({
        key: item.key,
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
  }

  return results;
};