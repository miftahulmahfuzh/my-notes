import React, { useState, useEffect } from 'react';
import { authService, User } from '../auth';

interface SimpleUserProfileProps {
  onLogout: () => void;
}

export const SimpleUserProfile: React.FC<SimpleUserProfileProps> = ({ onLogout }) => {
  const [user, setUser] = useState<User | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Get current user
    const authState = authService.getAuthState();
    setUser(authState.user);

    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Log error but still proceed with logout
      console.error('Logout failed:', error);
    } finally {
      // Always call onLogout, even if authService.logout fails
      onLogout();
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const getUserInitials = (user: User): string => {
    // Use email to generate initials since name field is not available
    return user.email
      .split('@')[0]
      .split('.')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="user-avatar">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.email}
            className="avatar-img"
          />
        ) : (
          <div className="avatar-fallback">
            {getUserInitials(user)}
          </div>
        )}
      </div>

      <div className="user-info">
        <div className="user-email">{user.email}</div>
      </div>

      <button
        onClick={handleLogoutClick}
        className="btn-tertiary"
        title="Sign out"
      >
        <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16,17 21,12 16,7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Logout
      </button>

      {showLogoutConfirm && (
        <div className="logout-confirm">
          <div className="card">
            <div className="card-content">
              <h3 className="text-h3 font-display mb-4">Sign Out?</h3>
              <p className="text-base mb-6">You'll need to sign in again to access your notes.</p>
              <div className="flex gap-3">
                <button onClick={cancelLogout} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={handleLogout} className="btn-primary flex-1">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};