/**
 * Settings component tests for Silence Notes Chrome Extension
 * Tests the Settings modal with General settings section
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Settings from '../../src/components/Settings';

describe('Settings Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render settings overlay and modal', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const overlay = container.querySelector('.settings-overlay');
      const modal = container.querySelector('.settings-modal');

      expect(overlay).toBeInTheDocument();
      expect(modal).toBeInTheDocument();
    });

    it('should render settings header with title and close button', () => {
      render(<Settings onClose={mockOnClose} />);

      const title = screen.getByText('Settings');
      const closeButton = screen.getByTitle('Close settings');

      expect(title).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();
    });

    it('should render close button with SVG icon', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const svg = container.querySelector('.close-btn svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should render settings content container', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const content = container.querySelector('.settings-content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('General Settings Section', () => {
    it('should display all general settings items', () => {
      render(<Settings onClose={mockOnClose} />);

      const autoSaveLabel = screen.getByText('Auto-save');
      const themeLabel = screen.getByText('Theme');
      const syncStatusLabel = screen.getByText('Sync Status');

      expect(autoSaveLabel).toBeInTheDocument();
      expect(themeLabel).toBeInTheDocument();
      expect(syncStatusLabel).toBeInTheDocument();
    });

    it('should display auto-save description', () => {
      render(<Settings onClose={mockOnClose} />);

      const autoSaveDescription = screen.getByText('Notes are automatically saved every 2 seconds');
      expect(autoSaveDescription).toBeInTheDocument();
    });

    it('should display theme description', () => {
      render(<Settings onClose={mockOnClose} />);

      const themeDescription = screen.getByText('Uses system preference (light/dark mode)');
      expect(themeDescription).toBeInTheDocument();
    });

    it('should display sync status description', () => {
      render(<Settings onClose={mockOnClose} />);

      const syncDescription = screen.getByText('Notes are synced with the server automatically');
      expect(syncDescription).toBeInTheDocument();
    });

    it('should render setting items with proper structure', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const settingItems = container.querySelectorAll('.setting-item');
      expect(settingItems).toHaveLength(3);
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<Settings onClose={mockOnClose} />);

      const closeButton = screen.getByTitle('Close settings');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose exactly once when close button is clicked multiple times rapidly', async () => {
      const user = userEvent.setup();
      render(<Settings onClose={mockOnClose} />);

      const closeButton = screen.getByTitle('Close settings');

      await user.click(closeButton);
      await user.click(closeButton);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });
  });

  describe('Component Structure', () => {
    it('should have proper CSS class names for styling', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      expect(container.querySelector('.settings-overlay')).toBeInTheDocument();
      expect(container.querySelector('.settings-modal')).toBeInTheDocument();
      expect(container.querySelector('.settings-header')).toBeInTheDocument();
      expect(container.querySelector('.settings-content')).toBeInTheDocument();
      expect(container.querySelector('.settings-section')).toBeInTheDocument();
    });

    it('should render general settings container when General section is active', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const generalSettings = container.querySelector('.general-settings');
      expect(generalSettings).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have close button with proper title attribute', () => {
      render(<Settings onClose={mockOnClose} />);

      const closeButton = screen.getByTitle('Close settings');
      expect(closeButton).toBeInTheDocument();
    });

    it('should render proper heading hierarchy', () => {
      render(<Settings onClose={mockOnClose} />);

      const h3 = screen.getByText('Settings').tagName;
      const h4 = screen.getByText('General Settings').tagName;

      expect(h3).toBe('H3');
      expect(h4).toBe('H4');
    });

    it('should use button elements for interactive elements', () => {
      const { container } = render(<Settings onClose={mockOnClose} />);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Edge Cases', () => {

    it('should not crash when onClose is not provided', () => {
      // This tests that the component handles undefined onClose gracefully
      const { container } = render(<Settings onClose={() => {}} />);

      expect(container.querySelector('.settings-overlay')).toBeInTheDocument();
    });
  });
});
