/**
 * Options component tests for Silence Notes Chrome Extension
 * Tests settings page functionality including preferences loading, saving, and toggles
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Options } from '../../src/options/Options';

// Mock the Chrome storage API
const mockChromeStorageSync = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
};

// Setup mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Mock chrome.storage.sync
  // @ts-ignore - TypeScript type assertion for mock
  global.chrome.storage.sync = mockChromeStorageSync;

  // Default mock implementations
  mockChromeStorageSync.get.mockImplementation((keys, callback) => {
    const result = {};
    if (callback) {
      callback(result);
    } else if (typeof Promise !== 'undefined') {
      return Promise.resolve(result);
    }
  });

  mockChromeStorageSync.set.mockImplementation((data, callback) => {
    if (callback) {
      callback();
    } else if (typeof Promise !== 'undefined') {
      return Promise.resolve();
    }
  });
});

describe('Options Component', () => {
  describe('Rendering', () => {
    it('should render settings page with header', () => {
      render(<Options />);

      expect(screen.getByText('Silence Notes Options')).toBeInTheDocument();
    });

    it('should render synchronization section', () => {
      render(<Options />);

      expect(screen.getByText('Synchronization')).toBeInTheDocument();
    });

    it('should render appearance section', () => {
      render(<Options />);

      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });

    it('should render auto-sync checkbox', () => {
      render(<Options />);

      const autoSyncLabel = screen.getByText(/auto-sync notes/i);
      expect(autoSyncLabel).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      expect(checkbox).toBeInTheDocument();
    });

    it('should render sync interval input', () => {
      render(<Options />);

      expect(screen.getByLabelText(/sync interval/i)).toBeInTheDocument();
    });

    it('should render theme selector', () => {
      render(<Options />);

      expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    });
  });

  describe('Loading Preferences', () => {
    it('should load default settings when no saved preferences exist', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {}; // No saved settings
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      // Wait for useEffect to complete
      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalledWith(['settings'], expect.any(Function));
      });

      // Check default values
      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      expect(autoSyncCheckbox).toBeChecked();

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).toHaveValue(30);

      const themeSelect = screen.getByLabelText(/theme/i);
      expect(themeSelect).toHaveValue('light');
    });

    it('should load saved preferences from chrome.storage.sync', async () => {
      const savedSettings = {
        autoSync: false,
        syncInterval: 60,
        theme: 'dark'
      };

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: savedSettings };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      // Wait for useEffect to complete and settings to load
      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      // Additional wait for state to update
      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).not.toBeChecked();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).toHaveValue(60);

      const themeSelect = screen.getByLabelText(/theme/i);
      expect(themeSelect).toHaveValue('dark');
    });

    it('should handle settings with light theme', async () => {
      const savedSettings = {
        autoSync: true,
        syncInterval: 15,
        theme: 'light'
      };

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: savedSettings };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      await waitFor(() => {
        const themeSelect = screen.getByLabelText(/theme/i);
        expect(themeSelect).toHaveValue('light');
      });
    });

    it('should handle settings with dark theme', async () => {
      const savedSettings = {
        autoSync: true,
        syncInterval: 120,
        theme: 'dark'
      };

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: savedSettings };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      await waitFor(() => {
        const themeSelect = screen.getByLabelText(/theme/i);
        expect(themeSelect).toHaveValue('dark');
      });
    });
  });

  describe('Saving Settings', () => {
    it('should save auto-sync setting when checkbox is toggled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      expect(autoSyncCheckbox).toBeChecked();

      // Uncheck the checkbox
      await user.click(autoSyncCheckbox);

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            autoSync: false
          })
        });
      });
    });

    it('should save sync interval when value changes', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);

      // Clear the input and type new value
      await user.clear(syncIntervalInput);
      await user.type(syncIntervalInput, '45');

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            syncInterval: 45
          })
        });
      });
    });

    it('should save theme setting when changed', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const themeSelect = screen.getByLabelText(/theme/i);

      // Change theme to dark
      await user.selectOptions(themeSelect, 'dark');

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            theme: 'dark'
          })
        });
      });
    });

    it('should save all settings together when changed', async () => {
      const user = userEvent.setup();

      const initialSettings = {
        autoSync: true,
        syncInterval: 30,
        theme: 'light'
      };

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: initialSettings };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      // Change theme
      const themeSelect = screen.getByLabelText(/theme/i);
      await user.selectOptions(themeSelect, 'dark');

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            autoSync: true,
            syncInterval: 30,
            theme: 'dark'
          })
        });
      });
    });
  });

  describe('Theme Toggle', () => {
    it('should display light theme option', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const themeSelect = screen.getByLabelText(/theme/i);
      const lightOption = within(themeSelect).getByRole('option', { name: 'Light' });

      expect(lightOption).toBeInTheDocument();
    });

    it('should display dark theme option', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const themeSelect = screen.getByLabelText(/theme/i);
      const darkOption = within(themeSelect).getByRole('option', { name: 'Dark' });

      expect(darkOption).toBeInTheDocument();
    });

    it('should toggle from light to dark theme', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { theme: 'light', autoSync: true, syncInterval: 30 } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const themeSelect = screen.getByLabelText(/theme/i);
        expect(themeSelect).toHaveValue('light');
      });

      const themeSelect = screen.getByLabelText(/theme/i);
      await user.selectOptions(themeSelect, 'dark');

      await waitFor(() => {
        expect(themeSelect).toHaveValue('dark');
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            theme: 'dark'
          })
        });
      });
    });

    it('should toggle from dark to light theme', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { theme: 'dark', autoSync: true, syncInterval: 30 } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const themeSelect = screen.getByLabelText(/theme/i);
        expect(themeSelect).toHaveValue('dark');
      });

      const themeSelect = screen.getByLabelText(/theme/i);
      await user.selectOptions(themeSelect, 'light');

      await waitFor(() => {
        expect(themeSelect).toHaveValue('light');
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            theme: 'light'
          })
        });
      });
    });
  });

  describe('Auto-save Toggle', () => {
    it('should render auto-sync checkbox in checked state by default', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      expect(autoSyncCheckbox).toBeChecked();
    });

    it('should toggle auto-sync from enabled to disabled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { autoSync: true, syncInterval: 30, theme: 'light' } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).toBeChecked();
      });

      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      await user.click(autoSyncCheckbox);

      await waitFor(() => {
        expect(autoSyncCheckbox).not.toBeChecked();
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            autoSync: false
          })
        });
      });
    });

    it('should toggle auto-sync from disabled to enabled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { autoSync: false, syncInterval: 30, theme: 'light' } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).not.toBeChecked();
      });

      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
      await user.click(autoSyncCheckbox);

      await waitFor(() => {
        expect(autoSyncCheckbox).toBeChecked();
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            autoSync: true
          })
        });
      });
    });

    it('should disable sync interval input when auto-sync is disabled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { autoSync: false, syncInterval: 30, theme: 'light' } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).not.toBeChecked();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).toBeDisabled();
    });

    it('should enable sync interval input when auto-sync is enabled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { autoSync: true, syncInterval: 30, theme: 'light' } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).toBeChecked();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).not.toBeDisabled();
    });

    it('should enable/disable sync interval input when auto-sync is toggled', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = { settings: { autoSync: true, syncInterval: 30, theme: 'light' } };
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });
        expect(autoSyncCheckbox).toBeChecked();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      const autoSyncCheckbox = screen.getByRole('checkbox', { name: /auto-sync notes/i });

      // Initially enabled
      expect(syncIntervalInput).not.toBeDisabled();

      // Disable auto-sync
      await user.click(autoSyncCheckbox);

      await waitFor(() => {
        expect(syncIntervalInput).toBeDisabled();
      });

      // Re-enable auto-sync
      await user.click(autoSyncCheckbox);

      await waitFor(() => {
        expect(syncIntervalInput).not.toBeDisabled();
      });
    });
  });

  describe('Sync Interval Validation', () => {
    it('should have min attribute of 1 on sync interval input', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).toHaveAttribute('min', '1');
    });

    it('should have max attribute of 1440 on sync interval input', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);
      expect(syncIntervalInput).toHaveAttribute('max', '1440');
    });

    it('should accept valid sync interval values', async () => {
      const user = userEvent.setup();

      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const syncIntervalInput = screen.getByLabelText(/sync interval/i);

      // Test minimum value
      await user.clear(syncIntervalInput);
      await user.type(syncIntervalInput, '1');

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            syncInterval: 1
          })
        });
      });

      // Test maximum value
      jest.clearAllMocks();
      await user.clear(syncIntervalInput);
      await user.type(syncIntervalInput, '1440');

      await waitFor(() => {
        expect(mockChromeStorageSync.set).toHaveBeenCalledWith({
          settings: expect.objectContaining({
            syncInterval: 1440
          })
        });
      });
    });
  });

  describe('Component Structure', () => {
    it('should have proper CSS class names', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      const { container } = render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      expect(container.querySelector('.options-container')).toBeInTheDocument();
      expect(container.querySelector('.options-header')).toBeInTheDocument();
      expect(container.querySelector('.options-main')).toBeInTheDocument();
    });

    it('should render settings sections with proper class', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      const { container } = render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const sections = container.querySelectorAll('.settings-section');
      expect(sections.length).toBe(2); // Synchronization and Appearance sections
    });

    it('should render setting items with proper class', async () => {
      mockChromeStorageSync.get.mockImplementation((keys: string | string[], callback?: (result: any) => void) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      });

      const { container } = render(<Options />);

      await waitFor(() => {
        expect(mockChromeStorageSync.get).toHaveBeenCalled();
      });

      const settingItems = container.querySelectorAll('.setting-item');
      expect(settingItems.length).toBeGreaterThan(0);
    });
  });
});
