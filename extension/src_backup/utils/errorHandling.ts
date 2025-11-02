/**
 * Comprehensive Error Handling and User Feedback System
 *
 * This module provides centralized error handling, user-friendly error messages,
 * and feedback mechanisms for the notes application.
 */

export enum ErrorType {
  NETWORK = 'network',
  STORAGE = 'storage',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SYNC = 'sync',
  PERMISSION = 'permission',
  QUOTA = 'quota',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  timestamp: Date;
  context?: Record<string, any>;
  retryable: boolean;
  actions?: ErrorAction[];
}

export interface ErrorAction {
  label: string;
  action: () => Promise<void> | void;
  primary?: boolean;
}

export interface ErrorReport {
  error: AppError;
  userAgent: string;
  url: string;
  extensionVersion: string;
  browserInfo: string;
  systemInfo: string;
  reproductionSteps?: string[];
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHistory: AppError[] = [];
  private maxHistorySize = 100;
  private subscribers: Array<(error: AppError) => void> = [];

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with automatic categorization and user-friendly messages
   */
  public handleError(error: Error | AppError, context?: Record<string, any>): AppError {
    const appError = this.createAppError(error, context);
    this.recordError(appError);
    this.notifySubscribers(appError);

    // Log to console for debugging
    this.logError(appError);

    // Report critical errors
    if (appError.severity === ErrorSeverity.CRITICAL) {
      this.reportError(appError);
    }

    return appError;
  }

