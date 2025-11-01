/**
 * Timestamp utilities for sync operations
 */

export interface TimestampRange {
  start: string;
  end: string;
}

export interface SyncTimestamp {
  lastSyncAt: string | null;
  clientTimestamp: string;
  serverTimestamp?: string;
  delta: number; // Difference between client and server time in milliseconds
}

export class TimestampManager {
  private timeDelta: number = 0; // Server time - client time in milliseconds
  private lastCalibration: string | null = null;

  /**
   * Calibrate time with server
   */
  async calibrateWithServer(serverTime: string): Promise<void> {
    const clientTime = new Date().toISOString();
    const serverDate = new Date(serverTime);
    const clientDate = new Date(clientTime);

    this.timeDelta = serverDate.getTime() - clientDate.getTime();
    this.lastCalibration = clientTime;

    console.log(`Time calibrated: delta=${this.timeDelta}ms, server=${serverTime}, client=${clientTime}`);
  }

  /**
   * Get server-adjusted timestamp
   */
  getServerTimestamp(): string {
    const now = new Date();
    const adjustedTime = new Date(now.getTime() + this.timeDelta);
    return adjustedTime.toISOString();
  }

  /**
   * Convert client timestamp to server timestamp
   */
  toServerTimestamp(clientTimestamp: string): string {
    const clientDate = new Date(clientTimestamp);
    const adjustedTime = new Date(clientDate.getTime() + this.timeDelta);
    return adjustedTime.toISOString();
  }

  /**
   * Convert server timestamp to client timestamp
   */
  toClientTimestamp(serverTimestamp: string): string {
    const serverDate = new Date(serverTimestamp);
    const adjustedTime = new Date(serverDate.getTime() - this.timeDelta);
    return adjustedTime.toISOString();
  }

  /**
   * Check if timestamp is recent (within specified minutes)
   */
  isRecent(timestamp: string, minutes: number = 5): boolean {
    const now = new Date();
    const targetTime = new Date(timestamp);
    const diffMinutes = (now.getTime() - targetTime.getTime()) / (1000 * 60);
    return diffMinutes <= minutes;
  }

  /**
   * Get timestamp range for sync operations
   */
  getSyncRange(lookbackMinutes: number = 60): TimestampRange {
    const now = this.getServerTimestamp();
    const end = new Date(now);
    const start = new Date(end.getTime() - lookbackMinutes * 60 * 1000);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  /**
   * Compare two timestamps
   */
  compare(timestamp1: string, timestamp2: string): number {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return date1.getTime() - date2.getTime();
  }

  /**
   * Get time delta information
   */
  getTimeDelta(): {
    delta: number;
    lastCalibration: string | null;
    isCalibrated: boolean;
  } {
    return {
      delta: this.timeDelta,
      lastCalibration: this.lastCalibration,
      isCalibrated: this.lastCalibration !== null
    };
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string, format: 'relative' | 'absolute' | 'both' = 'relative'): string {
    const date = new Date(timestamp);
    const now = new Date();

    switch (format) {
      case 'relative':
        return this.getRelativeTimeString(date, now);
      case 'absolute':
        return date.toLocaleString();
      case 'both':
        return `${this.getRelativeTimeString(date, now)} (${date.toLocaleString()})`;
      default:
        return timestamp;
    }
  }

  /**
   * Get relative time string
   */
  private getRelativeTimeString(date: Date, now: Date): string {
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Parse timestamp from various formats
   */
  parseTimestamp(timestamp: any): string | null {
    if (!timestamp) return null;

    if (typeof timestamp === 'string') {
      // Try to parse ISO string
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } else if (typeof timestamp === 'number') {
      // Unix timestamp in seconds or milliseconds
      const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } else if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }

    return null;
  }

  /**
   * Validate timestamp format
   */
  isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
  }

  /**
   * Round timestamp to nearest interval (e.g., nearest minute)
   */
  roundTimestamp(timestamp: string, intervalMs: number = 60000): string {
    const date = new Date(timestamp);
    const roundedTime = Math.round(date.getTime() / intervalMs) * intervalMs;
    return new Date(roundedTime).toISOString();
  }

  /**
   * Get timezone offset for timestamp
   */
  getTimezoneOffset(timestamp: string): number {
    const date = new Date(timestamp);
    return date.getTimezoneOffset();
  }

  /**
   * Add duration to timestamp
   */
  addDuration(timestamp: string, duration: {
    years?: number;
    months?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
  }): string {
    const date = new Date(timestamp);

    if (duration.years) date.setFullYear(date.getFullYear() + duration.years);
    if (duration.months) date.setMonth(date.getMonth() + duration.months);
    if (duration.days) date.setDate(date.getDate() + duration.days);
    if (duration.hours) date.setHours(date.getHours() + duration.hours);
    if (duration.minutes) date.setMinutes(date.getMinutes() + duration.minutes);
    if (duration.seconds) date.setSeconds(date.getSeconds() + duration.seconds);
    if (duration.milliseconds) date.setMilliseconds(date.getMilliseconds() + duration.milliseconds);

    return date.toISOString();
  }

  /**
   * Get duration between two timestamps
   */
  getDuration(start: string, end: string): {
    milliseconds: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
  } {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();

    return {
      milliseconds: diffMs,
      seconds: diffMs / 1000,
      minutes: diffMs / (1000 * 60),
      hours: diffMs / (1000 * 60 * 60),
      days: diffMs / (1000 * 60 * 60 * 24)
    };
  }

  /**
   * Generate unique timestamp-based ID
   */
  generateTimestampId(): string {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${random}`;
  }

  /**
   * Serialize timestamp information
   */
  serialize(): {
    timeDelta: number;
    lastCalibration: string | null;
  } {
    return {
      timeDelta: this.timeDelta,
      lastCalibration: this.lastCalibration
    };
  }

  /**
   * Deserialize timestamp information
   */
  deserialize(data: {
    timeDelta: number;
    lastCalibration: string | null;
  }): void {
    this.timeDelta = data.timeDelta;
    this.lastCalibration = data.lastCalibration;
  }
}

// Export singleton instance
export const timestampManager = new TimestampManager();

/**
 * Utility functions for common timestamp operations
 */
export function isValidISODate(dateString: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  return isoRegex.test(dateString) && !isNaN(new Date(dateString).getTime());
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function getTimeAgo(timestamp: string): string {
  return timestampManager.formatTimestamp(timestamp, 'relative');
}

export function isTimestampOlderThan(timestamp: string, minutes: number): boolean {
  return !timestampManager.isRecent(timestamp, minutes);
}