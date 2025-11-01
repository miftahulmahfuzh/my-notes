import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private renderFallback() {
    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="error-boundary">
        <div className="error-boundary-content">
          <div className="error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>

          <h2 className="error-title">Oops! Something went wrong</h2>

          <p className="error-message">
            We encountered an unexpected error. Please try again or refresh the extension.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="error-details">
              <summary>Error Details</summary>
              <div className="error-stack">
                <strong>Error:</strong> {this.state.error.toString()}
                <br />
                <strong>Component Stack:</strong>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </div>
            </details>
          )}

          <div className="error-actions">
            <button
              onClick={this.handleRetry}
              className="retry-btn"
            >
              Try Again
            </button>

            <button
              onClick={() => window.location.reload()}
              className="refresh-btn"
            >
              Refresh Extension
            </button>
          </div>
        </div>
      </div>
    );
  }

  public render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

export default ErrorBoundary;