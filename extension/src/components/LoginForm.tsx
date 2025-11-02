import React, { useState, useEffect } from 'react';
import { authService, AuthState } from '../auth';

interface LoginFormProps {
  onAuthSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onAuthSuccess }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null
  });

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    const success = await authService.authenticate();
    if (success) {
      onAuthSuccess();
    }
  };

  const handleRetry = () => {
    authService.setAuthState({ error: null });
  };

  if (authState.isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Signing in...</p>
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="error-message">
        <div className="error-icon">⚠️</div>
        <h3>Authentication Failed</h3>
        <p>{authState.error}</p>
        <div className="error-actions">
          <button onClick={handleLogin} className="login-btn">
            Try Again
          </button>
          <button onClick={handleRetry} className="retry-btn">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-form">
      <div className="login-header">
        <div className="login-icon">🔐</div>
        <h2>Welcome to Silence Notes</h2>
        <p>Sign in with your Google account to sync notes across devices</p>
      </div>

      <div className="login-content">
        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon">📝</span>
            <span>Create and manage notes</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔄</span>
            <span>Sync across all your devices</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">#</span>
            <span>Organize with hashtags</span>
          </div>
        </div>

        <button
          onClick={handleLogin}
          className="google-login-btn"
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <div className="login-footer">
          <p className="security-note">
            <span className="lock-icon">🔒</span>
            Your data is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
};