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
    await authService.logout();
    onLogout();
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const getUserInitials = (user: User): string => {
    if (!user.name) return '?';
    return user.name
      .split(' ')
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
      <div className="user-info">
        <div className="user-avatar">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="avatar-img"
            />
          ) : (
            <div className="avatar-fallback">
              {getUserInitials(user)}
            </div>
          )}
        </div>

        <div className="user-details">
          <div className="user-name">{user.name}</div>
          <div className="user-email">{user.email}</div>
        </div>
      </div>

      <div className="user-actions">
        <button
          onClick={handleLogoutClick}
          className="logout-btn"
          title="Sign out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="logout-confirm">
          <div className="logout-confirm-content">
            <h4>Sign Out?</h4>
            <p>You'll need to sign in again to access your notes.</p>
            <div className="logout-confirm-actions">
              <button onClick={cancelLogout} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleLogout} className="confirm-logout-btn">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};