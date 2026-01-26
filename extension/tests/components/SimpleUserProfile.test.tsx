/**
 * SimpleUserProfile component tests for Silence Notes Chrome Extension
 * Tests user profile display, avatar rendering, and logout functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SimpleUserProfile } from '../../src/components/SimpleUserProfile';
import { authService, User } from '../../src/auth';

// Mock the auth service
jest.mock('../../src/auth');

describe('SimpleUserProfile', () => {
  let mockUser: User;
  let mockOnLogout: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock user
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    // Create mock onLogout callback
    mockOnLogout = jest.fn();

    // Set up default auth service mocks
    (authService.getAuthState as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: mockUser,
      error: null,
    });

    (authService.subscribe as jest.Mock).mockReturnValue(() => {}); // Return unsubscribe function
    (authService.logout as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render user email', async () => {
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });
    });

    it('should render user avatar when avatar_url is provided', async () => {
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        const avatar = screen.getByRole('img', { name: mockUser.email });
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', mockUser.avatar_url);
      });
    });

    it('should render user initials when avatar_url is not provided', async () => {
      // Update mock user without avatar_url
      const userWithoutAvatar = {
        ...mockUser,
        avatar_url: undefined,
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithoutAvatar,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        // For email "test@example.com", initials should be "T" (first letter of username)
        // Or based on the implementation: email.split('@')[0].split('.').map(word => word[0]).join('').toUpperCase().slice(0, 2)
        // "test" -> ['test'] -> ['t'] -> 'T'
        expect(screen.getByText('T')).toBeInTheDocument();
      });

      // Verify no image is rendered
      const avatar = screen.queryByRole('img');
      expect(avatar).not.toBeInTheDocument();
    });

    it('should render user initials for email with dots', async () => {
      // Update mock user with dotted email
      const userWithDottedEmail = {
        ...mockUser,
        email: 'john.doe@example.com',
        avatar_url: undefined,
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithDottedEmail,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        // "john.doe" -> ['john', 'doe'] -> ['j', 'd'] -> 'JD'
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
    });

    it('should render logout button', async () => {
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        const logoutButton = screen.getByRole('button', { name: /sign out/i });
        expect(logoutButton).toBeInTheDocument();
        expect(logoutButton).toHaveTextContent('Logout');
      });
    });

    it('should render null when user is not authenticated', () => {
      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });

      const { container } = render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Component should return null
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Logout Confirmation Dialog', () => {
    it('should show confirmation dialog when logout button is clicked', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Verify confirmation dialog appears
      expect(screen.getByText('Sign Out?')).toBeInTheDocument();
      expect(screen.getByText("You'll need to sign in again to access your notes.")).toBeInTheDocument();
    });

    it('should show cancel and sign out buttons in confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Verify both buttons are present
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    });

    it('should hide confirmation dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Verify dialog appears
      expect(screen.getByText('Sign Out?')).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Verify dialog is hidden
      expect(screen.queryByText('Sign Out?')).not.toBeInTheDocument();
    });

    it('should not call onLogout when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Verify onLogout was not called
      expect(mockOnLogout).not.toHaveBeenCalled();
    });
  });

  describe('Logout Functionality', () => {
    it('should call authService.logout when sign out is confirmed', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Click confirm sign out
      const confirmButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(confirmButton);

      // Verify authService.logout was called
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('should call onLogout callback after successful logout', async () => {
      const user = userEvent.setup();
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Click confirm sign out
      const confirmButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(confirmButton);

      // Wait for async operations
      await waitFor(() => {
        expect(mockOnLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onLogout callback even when authService.logout fails', async () => {
      const user = userEvent.setup();

      // Mock logout to fail
      (authService.logout as jest.Mock).mockRejectedValue(new Error('Logout failed'));

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Click confirm sign out
      const confirmButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(confirmButton);

      // Wait for async operations
      await waitFor(() => {
        expect(authService.logout).toHaveBeenCalledTimes(1);
      });

      // onLogout should still be called even if logout fails
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Auth State Subscription', () => {
    it('should subscribe to auth state changes on mount', async () => {
      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(authService.subscribe).toHaveBeenCalledTimes(1);
        expect(authService.subscribe).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('should unsubscribe from auth state changes on unmount', async () => {
      const unsubscribe = jest.fn();
      (authService.subscribe as jest.Mock).mockReturnValue(unsubscribe);

      const { unmount } = render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(authService.subscribe).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should update user info when auth state changes', async () => {
      const updatedUser = {
        ...mockUser,
        email: 'updated@example.com',
      };

      // Get the subscribe callback
      let subscribeCallback: ((state: any) => void) | null = null;
      (authService.subscribe as jest.Mock).mockImplementation((callback: (state: any) => void) => {
        subscribeCallback = callback;
        return () => {}; // unsubscribe function
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });

      // Simulate auth state change
      if (subscribeCallback) {
        (subscribeCallback as (state: any) => void)({
          isAuthenticated: true,
          isLoading: false,
          user: updatedUser,
          error: null,
        });
      }

      // Verify user info is updated
      await waitFor(() => {
        expect(screen.getByText(updatedUser.email)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with special characters in initials', async () => {
      const userWithSpecialEmail = {
        ...mockUser,
        email: 'user+test@example.com',
        avatar_url: undefined,
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithSpecialEmail,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        // "user+test" -> ['user+test'] -> 'U' (first char)
        expect(screen.getByText('U')).toBeInTheDocument();
      });
    });

    it('should handle very long email for initials', async () => {
      const userWithLongEmail = {
        ...mockUser,
        email: 'very.long.email.address@example.com',
        avatar_url: undefined,
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithLongEmail,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        // "very.long.email.address" -> ['very', 'long', 'email', 'address'] -> ['v', 'l', 'e', 'a'] -> 'VL' (first 2)
        expect(screen.getByText('VL')).toBeInTheDocument();
      });
    });

    it('should handle single character username', async () => {
      const userWithShortEmail = {
        ...mockUser,
        email: 'x@example.com',
        avatar_url: undefined,
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithShortEmail,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        expect(screen.getByText('X')).toBeInTheDocument();
      });
    });

    it('should handle empty avatar_url string', async () => {
      const userWithEmptyAvatar = {
        ...mockUser,
        avatar_url: '',
      };

      (authService.getAuthState as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: userWithEmptyAvatar,
        error: null,
      });

      render(<SimpleUserProfile onLogout={mockOnLogout} />);

      await waitFor(() => {
        // Empty string is falsy, so should show initials
        expect(screen.getByText('T')).toBeInTheDocument();
      });

      // Verify no image is rendered
      const avatar = screen.queryByRole('img');
      expect(avatar).not.toBeInTheDocument();
    });
  });
});
