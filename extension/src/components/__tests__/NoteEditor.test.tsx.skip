import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NoteEditor } from '../NoteEditor';
import { Note } from '@/types';

// Mock the Chrome storage API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
  },
};

// Mock Chrome API
global.chrome = {
  storage: mockChromeStorage,
} as any;

// Mock the API service
jest.mock('../../utils/api', () => ({
  ApiService: {
    createNote: jest.fn(),
    updateNote: jest.fn(),
  },
}));

// Mock the storage service
jest.mock('../../services/storage', () => ({
  storageService: {
    saveNote: jest.fn(),
  },
}));

// Mock the keyboard manager
jest.mock('../../utils/keyboard', () => ({
  keyboardManager: {
    register: jest.fn(),
    unregister: jest.fn(),
  },
}));

const mockNote: Note = {
  id: '1',
  title: 'Test Note',
  content: 'This is test content for the note editor',
  created_at: '2023-01-01T10:00:00Z',
  updated_at: '2023-01-01T10:00:00Z',
  user_id: 'user1',
  version: 1,
};

describe('NoteEditor Component', () => {
  const defaultProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
    loading: false,
    placeholder: 'Start typing your note...',
    autoFocus: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New Note Mode', () => {
    test('renders empty editor for new note', () => {
      render(<NoteEditor {...defaultProps} />);

      expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Empty title
      expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Empty content
      expect(screen.getByText('Create New Note')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Start typing your note...')).toBeInTheDocument();
    });

    test('auto-focuses title field when autoFocus is true', () => {
      render(<NoteEditor {...defaultProps} autoFocus={true} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      expect(titleInput).toHaveFocus();
    });

    test('does not auto-focus when autoFocus is false', () => {
      render(<NoteEditor {...defaultProps} autoFocus={false} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      expect(titleInput).not.toHaveFocus();
    });

    test('updates title and content when typing', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);

      await user.type(titleInput, 'New Test Note');
      await user.type(contentTextarea, 'This is new content');

      expect(titleInput).toHaveValue('New Test Note');
      expect(contentTextarea).toHaveValue('This is new content');
    });

    test('shows character and word counts', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'This is test content');

      expect(screen.getByText('21 characters')).toBeInTheDocument();
      expect(screen.getByText('4 words')).toBeInTheDocument();
      expect(screen.getByText('1 lines')).toBeInTheDocument();
    });

    test('saves new note when save button is clicked', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      await user.type(titleInput, 'Test Note');
      await user.type(contentTextarea, 'Test content');
      await user.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        title: 'Test Note',
        content: 'Test content',
      });
    });

    test('saves note with auto-generated title when title is empty', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      await user.type(contentTextarea, 'This is content without a title');
      await user.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        title: 'This is content without a title', // Auto-generated from content
        content: 'This is content without a title',
      });
    });

    test('shows validation error when content is empty', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(screen.getByText('Content is required')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    test('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    test('clears validation error when content is added', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      // Try to save with empty content
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);
      expect(screen.getByText('Content is required')).toBeInTheDocument();

      // Add content
      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Some content');

      expect(screen.queryByText('Content is required')).not.toBeInTheDocument();
    });
  });

  describe('Edit Note Mode', () => {
    const editProps = {
      ...defaultProps,
      note: mockNote,
    };

    test('renders existing note data', () => {
      render(<NoteEditor {...editProps} />);

      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
      expect(screen.getByDisplayValue('This is test content for the note editor')).toBeInTheDocument();
      expect(screen.getByText('Edit Note')).toBeInTheDocument();
    });

    test('updates note when save button is clicked', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...editProps} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Note');
      await user.clear(contentTextarea);
      await user.type(contentTextarea, 'Updated content');
      await user.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        title: 'Updated Note',
        content: 'Updated content',
      });
    });

    test('shows version information', () => {
      render(<NoteEditor {...editProps} />);

      expect(screen.getByText('Version 1')).toBeInTheDocument();
    });

    test('extracts and displays hashtags', async () => {
      const noteWithTags: Note = {
        ...mockNote,
        content: 'This note has #work and #personal tags',
      };

      render(<NoteEditor {...editProps} note={noteWithTags} />);

      expect(screen.getByText('#work')).toBeInTheDocument();
      expect(screen.getByText('#personal')).toBeInTheDocument();
    });

    test('auto-saves content changes', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();

      render(<NoteEditor {...editProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.clear(contentTextarea);
      await user.type(contentTextarea, 'Auto-save test content');

      // Fast-forward time to trigger auto-save
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Check if auto-save indicator appears
      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Loading States', () => {
    test('disables form fields when loading', () => {
      render(<NoteEditor {...defaultProps} loading={true} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      expect(titleInput).toBeDisabled();
      expect(contentTextarea).toBeDisabled();
      expect(saveButton).toBeDisabled();
    });

    test('shows loading indicator when saving', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} loading={false} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      await user.type(contentTextarea, 'Test content');

      // Mock the onSave function to return a promise that resolves slowly
      defaultProps.onSave.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      await user.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('saves on Ctrl+S', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Test content');

      await user.keyboard('{Control>}{s}');

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        title: '',
        content: 'Test content',
      });
    });

    test('cancels on Escape', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    test('handles Ctrl+Shift+S for force save', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Test content');

      await user.keyboard('{Control>}{Shift>}{s}');

      expect(defaultProps.onSave).toHaveBeenCalledWith({
        title: '',
        content: 'Test content',
      });
    });
  });

  describe('Hashtag Detection', () => {
    test('detects hashtags in content', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'This note has #work and #personal tags');

      expect(screen.getByText('#work')).toBeInTheDocument();
      expect(screen.getByText('#personal')).toBeInTheDocument();
    });

    test('removes duplicate hashtags', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Duplicate #work tags #work');

      // Should only show one #work tag
      const workTags = screen.getAllByText('#work');
      expect(workTags).toHaveLength(1);
    });

    test('handles invalid hashtag patterns', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Invalid #123 and #!@# tags');

      // Should not show invalid tags
      expect(screen.queryByText('#123')).not.toBeInTheDocument();
      expect(screen.queryByText('#!@#')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('applies responsive classes correctly', () => {
      render(<NoteEditor {...defaultProps} />);

      const editor = screen.getByTestId('note-editor');
      expect(editor).toHaveClass('note-editor');
    });
  });

  describe('Error Handling', () => {
    test('handles save errors gracefully', async () => {
      const user = userEvent.setup();
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

      defaultProps.onSave.mockRejectedValue(new Error('Save failed'));

      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const saveButton = screen.getByText('Save');

      await user.type(contentTextarea, 'Test content');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save note')).toBeInTheDocument();
      });

      mockConsoleError.mockRestore();
    });

    test('validates content before saving', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const saveButton = screen.getByText('Save');

      await user.click(saveButton);

      expect(screen.getByText('Content is required')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<NoteEditor {...defaultProps} />);

      const titleInput = screen.getByPlaceholderText('Note title');
      expect(titleInput).toHaveAttribute('aria-label');

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      expect(contentTextarea).toHaveAttribute('aria-label');
    });

    test('supports screen reader announcements', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      await user.type(contentTextarea, 'Test content');

      // Check for live region announcements
      expect(screen.getByText('4 words')).toBeInTheDocument();
      expect(screen.getByText('21 characters')).toBeInTheDocument();
    });

    test('is keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      // Tab through fields
      await user.tab();
      expect(screen.getByPlaceholderText('Note title')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText(defaultProps.placeholder!)).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Save')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Cancel')).toHaveFocus();
    });
  });

  describe('Performance', () => {
    test('handles large content without performance issues', async () => {
      const user = userEvent.setup();
      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);
      const largeContent = 'A'.repeat(10000); // 10k characters

      await user.type(contentTextarea, largeContent);

      expect(screen.getByText('10001 characters')).toBeInTheDocument();
    });

    test('debounces hashtag detection', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();

      render(<NoteEditor {...defaultProps} />);

      const contentTextarea = screen.getByPlaceholderText(defaultProps.placeholder!);

      // Type multiple hashtags quickly
      await user.type(contentTextarea, '#tag1 #tag2 #tag3');

      // Should not immediately detect hashtags
      expect(screen.queryByText('#tag1')).not.toBeInTheDocument();

      // Fast-forward to trigger hashtag detection
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('#tag1')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });
});