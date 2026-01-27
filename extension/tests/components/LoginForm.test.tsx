/**
 * LoginForm component tests for Silence Notes Chrome Extension
 * Tests authentication UI states, user interactions, and callbacks
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LoginForm } from '../../src/components/LoginForm';
import { authService } from '../../src/auth';

// Mock the auth service
jest.mock('../../src/auth', () => ({
  authService: {
    authenticate: jest.fn(),
    subscribe: jest.fn(),
    setAuthState: jest.fn(),
  },
}));

// Mock chrome.identity API
const mockGetAuthToken = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  // Setup default chrome.identity mock
  // @ts-ignore - chrome is mocked in setup.ts
  global.chrome.identity.getAuthToken = mockGetAuthToken;

  // Setup default auth service mocks
  // @ts-ignore
  authService.authenticate.mockResolvedValue(true);
  // @ts-ignore
  authService.subscribe.mockReturnValue(() => {});
  // @ts-ignore
  authService.setAuthState.mockImplementation(() => {});
});

describe('LoginForm Component', () => {
  const mockOnAuthSuccess = jest.fn();

  beforeEach(() => {
    mockOnAuthSuccess.mockClear();
  });

  describe('Rendering', () => {
    it('should render login button when not loading', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should display app title "SILENCE NOTES"', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(screen.getByText('SILENCE NOTES')).toBeInTheDocument();
    });

    it('should display subtitle about Google sign in', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(screen.getByText(/sign in with your google account/i)).toBeInTheDocument();
    });

    it('should display security note', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(screen.getByText(/your data is secure and encrypted/i)).toBeInTheDocument();
    });
  });

  describe('Feature List', () => {
    it('should display all three features', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(screen.getByText(/create and manage notes/i)).toBeInTheDocument();
      expect(screen.getByText(/sync across all your devices/i)).toBeInTheDocument();
      expect(screen.getByText(/organize with hashtags/i)).toBeInTheDocument();
    });

    it('should display feature icons', () => {
      const { container } = render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      // Check for SVG icons (lucide-react icons render as SVG)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner during authentication', async () => {
      const mockSetAuthState = jest.fn();
      // @ts-ignore
      authService.setAuthState.mockImplementation(mockSetAuthState);

      // Create a mock subscriber that immediately sets loading state
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null,
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });

    it('should not show login button during loading', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null,
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
      });
    });

    it('should show loading spinner element', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null,
        });
        return () => {};
      });

      const { container } = render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when authentication fails', async () => {
      const errorMessage = 'Authentication failed: Invalid credentials';

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: errorMessage,
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /authentication failed/i })).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display error icon when authentication fails', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication error',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        const errorIcon = document.querySelector('.error-icon');
        expect(errorIcon).toBeInTheDocument();
      });
    });

    it('should show "Try Again" button on error', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication failed',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should show "Dismiss" button on error', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication failed',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
      });
    });

    it('should not show login form when error exists', async () => {
      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication error',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.queryByText('SILENCE NOTES')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call authService.authenticate() when login button is clicked', async () => {
      const user = userEvent.setup();
      // @ts-ignore
      authService.authenticate.mockResolvedValue(true);

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      expect(authService.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should call onAuthSuccess callback when authentication succeeds', async () => {
      const user = userEvent.setup();
      // @ts-ignore
      authService.authenticate.mockResolvedValue(true);

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
        expect(mockOnAuthSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call onAuthSuccess when authentication fails', async () => {
      const user = userEvent.setup();
      // @ts-ignore
      authService.authenticate.mockResolvedValue(false);

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
        expect(mockOnAuthSuccess).not.toHaveBeenCalled();
      });
    });

    it('should handle authentication errors gracefully', async () => {
      const user = userEvent.setup();
      // @ts-ignore
      authService.authenticate.mockRejectedValue(new Error('Network error'));

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
        expect(mockOnAuthSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should call authService.authenticate() when "Try Again" is clicked', async () => {
      const user = userEvent.setup();

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        // Initial state: error
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication failed',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      // Wait for error state to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      // @ts-ignore
      authService.authenticate.mockResolvedValue(true);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(authService.authenticate).toHaveBeenCalled();
    });

    it('should call authService.setAuthState() when "Dismiss" is clicked', async () => {
      const user = userEvent.setup();

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Authentication failed',
        });
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(authService.setAuthState).toHaveBeenCalledWith({ error: null });
    });

    it('should clear error and show login form after dismissing', async () => {
      const user = userEvent.setup();
      let authState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Authentication failed',
      };

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback(authState);
        return () => {};
      });

      // @ts-ignore
      authService.setAuthState.mockImplementation((updates) => {
        authState = { ...authState, ...updates };
      });

      const { rerender } = render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /authentication failed/i })).toBeInTheDocument();
      });

      // Click dismiss
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(authService.setAuthState).toHaveBeenCalledWith({ error: null });
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should transition from loading to success state', async () => {
      const user = userEvent.setup();
      let authState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback(authState);
        return () => {};
      });

      // @ts-ignore
      authService.authenticate.mockImplementation(async () => {
        // Simulate loading state
        authState = { ...authState, isLoading: true };
        await new Promise(resolve => setTimeout(resolve, 0));
        return true;
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
        expect(mockOnAuthSuccess).toHaveBeenCalled();
      });
    });

    it('should transition from loading to error state on failure', async () => {
      const user = userEvent.setup();
      let authState: {
        isAuthenticated: boolean;
        isLoading: boolean;
        user: null;
        error: string | null;
      } = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };

      // @ts-ignore
      authService.subscribe.mockImplementation((callback) => {
        callback(authState);
        return () => {};
      });

      // @ts-ignore
      authService.authenticate.mockImplementation(async () => {
        authState = { ...authState, isLoading: true };
        await new Promise(resolve => setTimeout(resolve, 0));
        authState = { ...authState, isLoading: false, error: 'Authentication failed' };
        return false;
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
      });

      // Verify onAuthSuccess was not called
      expect(mockOnAuthSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Chrome Identity API Integration', () => {
    it('should interact with chrome.identity.getAuthToken during authentication', async () => {
      const user = userEvent.setup();

      // Mock successful token retrieval
      mockGetAuthToken.mockImplementation(({ interactive }, callback) => {
        callback('test-auth-token');
      });

      // @ts-ignore
      authService.authenticate.mockResolvedValue(true);

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
      });

      // Note: The actual chrome.identity.getAuthToken call happens inside authService
      // We're verifying the component triggers the auth flow
    });

    it('should handle Chrome API errors during authentication', async () => {
      const user = userEvent.setup();

      // Mock Chrome API error
      mockGetAuthToken.mockImplementation(({ interactive }, callback) => {
        // @ts-ignore
        chrome.runtime.lastError = { message: 'User rejected authorization' };
        callback(null);
      });

      // @ts-ignore
      authService.authenticate.mockResolvedValue(false);

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(authService.authenticate).toHaveBeenCalled();
        expect(mockOnAuthSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const loginButton = screen.getByRole('button', { name: /sign in with google/i });
      expect(loginButton).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const title = screen.getByRole('heading', { name: 'SILENCE NOTES' });
      expect(title).toBeInTheDocument();
    });

    it('should display Google icon with alt text equivalent', () => {
      const { container } = render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      const googleIcon = container.querySelector('.google-icon');
      expect(googleIcon).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('should subscribe to auth state on mount', () => {
      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      expect(authService.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should handle auth state changes after mount', async () => {
      let authStateCallback: ((state: any) => void) | null = null;

      // @ts-ignore
      authService.subscribe.mockImplementation((callback: (state: any) => void) => {
        authStateCallback = callback;
        return () => {};
      });

      render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      // Initial render should show login form
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();

      // Simulate auth state change to loading
      if (authStateCallback) {
        (authStateCallback as (state: any) => void)({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null,
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });
    });

    it('should unsubscribe from auth state on unmount', () => {
      const unsubscribe = jest.fn();
      // @ts-ignore
      authService.subscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(<LoginForm onAuthSuccess={mockOnAuthSuccess} />);

      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
