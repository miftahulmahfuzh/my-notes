/**
 * Authentication button component for Silence Notes
 */

import React, { useState, useEffect } from 'react';
import { AuthState, User } from '../types/auth';
import { AuthService } from '../services/auth';
import { ERROR_MESSAGES } from '../utils/config';

interface AuthButtonProps {
  onAuthStateChange?: (authState: AuthState) => void;
  className?: string;
}

/**
 * Authentication button component handling sign-in/sign-out
 */
export const AuthButton: React.FC<AuthButtonProps> = ({
  onAuthStateChange,
  className = ''
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    tokens: null,
    isLoading: true,
    error: null
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const authService = AuthService.getInstance();

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const state = await authService.initialize();
        setAuthState(state);
        onAuthStateChange?.(state);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        const errorState: AuthState = {
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          error: ERROR_MESSAGES.UNKNOWN_ERROR
        };
        setAuthState(errorState);
        onAuthStateChange?.(errorState);
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange((newState) => {
      setAuthState(newState);
      onAuthStateChange?.(newState);
    });

    return unsubscribe;
  }, [onAuthStateChange]);

  const handleSignIn = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setAuthState(prev => ({ ...prev, error: null }));

    try {
      const authService = AuthService.getInstance();

      // Send message to background script to start OAuth flow
      chrome.runtime.sendMessage(
        { type: 'AUTH_START' },
        (response) => {
          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
          }

          if (response.type === 'AUTH_ERROR') {
            throw new Error(response.payload.error);
          }

          // Auth was successful, update state
          setAuthState(prev => ({ ...prev, isLoading: true }));
        }
      );
    } catch (error) {
      console.error('Sign-in failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setAuthState(prev => ({ ...prev, error: null }));

    try {
      const authService = AuthService.getInstance();

      // Send message to background script to logout
      chrome.runtime.sendMessage(
        { type: 'AUTH_LOGOUT' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Logout message failed:', chrome.runtime.lastError.message);
          }

          // Even if background communication fails, clear local state
          authService.logout().catch(console.error);
        }
      );
    } catch (error) {
      console.error('Sign-out failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderUserProfile = (user: User) => (
    <div className="flex items-center space-x-3">
      {user.avatarUrl && (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="w-8 h-8 rounded-full border-2 border-black"
          onError={(e) => {
            // Fallback to initials if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.className = 'w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold';
              fallback.textContent = user.name.charAt(0).toUpperCase();
              parent.appendChild(fallback);
            }
          }}
        />
      )}
      {!user.avatarUrl && (
        <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-black">{user.name}</span>
        <span className="text-xs text-gray-600">{user.email}</span>
      </div>
    </div>
  );

  const renderLoadingState = () => (
    <div className="flex items-center justify-center p-2">
      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      <span className="ml-2 text-sm">Loading...</span>
    </div>
  );

  const renderErrorState = () => (
    <div className="p-2">
      <div className="text-red-600 text-xs mb-2">{authState.error}</div>
      <button
        onClick={handleSignIn}
        disabled={isProcessing}
        className="w-full bg-black text-white px-3 py-2 text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Signing In...' : 'Sign In'}
      </button>
    </div>
  );

  const renderAuthenticatedState = () => (
    <div className="p-2 border-2 border-black">
      {authState.user && renderUserProfile(authState.user)}
      <button
        onClick={handleSignOut}
        disabled={isProcessing}
        className="w-full mt-3 bg-white text-black border-2 border-black px-3 py-2 text-xs font-bold hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Signing Out...' : 'Sign Out'}
      </button>
    </div>
  );

  const renderUnauthenticatedState = () => (
    <div className="p-2">
      <button
        onClick={handleSignIn}
        disabled={isProcessing}
        className="w-full bg-black text-white px-3 py-2 text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Signing In...' : 'Sign In with Google'}
      </button>
    </div>
  );

  // Render loading state
  if (authState.isLoading) {
    return (
      <div className={`border-2 border-black ${className}`}>
        {renderLoadingState()}
      </div>
    );
  }

  // Render error state
  if (authState.error) {
    return (
      <div className={`border-2 border-red-600 bg-red-50 ${className}`}>
        {renderErrorState()}
      </div>
    );
  }

  // Render authenticated state
  if (authState.isAuthenticated) {
    return (
      <div className={`bg-white ${className}`}>
        {renderAuthenticatedState()}
      </div>
    );
  }

  // Render unauthenticated state
  return (
    <div className={`bg-white ${className}`}>
      {renderUnauthenticatedState()}
    </div>
  );
};

export default AuthButton;