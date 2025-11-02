import { useEffect, useRef, useCallback, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
}

interface PerformanceMonitorOptions {
  enabled?: boolean;
  onMetric?: (metric: PerformanceMetrics) => void;
  threshold?: number; // Alert threshold in ms
}

// Performance monitoring hook
export const usePerformanceMonitor = (
  componentName: string,
  options: PerformanceMonitorOptions = {}
) => {
  const {
    enabled = process.env.NODE_ENV === 'development',
    onMetric,
    threshold = 100 // Alert if render takes more than 100ms
  } = options;

  const renderStartRef = useRef<number>();
  const renderCountRef = useRef(0);
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  // Measure render performance
  useEffect(() => {
    if (!enabled) return;

    const renderTime = performance.now() - (renderStartRef.current || performance.now());
    const memoryUsage = (performance as any).memory?.usedJSHeapSize;

    const metric: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
      memoryUsage
    };

    metricsRef.current.push(metric);
    renderCountRef.current++;

    // Keep only last 100 metrics
    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100);
    }

    // Alert on slow renders
    if (renderTime > threshold) {
      console.warn(`⚠️ Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }

    // Call custom metric handler
    onMetric?.(metric);

    // Log performance data in development
    if (process.env.NODE_ENV === 'development' && renderCountRef.current % 10 === 0) {
      const avgRenderTime = metricsRef.current.reduce((sum, m) => sum + m.renderTime, 0) / metricsRef.current.length;
      console.log(`📊 Performance: ${componentName} - Avg: ${avgRenderTime.toFixed(2)}ms, Renders: ${renderCountRef.current}`);
    }
  });

  // Start render timing
  renderStartRef.current = performance.now();

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    if (metricsRef.current.length === 0) {
      return null;
    }

    const metrics = metricsRef.current;
    const renderTimes = metrics.map(m => m.renderTime);
    const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);
    const recentAvg = renderTimes.slice(-10).reduce((sum, time) => sum + time, 0) / Math.min(10, renderTimes.length);

    return {
      componentName,
      totalRenders: renderCountRef.current,
      avgRenderTime,
      maxRenderTime,
      minRenderTime,
      recentAvg,
      memoryUsage: metrics[metrics.length - 1]?.memoryUsage
    };
  }, [componentName]);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
    renderCountRef.current = 0;
  }, []);

  return {
    getPerformanceSummary,
    clearMetrics,
    renderCount: renderCountRef.current
  };
};

// Global performance monitor
class GlobalPerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private listeners: Array<(metrics: PerformanceMetrics) => void> = [];

  addMetric(metric: PerformanceMetrics) {
    const componentName = metric.componentName;
    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }

    const componentMetrics = this.metrics.get(componentName)!;
    componentMetrics.push(metric);

    // Keep only last 100 metrics per component
    if (componentMetrics.length > 100) {
      componentMetrics.splice(0, componentMetrics.length - 100);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(metric));
  }

  getMetrics(componentName?: string): Map<string, PerformanceMetrics[]> {
    if (componentName) {
      const metrics = this.metrics.get(componentName);
      return metrics ? new Map([[componentName, metrics]]) : new Map();
    }
    return new Map(this.metrics);
  }

  getSummary(componentName?: string) {
    const metricsMap = this.getMetrics(componentName);
    const summary: Record<string, any> = {};

    metricsMap.forEach((metrics, name) => {
      if (metrics.length === 0) return;

      const renderTimes = metrics.map(m => m.renderTime);
      summary[name] = {
        totalRenders: metrics.length,
        avgRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length,
        maxRenderTime: Math.max(...renderTimes),
        minRenderTime: Math.min(...renderTimes),
        lastRender: metrics[metrics.length - 1].timestamp,
        memoryUsage: metrics[metrics.length - 1]?.memoryUsage
      };
    });

    return summary;
  }

  addListener(listener: (metrics: PerformanceMetrics) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  clearMetrics(componentName?: string) {
    if (componentName) {
      this.metrics.delete(componentName);
    } else {
      this.metrics.clear();
    }
  }
}

export const globalPerformanceMonitor = new GlobalPerformanceMonitor();

// Memory usage monitoring
export const useMemoryMonitor = () => {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number;
    total: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryUsage = () => {
      const memory = (performance as any).memory;
      if (memory) {
        setMemoryUsage({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        });
      }
    };

    // Initial reading
    updateMemoryUsage();

    // Update every 5 seconds
    const interval = setInterval(updateMemoryUsage, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryUsage;
};

// Network performance monitoring
export const useNetworkMonitor = () => {
  const [networkInfo, setNetworkInfo] = useState<{
    effectiveType: string;
    downlink: number;
    rtt: number;
  } | null>(null);

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;

      if (connection) {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        });
      }
    };

    updateNetworkInfo();

    // Listen for network changes
    const connection = (navigator as any).connection;
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', updateNetworkInfo);
      return () => connection.removeEventListener('change', updateNetworkInfo);
    }
  }, []);

  return networkInfo;
};

// Performance optimization utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Lazy loading utility
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  componentName: string
) => {
  return React.lazy(() => {
    const start = performance.now();
    return importFunc().then(module => {
      const loadTime = performance.now() - start;
      console.log(`📦 Lazy loaded ${componentName} in ${loadTime.toFixed(2)}ms`);
      return module;
    });
  });
};