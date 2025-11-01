/**
 * User Profile component for Silence Notes Chrome Extension
 */

import React, { useState, useEffect } from 'react';
import { AuthState, User, UserPreferences } from '../types/auth';
import { AuthService } from '../services/auth';
import { PreferencesStorage } from '../utils/storage';
import { CONFIG } from '../utils/config';

interface UserProfileProps {
  authState: AuthState;
  onAuthStateChange?: (authState: AuthState) => void;
  className?: string;
}

/**
 * User profile component with preferences management
 */
export const UserProfile: React.FC<UserProfileProps> = ({
  authState,
  onAuthStateChange,
  className = ''
}) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<User>>({});
  const [editedPreferences, setEditedPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const authService = AuthService.getInstance();

  useEffect(() => {
    if (authState.user) {
      setPreferences(authState.user.preferences);
      setEditedPreferences(authState.user.preferences);
      setEditedProfile({
        name: authState.user.name,
        avatarUrl: authState.user.avatarUrl
      });
    }
  }, [authState.user]);

  const handleProfileUpdate = async () => {
    if (!authState.user || !editedProfile.name) {
      setError('Name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authService.apiRequest('/users/profile', 'PUT', {
        name: editedProfile.name,
        avatar_url: editedProfile.avatarUrl
      });

      // Update local state
      if (onAuthStateChange) {
        const updatedAuthState: AuthState = {
          ...authState,
          user: {
            ...authState.user!,
            name: editedProfile.name,
            avatarUrl: editedProfile.avatarUrl
          }
        };
        onAuthStateChange(updatedAuthState);
      }

      setIsEditingProfile(false);
      setSuccess('Profile updated successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    if (!editedPreferences) {
      setError('No preferences to update');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authService.apiRequest('/users/preferences', 'PUT', editedPreferences);

      // Update local storage
      await PreferencesStorage.savePreferences(editedPreferences);

      // Update local state
      setPreferences(editedPreferences);
      setIsEditingPreferences(false);
      setSuccess('Preferences updated successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.logout();
      if (onAuthStateChange) {
        onAuthStateChange({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to logout');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProfileSection = () => (
    <div className="profile-section">
      <div className="section-header">
        <h3 className="section-title">Profile</h3>
        {!isEditingProfile && (
          <button
            onClick={() => setIsEditingProfile(true)}
            className="edit-btn"
          >
            Edit
          </button>
        )}
      </div>

      <div className="profile-content">
        <div className="avatar-section">
          {authState.user?.avatarUrl && (
            <img
              src={authState.user.avatarUrl}
              alt={authState.user.name}
              className="profile-avatar"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = 'avatar-fallback';
                  fallback.textContent = authState.user?.name?.charAt(0).toUpperCase() || 'U';
                  parent.appendChild(fallback);
                }
              }}
            />
          )}
          {!authState.user?.avatarUrl && (
            <div className="avatar-fallback">
              {authState.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>

        <div className="profile-info">
          {isEditingProfile ? (
            <div className="edit-form">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={editedProfile.name || ''}
                  onChange={(e) => setEditedProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Avatar URL</label>
                <input
                  type="url"
                  value={editedProfile.avatarUrl || ''}
                  onChange={(e) => setEditedProfile(prev => ({ ...prev, avatarUrl: e.target.value }))}
                  className="form-input"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div className="form-actions">
                <button
                  onClick={handleProfileUpdate}
                  disabled={isLoading || !editedProfile.name}
                  className="save-btn"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setEditedProfile({
                      name: authState.user?.name,
                      avatarUrl: authState.user?.avatarUrl
                    });
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-details">
              <div className="detail-item">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{authState.user?.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{authState.user?.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Member since:</span>
                <span className="detail-value">
                  {authState.user?.createdAt ?
                    new Date(authState.user.createdAt).toLocaleDateString() :
                    'Unknown'
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPreferencesSection = () => {
    if (!preferences) return null;

    return (
      <div className="preferences-section">
        <div className="section-header">
          <h3 className="section-title">Preferences</h3>
          {!isEditingPreferences && (
            <button
              onClick={() => setIsEditingPreferences(true)}
              className="edit-btn"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingPreferences ? (
          <div className="edit-form">
            <div className="form-group">
              <label className="form-label">Theme</label>
              <select
                value={editedPreferences?.theme || 'light'}
                onChange={(e) => setEditedPreferences(prev =>
                  prev ? { ...prev, theme: e.target.value as 'light' | 'dark' } : null
                )}
                className="form-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                value={editedPreferences?.language || 'en'}
                onChange={(e) => setEditedPreferences(prev =>
                  prev ? { ...prev, language: e.target.value } : null
                )}
                className="form-select"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Time Zone</label>
              <select
                value={editedPreferences?.timeZone || 'UTC'}
                onChange={(e) => setEditedPreferences(prev =>
                  prev ? { ...prev, timeZone: e.target.value } : null
                )}
                className="form-select"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Note View</label>
              <select
                value={editedPreferences?.defaultNoteView || 'grid'}
                onChange={(e) => setEditedPreferences(prev =>
                  prev ? { ...prev, defaultNoteView: e.target.value as 'list' | 'grid' } : null
                )}
                className="form-select"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedPreferences?.emailNotifications || false}
                  onChange={(e) => setEditedPreferences(prev =>
                    prev ? { ...prev, emailNotifications: e.target.checked } : null
                  )}
                  className="form-checkbox"
                />
                Email Notifications
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedPreferences?.autoSave || false}
                  onChange={(e) => setEditedPreferences(prev =>
                    prev ? { ...prev, autoSave: e.target.checked } : null
                  )}
                  className="form-checkbox"
                />
                Auto-save Notes
              </label>
            </div>

            <div className="form-actions">
              <button
                onClick={handlePreferencesUpdate}
                disabled={isLoading}
                className="save-btn"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditingPreferences(false);
                  setEditedPreferences(preferences);
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="preferences-details">
            <div className="detail-item">
              <span className="detail-label">Theme:</span>
              <span className="detail-value">{preferences.theme}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Language:</span>
              <span className="detail-value">{preferences.language}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Time Zone:</span>
              <span className="detail-value">{preferences.timeZone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Default View:</span>
              <span className="detail-value">{preferences.defaultNoteView}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Email Notifications:</span>
              <span className="detail-value">{preferences.emailNotifications ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Auto-save:</span>
              <span className="detail-value">{preferences.autoSave ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAlerts = () => {
    if (error) {
      return (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span className="alert-message">{error}</span>
          <button
            onClick={() => setError(null)}
            className="alert-close"
          >
            ×
          </button>
        </div>
      );
    }

    if (success) {
      return (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <span className="alert-message">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="alert-close"
          >
            ×
          </button>
        </div>
      );
    }

    return null;
  };

  if (!authState.isAuthenticated || !authState.user) {
    return (
      <div className={`user-profile ${className}`}>
        <div className="auth-required">
          <p>Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`user-profile ${className}`}>
      {renderAlerts()}

      {renderProfileSection()}
      {renderPreferencesSection()}

      <div className="account-actions">
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="logout-btn"
        >
          {isLoading ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};

export default UserProfile;