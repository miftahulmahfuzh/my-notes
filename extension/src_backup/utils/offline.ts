/**
 * Offline detection and network status utilities
 */

import { OfflineStatus } from '../types/storage';

export class OfflineDetector {
  private static instance: OfflineDetector;
  private isOnline: boolean = navigator.onLine;
  private lastOnlineAt: string | null = null;
  private listeners: ((status: OfflineStatus) => void)[] = [];
  private connectionMonitorInterval: NodeJS.Timeout | null = null;
  private retryAttempts: number = 0;
  private maxRetryAttempts: number = 5;

  private constructor() {
    this.initializeEventListeners();
    this.startConnectionMonitoring();
  }

  public static getInstance(): OfflineDetector {
    if (!OfflineDetector.instance) {
      OfflineDetector.instance = new OfflineDetector();
    }
    return OfflineDetector.instance;
  }

  /**
   * Get current offline status
   */
  public getStatus(): OfflineStatus {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    return {
      isOnline: this.isOnline,
      lastOnlineAt: this.lastOnlineAt,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown'
    };
  }

  /**
   * Check if device is online
   */
  public isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Add status change listener
   */
  public addListener(listener: (status: OfflineStatus) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove status change listener
   */
  public removeListener(listener: (status: OfflineStatus) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Test network connectivity by making a request
   */
  public async testConnectivity(): Promise<boolean> {
    try {
      // Try to fetch a small resource to test connectivity
      const response = await fetch('https://httpbin.org/json', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch (error) {
      // Fallback: try Chrome extension runtime connectivity
      try {
        await chrome.runtime.sendMessage({ type: 'ping' });
        return true;
      } catch (chromeError) {
        return false;
      }
    }
  }

  /**
   * Wait for network to be available
   */
  public async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        this.removeListener(onConnectionAvailable);
        resolve(false);
      }, timeoutMs);

      const onConnectionAvailable = (status: OfflineStatus) => {
        if (status.isOnline) {
          clearTimeout(timeout);
          this.removeListener(onConnectionAvailable);
          resolve(true);
        }
      };

      this.addListener(onConnectionAvailable);
    });
  }

  /**
   * Get network quality metrics
   */
  public getNetworkQuality(): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    downlink: number | null;
    rtt: number | null;
    effectiveType: string;
  } {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) {
      return {
        quality: 'fair',
        downlink: null,
        rtt: null,
        effectiveType: 'unknown'
      };
    }

    let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';

    if (connection.downlink && connection.rtt) {
      if (connection.downlink > 10 && connection.rtt < 50) {
        quality = 'excellent';
      } else if (connection.downlink > 5 && connection.rtt < 150) {
        quality = 'good';
      } else if (connection.downlink > 1.5 && connection.rtt < 300) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
    }

    return {
      quality,
      downlink: connection.downlink || null,
      rtt: connection.rtt || null,
      effectiveType: connection.effectiveType || 'unknown'
    };
  }

  /**
   * Execute function when online, with retry logic
   */
  public async executeWhenOnline<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      retryBackoff?: boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = this.maxRetryAttempts,
      retryDelay = 1000,
      retryBackoff = true
    } = options;

    let attempt = 0;

    while (attempt < maxRetries) {
      if (this.isOnline) {
        try {
          return await fn();
        } catch (error) {
          attempt++;
          if (attempt >= maxRetries) {
            throw error;
          }
        }
      } else {
        // Wait for connection
        const connected = await this.waitForConnection(5000);
        if (!connected) {
          attempt++;
        }
      }

      if (attempt < maxRetries) {
        const delay = retryBackoff ? retryDelay * Math.pow(2, attempt - 1) : retryDelay;
        await this.sleep(delay);
      }
    }

    throw new Error(`Failed to execute function after ${maxRetries} attempts`);
  }

  /**
   * Get connection type recommendations
   */
  public getConnectionRecommendations(): {
    canSync: boolean;
    canStream: boolean;
    recommendedBatchSize: number;
    recommendedTimeout: number;
  } {
    const quality = this.getNetworkQuality();
    const status = this.getStatus();

    if (!status.isOnline) {
      return {
        canSync: false,
        canStream: false,
        recommendedBatchSize: 0,
        recommendedTimeout: 0
      };
    }

    switch (quality.quality) {
      case 'excellent':
        return {
          canSync: true,
          canStream: true,
          recommendedBatchSize: 100,
          recommendedTimeout: 5000
        };
      case 'good':
        return {
          canSync: true,
          canStream: true,
          recommendedBatchSize: 50,
          recommendedTimeout: 10000
        };
      case 'fair':
        return {
          canSync: true,
          canStream: false,
          recommendedBatchSize: 25,
          recommendedTimeout: 15000
        };
      case 'poor':
        return {
          canSync: true,
          canStream: false,
          recommendedBatchSize: 10,
          recommendedTimeout: 30000
        };
      default:
        return {
          canSync: true,
          canStream: false,
          recommendedBatchSize: 5,
          recommendedTimeout: 60000
        };
    }
  }

  /**
   * Destroy the detector and clean up resources
   */
  public destroy(): void {
    this.removeEventListeners();
    this.stopConnectionMonitoring();
    this.listeners = [];
  }

  // Private methods

  private initializeEventListeners(): void {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen to connection changes if available
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', this.handleConnectionChange);
    }

    // Initial status
    this.updateOnlineStatus(navigator.onLine);
  }

  private removeEventListeners(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.removeEventListener('change', this.handleConnectionChange);
    }
  }

  private startConnectionMonitoring(): void {
    // Monitor connection every 30 seconds
    this.connectionMonitorInterval = setInterval(async () => {
      const wasOnline = this.isOnline;
      const isOnline = await this.testConnectivity();

      if (wasOnline !== isOnline) {
        this.updateOnlineStatus(isOnline);
      }
    }, 30000);
  }

  private stopConnectionMonitoring(): void {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
  }

  private handleOnline = (): void => {
    this.updateOnlineStatus(true);
    this.retryAttempts = 0;
  };

  private handleOffline = (): void => {
    this.updateOnlineStatus(false);
  };

  private handleConnectionChange = (): void => {
    // Connection type changed, update status
    const status = this.getStatus();
    this.notifyListeners(status);
  };

  private updateOnlineStatus(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (isOnline) {
      this.lastOnlineAt = new Date().toISOString();
    }

    // Only notify if status actually changed
    if (wasOnline !== isOnline) {
      const status = this.getStatus();
      this.notifyListeners(status);
    }
  }

  private notifyListeners(status: OfflineStatus): void {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in offline status listener:', error);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const offlineDetector = OfflineDetector.getInstance();

/**
 * Utility function to check if the app is offline
 */
export function isOffline(): boolean {
  return !offlineDetector.isCurrentlyOnline();
}

/**
 * Utility function to wait for network connection
 */
export function waitForConnection(timeoutMs?: number): Promise<boolean> {
  return offlineDetector.waitForConnection(timeoutMs);
}

/**
 * Utility function to execute a function when online
 */
export function executeWhenOnline<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    retryBackoff?: boolean;
  }
): Promise<T> {
  return offlineDetector.executeWhenOnline(fn, options);
}