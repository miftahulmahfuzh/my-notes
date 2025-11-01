/**
 * Popup component for Silence Notes Chrome Extension
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AuthButton from '../components/AuthButton';
import { AuthState } from '../types/auth';
import { AuthService } from '../services/auth';
import { PreferencesStorage } from '../utils/storage';
import './popup.css';

/**
 * Main popup component
 */
const Popup: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    tokens: null,
    isLoading: true,
    error: null
  });

  const [preferences, setPreferences] = useState({
    theme: 'light' as 'light' | 'dark',
    language: 'en'
  });

  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Load user preferences
        const userPreferences = await PreferencesStorage.getPreferences();
        setPreferences({
          theme: userPreferences.theme,
          language: userPreferences.language
        });

        // Initialize auth state
        const authService = AuthService.getInstance();
        const state = await authService.initialize();
        setAuthState(state);
      } catch (error) {
        console.error('Failed to initialize popup:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize'
        }));
      }
    };

    initializePopup();
  }, []);

  const handleAuthStateChange = (newState: AuthState) => {
    setAuthState(newState);
  };

  const renderWelcomeScreen = () => (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">Silence Notes</h1>
        <p className="popup-subtitle">Brutalist note-taking</p>
      </header>

      <main className="popup-main">
        <div className="welcome-section">
          <div className="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h2 className="welcome-title">Welcome to Silence Notes</h2>
          <p className="welcome-description">
            Sign in to sync your notes across devices and unlock all features.
          </p>
        </div>

        <div className="auth-section">
          <AuthButton onAuthStateChange={handleAuthStateChange} />
        </div>

        <div className="features-section">
          <h3 className="features-title">Features</h3>
          <ul className="features-list">
            <li className="feature-item">
              <span className="feature-icon">#</span>
              <span className="feature-text">Hashtag organization</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">☁️</span>
              <span className="feature-text">Cloud synchronization</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Secure authentication</span>
            </li>
            <li className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Lightning fast</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="popup-footer">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="options-button"
        >
          Settings
        </button>
      </footer>
    </div>
  );

  const renderMainApp = () => (
    <div className="popup-container">
      <header className="popup-header">
        <div className="header-content">
          <h1 className="popup-title">Silence Notes</h1>
          <div className="user-info">
            {authState.user && (
              <div className="user-avatar">
                {authState.user.avatarUrl ? (
                  <img
                    src={authState.user.avatarUrl}
                    alt={authState.user.name}
                    className="avatar-img"
                  />
                ) : (
                  <div className="avatar-fallback">
                    {authState.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="popup-main">
        <div className="notes-section">
          <div className="section-header">
            <h2 className="section-title">Recent Notes</h2>
            <button className="add-note-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Note
            </button>
          </div>

          <div className="notes-list">
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <p className="empty-text">No notes yet</p>
              <p className="empty-subtext">Create your first note to get started</p>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <button className="action-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            Search
          </button>
          <button className="action-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            All Notes
          </button>
          <button className="action-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Tags
          </button>
        </div>
      </main>

      <footer className="popup-footer">
        <AuthButton onAuthStateChange={handleAuthStateChange} />
      </footer>
    </div>
  );

  const renderLoadingScreen = () => (
    <div className="popup-container">
      <div className="loading-screen">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p className="loading-text">Loading Silence Notes...</p>
      </div>
    </div>
  );

  // Render loading screen
  if (authState.isLoading) {
    return renderLoadingScreen();
  }

  // Render main app if authenticated
  if (authState.isAuthenticated) {
    return renderMainApp();
  }

  // Render welcome screen if not authenticated
  return renderWelcomeScreen();
};

/**
 * Initialize popup
 */
const initializePopup = () => {
  const container = document.getElementById('popup-root');
  if (!container) {
    console.error('Popup root container not found');
    return;
  }

  const root = createRoot(container);
  root.render(<Popup />);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

export default Popup;