  /**
   * Create user-friendly error messages based on error type
   */
  public createUserMessage(error: Error, type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return this.getNetworkErrorMessage(error);
      case ErrorType.STORAGE:
        return this.getStorageErrorMessage(error);
      case ErrorType.AUTHENTICATION:
        return this.getAuthenticationErrorMessage(error);
      case ErrorType.VALIDATION:
        return this.getValidationErrorMessage(error);
      case ErrorType.SYNC:
        return this.getSyncErrorMessage(error);
      case ErrorType.PERMISSION:
        return this.getPermissionErrorMessage(error);
      case ErrorType.QUOTA:
        return this.getQuotaErrorMessage(error);
      default:
        return this.getDefaultErrorMessage(error);
    }
  }

  /**
   * Get suggested actions for different error types
   */
  public getErrorActions(error: AppError): ErrorAction[] {
    if (error.actions) {
      return error.actions;
    }

    const actions: ErrorAction[] = [];

    switch (error.type) {
      case ErrorType.NETWORK:
        actions.push(
          {
            label: 'Retry',
            action: () => this.retryOperation(error),
            primary: true,
          },
          {
            label: 'Check Connection',
            action: () => this.checkConnection(),
          }
        );
        break;

      case ErrorType.STORAGE:
        if (error.message.includes('QUOTA_EXCEEDED')) {
          actions.push(
            {
              label: 'Clear Old Notes',
              action: () => this.clearOldNotes(),
              primary: true,
            },
            {
              label: 'Export & Delete',
              action: () => this.exportAndDelete(),
            }
          );
        } else {
          actions.push(
            {
              label: 'Retry',
              action: () => this.retryOperation(error),
              primary: true,
            }
          );
        }
        break;

      case ErrorType.AUTHENTICATION:
        actions.push(
          {
            label: 'Sign In Again',
            action: () => this.reauthenticate(),
            primary: true,
          }
        );
        break;

      case ErrorType.SYNC:
        actions.push(
          {
            label: 'Try Again',
            action: () => this.retryOperation(error),
            primary: true,
          },
          {
            label: 'Work Offline',
            action: () => this.enableOfflineMode(),
          }
        );
        break;

      case ErrorType.PERMISSION:
        actions.push(
          {
            label: 'Grant Permission',
            action: () => this.requestPermission(error.context?.permission),
            primary: true,
          }
        );
        break;

      default:
        if (error.retryable) {
          actions.push({
            label: 'Retry',
            action: () => this.retryOperation(error),
            primary: true,
          });
        }
        actions.push({
          label: 'Report Issue',
          action: () => this.reportErrorManually(error),
        });
    }

    return actions;
  }

  /**
   * Subscribe to error notifications
   */
  public subscribe(callback: (error: AppError) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get recent errors for debugging
   */
  public getRecentErrors(count: number = 10): AppError[] {
    return this.errorHistory.slice(-count);
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: AppError[];
  } {
    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<ErrorType, number>);

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = 0;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    this.errorHistory.forEach(error => {
      byType[error.type]++;
      bySeverity[error.severity]++;
    });

    return {
      total: this.errorHistory.length,
      byType,
      bySeverity,
      recent: this.getRecentErrors(5),
    };
  }

  // Private methods

  private createAppError(error: Error | AppError, context?: Record<string, any>): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    const type = this.categorizeError(error);
    const severity = this.determineSeverity(error, type);

    return {
      id: this.generateErrorId(),
      type,
      severity,
      message: error.message,
      userMessage: this.createUserMessage(error, type),
      technicalDetails: error.stack,
      timestamp: new Date(),
      context,
      retryable: this.isRetryable(error, type),
    };
  }

  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'id' in error && 'type' in error;
  }

  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorType.NETWORK;
    }

    if (message.includes('storage') || message.includes('quota') || message.includes('chrome.storage')) {
      if (message.includes('quota')) {
        return ErrorType.QUOTA;
      }
      return ErrorType.STORAGE;
    }

    if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
      return ErrorType.AUTHENTICATION;
    }

    if (message.includes('validation') || message.includes('required') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }

    if (message.includes('sync') || message.includes('conflict')) {
      return ErrorType.SYNC;
    }

    if (message.includes('permission') || message.includes('denied')) {
      return ErrorType.PERMISSION;
    }

    return ErrorType.UNKNOWN;
  }

  private determineSeverity(error: Error, type: ErrorType): ErrorSeverity {
    const message = error.message.toLowerCase();

    // Critical errors
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity by type
    if ([ErrorType.AUTHENTICATION, ErrorType.PERMISSION].includes(type)) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity for storage and sync issues
    if ([ErrorType.STORAGE, ErrorType.SYNC].includes(type)) {
      return ErrorSeverity.MEDIUM;
    }

    // Check message content for severity indicators
    if (message.includes('failed') || message.includes('error')) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  private isRetryable(error: Error, type: ErrorType): boolean {
    const nonRetryableTypes = [ErrorType.VALIDATION, ErrorType.PERMISSION];
    if (nonRetryableTypes.includes(type)) {
      return false;
    }

    const nonRetryableMessages = ['quota exceeded', 'invalid', 'required', 'denied'];
    return !nonRetryableMessages.some(msg => error.message.toLowerCase().includes(msg));
  }

  private recordError(error: AppError): void {
    this.errorHistory.push(error);

    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private notifySubscribers(error: AppError): void {
    this.subscribers.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error subscriber:', callbackError);
      }
    });
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.type.toUpperCase()}] ${error.userMessage}`;

    switch (logLevel) {
      case 'error':
        console.error(message, error);
        break;
      case 'warn':
        console.warn(message, error);
        break;
      default:
        console.log(message, error);
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'log';
    }
  }

  private async reportError(error: AppError): Promise<void> {
    try {
      const report: ErrorReport = {
        error,
        userAgent: navigator.userAgent,
        url: window.location.href,
        extensionVersion: chrome.runtime.getManifest().version,
        browserInfo: this.getBrowserInfo(),
        systemInfo: this.getSystemInfo(),
      };

      // Send to error reporting service
      await fetch('/api/v1/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private getBrowserInfo(): string {
    return `${navigator.userAgent} - ${navigator.language}`;
  }

  private getSystemInfo(): string {
    return `${navigator.platform} - ${navigator.hardwareConcurrency || 'unknown'} cores`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), { source: 'unhandledRejection' });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        source: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  // Error message generators

  private getNetworkErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'Request timed out. Please check your internet connection and try again.';
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection lost. Please check your internet connection.';
    }

    if (message.includes('cors')) {
      return 'Unable to connect to the server. Please try again later.';
    }

    return 'Network error occurred. Please check your connection and try again.';
  }

  private getStorageErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('quota')) {
      return 'Storage space is running low. Please delete some old notes or export them to free up space.';
    }

    if (message.includes('permission')) {
      return 'Storage access denied. Please check browser permissions.';
    }

    return 'Unable to save data locally. Please try again.';
  }

  private getAuthenticationErrorMessage(error: Error): string {
    return 'Your session has expired. Please sign in again to continue.';
  }

  private getValidationErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('required')) {
      return 'Please fill in all required fields.';
    }

    if (message.includes('invalid')) {
      return 'Please check your input and try again.';
    }

    return 'Please check your input and correct any errors.';
  }

  private getSyncErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('conflict')) {
      return 'Sync conflict detected. Please choose which version to keep or merge them manually.';
    }

    return 'Sync failed. Your changes will be saved locally and synced when possible.';
  }

  private getPermissionErrorMessage(error: Error): string {
    return 'Permission denied. Please grant the necessary permissions to continue.';
  }

  private getQuotaErrorMessage(error: Error): string {
    return 'Storage quota exceeded. Please delete some notes or export them to make space.';
  }

  private getDefaultErrorMessage(error: Error): string {
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }

  // Action implementations

  private async retryOperation(error: AppError): Promise<void> {
    // Implementation depends on the context stored in the error
    if (error.context?.retryFunction) {
      try {
        await error.context.retryFunction();
      } catch (retryError) {
        this.handleError(retryError as Error, {
          source: 'retry',
          originalError: error.id,
        });
      }
    }
  }

  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
      });
      console.log('Connection check completed');
    } catch (error) {
      console.warn('Connection check failed:', error);
    }
  }

  private async clearOldNotes(): Promise<void> {
    // Implementation for clearing old notes
    if (confirm('This will delete notes older than 30 days. Continue?')) {
      // Clear old notes logic
      console.log('Clearing old notes...');
    }
  }

  private async exportAndDelete(): Promise<void> {
    // Implementation for exporting and deleting notes
    console.log('Exporting notes...');
  }

  private async reauthenticate(): Promise<void> {
    try {
      // Trigger Google authentication
      await chrome.identity.getAuthToken({
        interactive: true,
      });
    } catch (error) {
      this.handleError(error as Error, { source: 'reauthentication' });
    }
  }

  private enableOfflineMode(): Promise<void> {
    // Enable offline mode
    console.log('Enabling offline mode...');
    return Promise.resolve();
  }

  private async requestPermission(permission?: string): Promise<void> {
    try {
      if (permission) {
        await chrome.permissions.request({ permissions: [permission] });
      }
    } catch (error) {
      this.handleError(error as Error, { source: 'permissionRequest' });
    }
  }

  private async reportErrorManually(error: AppError): Promise<void> {
    // Open error reporting form or contact support
    console.log('Reporting error:', error);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export utility functions
export function handleError(error: Error | AppError, context?: Record<string, any>): AppError {
  return errorHandler.handleError(error, context);
}

export function createUserMessage(error: Error, type: ErrorType): string {
  return errorHandler.createUserMessage(error, type);
}

export function getErrorActions(error: AppError): ErrorAction[] {
  return errorHandler.getErrorActions(error);
}

// React hook for error handling
export function useErrorHandler() {
  const [errors, setErrors] = React.useState<AppError[]>([]);

  React.useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error) => {
      setErrors(prev => [...prev.slice(-9), error]); // Keep last 10 errors
    });

    return unsubscribe;
  }, []);

  const handle = React.useCallback((error: Error | AppError, context?: Record<string, any>) => {
    return errorHandler.handleError(error, context);
  }, []);

  const clearErrors = React.useCallback(() => {
    setErrors([]);
  }, []);

  const getErrorStats = React.useCallback(() => {
    return errorHandler.getErrorStats();
  }, []);

  return {
    errors,
    handle,
    clearErrors,
    getErrorStats,
    subscribe: errorHandler.subscribe.bind(errorHandler),
  };
}

// Import React for the hook
import React from 'react';