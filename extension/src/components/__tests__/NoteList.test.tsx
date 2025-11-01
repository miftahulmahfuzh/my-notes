import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NoteList } from '../NoteList';
import { Note } from '../../types';

// Mock the Chrome storage API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
};

// Mock Chrome API
global.chrome = {
  storage: mockChromeStorage,
} as any;

// Mock the API service
jest.mock('../../utils/api', () => ({
  ApiService: {
    deleteNote: jest.fn(),
    updateNote: jest.fn(),
  },
}));

// Mock the storage service
jest.mock('../../services/storage', () => ({
  storageService: {
    saveNote: jest.fn(),
    deleteNote: jest.fn(),
  },
}));

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Test Note 1',
    content: 'This is the first test note with some content #work',
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-01-01T10:00:00Z',
    user_id: 'user1',
    version: 1,
  },
  {
    id: '2',
    title: 'Another Test Note',
    content: 'This is the second test note with different content #personal',
    created_at: '2023-01-01T11:00:00Z',
    updated_at: '2023-01-01T11:00:00Z',
    user_id: 'user1',
    version: 1,
  },
  {
    id: '3',
    title: 'Long Note for Testing',
    content: 'This is a very long note that should be truncated when displayed in the list view. It contains a lot of text and should demonstrate the truncation functionality properly. This content is definitely longer than 500 characters and should show the expand button. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_at: '2023-01-01T12:00:00Z',
    updated_at: '2023-01-01T12:00:00Z',
    user_id: 'user1',
    version: 1,
  },
];

describe('NoteList Component', () => {
  const defaultProps = {
    notes: mockNotes,
    selectedNoteId: null,
    onNoteSelect: jest.fn(),
    onNoteEdit: jest.fn(),
    onNoteDelete: jest.fn(),
    loading: false,
    hasMore: false,
    onLoadMore: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders notes correctly', () => {
    render(<NoteList {...defaultProps} />);

    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Another Test Note')).toBeInTheDocument();
    expect(screen.getByText('Long Note for Testing')).toBeInTheDocument();
  });

  test('displays note content correctly', () => {
    render(<NoteList {...defaultProps} />);

    expect(screen.getByText('This is the first test note with some content #work')).toBeInTheDocument();
    expect(screen.getByText('This is the second test note with different content #personal')).toBeInTheDocument();
  });

  test('truncates long notes', () => {
    render(<NoteList {...defaultProps} />);

    const longNoteContent = screen.getByText(/This is a very long note/);
    expect(longNoteContent).toBeInTheDocument();

    // Should contain ellipsis for truncated content
    expect(longNoteContent.textContent).toContain('...');
  });

  test('shows expand button for long notes', () => {
    render(<NoteList {...defaultProps} />);

    const expandButton = screen.getByText('Show more');
    expect(expandButton).toBeInTheDocument();
  });

  test('expands and collapses long notes', async () => {
    render(<NoteList {...defaultProps} />);

    const expandButton = screen.getByText('Show more');

    // Initially truncated
    expect(expandButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(screen.getByText('Show less'));

    await waitFor(() => {
      expect(screen.getByText('Show more')).toBeInTheDocument();
    });
  });

  test('displays hashtags correctly', () => {
    render(<NoteList {...defaultProps} />);

    expect(screen.getByText('#work')).toBeInTheDocument();
    expect(screen.getByText('#personal')).toBeInTheDocument();
  });

  test('shows empty state when no notes', () => {
    render(<NoteList {...defaultProps} notes={[]} />);

    expect(screen.getByText('No notes found')).toBeInTheDocument();
    expect(screen.getByText('Create your first note to get started')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<NoteList {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  test('calls onNoteSelect when note is clicked', () => {
    render(<NoteList {...defaultProps} />);

    const firstNote = screen.getByText('Test Note 1');
    fireEvent.click(firstNote);

    expect(defaultProps.onNoteSelect).toHaveBeenCalledWith(mockNotes[0]);
  });

  test('shows action buttons on hover', () => {
    render(<NoteList {...defaultProps} />);

    const noteItems = screen.getAllByTestId('note-item');
    const firstNoteItem = noteItems[0];

    // Hover to show action buttons
    fireEvent.mouseEnter(firstNoteItem);

    await waitFor(() => {
      expect(screen.getByTitle('Edit note')).toBeInTheDocument();
      expect(screen.getByTitle('Delete note')).toBeInTheDocument();
    });
  });

  test('calls onNoteEdit when edit button is clicked', async () => {
    render(<NoteList {...defaultProps} />);

    const noteItems = screen.getAllByTestId('note-item');
    const firstNoteItem = noteItems[0];

    // Hover to show action buttons
    fireEvent.mouseEnter(firstNoteItem);

    await waitFor(() => {
      const editButton = screen.getByTitle('Edit note');
      fireEvent.click(editButton);
    });

    expect(defaultProps.onNoteEdit).toHaveBeenCalledWith(mockNotes[0]);
  });

  test('calls onNoteDelete when delete button is clicked', async () => {
    // Mock window.confirm to return true
    window.confirm = jest.fn(() => true);

    render(<NoteList {...defaultProps} />);

    const noteItems = screen.getAllByTestId('note-item');
    const firstNoteItem = noteItems[0];

    // Hover to show action buttons
    fireEvent.mouseEnter(firstNoteItem);

    await waitFor(() => {
      const deleteButton = screen.getByTitle('Delete note');
      fireEvent.click(deleteButton);
    });

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this note?');
    expect(defaultProps.onNoteDelete).toHaveBeenCalledWith(mockNotes[0].id);
  });

  test('does not delete note when confirmation is cancelled', async () => {
    // Mock window.confirm to return false
    window.confirm = jest.fn(() => false);

    render(<NoteList {...defaultProps} />);

    const noteItems = screen.getAllByTestId('note-item');
    const firstNoteItem = noteItems[0];

    // Hover to show action buttons
    fireEvent.mouseEnter(firstNoteItem);

    await waitFor(() => {
      const deleteButton = screen.getByTitle('Delete note');
      fireEvent.click(deleteButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(defaultProps.onNoteDelete).not.toHaveBeenCalled();
  });

  test('highlights selected note', () => {
    render(<NoteList {...defaultProps} selectedNoteId="1" />);

    const noteItems = screen.getAllByTestId('note-item');
    const firstNoteItem = noteItems[0];

    expect(firstNoteItem).toHaveClass('selected');
  });

  test('shows load more button when hasMore is true', () => {
    render(<NoteList {...defaultProps} hasMore={true} />);

    const loadMoreButton = screen.getByText('Load More');
    expect(loadMoreButton).toBeInTheDocument();
  });

  test('calls onLoadMore when load more button is clicked', () => {
    render(<NoteList {...defaultProps} hasMore={true} />);

    const loadMoreButton = screen.getByText('Load More');
    fireEvent.click(loadMoreButton);

    expect(defaultProps.onLoadMore).toHaveBeenCalled();
  });

  test('displays loading state during load more', () => {
    render(<NoteList {...defaultProps} hasMore={true} loading={true} />);

    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  test('shows note metadata correctly', () => {
    render(<NoteList {...defaultProps} />);

    // Check for relative time display
    expect(screen.getByText(/Updated/)).toBeInTheDocument();

    // Check for version number
    const versionElements = screen.getAllByText('v1');
    expect(versionElements.length).toBeGreaterThan(0);
  });

  test('displays note statistics correctly', () => {
    render(<NoteList {...defaultProps} />);

    // Should show character count, word count, lines count, and tags count
    expect(screen.getByText(/\d+ characters/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ words/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ lines/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ tags/)).toBeInTheDocument();
  });

  test('handles empty content notes', () => {
    const notesWithEmptyContent: Note[] = [
      {
        id: '4',
        title: 'Empty Note',
        content: '',
        created_at: '2023-01-01T13:00:00Z',
        updated_at: '2023-01-01T13:00:00Z',
        user_id: 'user1',
        version: 1,
      },
    ];

    render(<NoteList {...defaultProps} notes={notesWithEmptyContent} />);

    expect(screen.getByText('Empty Note')).toBeInTheDocument();
    expect(screen.getByText('No content')).toBeInTheDocument();
  });

  test('handles notes without titles', () => {
    const notesWithoutTitles: Note[] = [
      {
        id: '5',
        title: '',
        content: 'Note without title',
        created_at: '2023-01-01T14:00:00Z',
        updated_at: '2023-01-01T14:00:00Z',
        user_id: 'user1',
        version: 1,
      },
    ];

    render(<NoteList {...defaultProps} notes={notesWithoutTitles} />);

    expect(screen.getByText('Note without title')).toBeInTheDocument();
  });

  test('handles error state gracefully', () => {
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

    render(<NoteList {...defaultProps} notes={[]} error="Failed to load notes" />);

    expect(screen.getByText('Failed to load notes')).toBeInTheDocument();
    expect(screen.getByText('Please try again later')).toBeInTheDocument();

    mockConsoleError.mockRestore();
  });

  test('applies correct CSS classes based on state', () => {
    render(<NoteList {...defaultProps} />);

    const noteItems = screen.getAllByTestId('note-item');
    expect(noteItems[0]).toHaveClass('note-item');
  });

  test('is accessible with keyboard navigation', () => {
    render(<NoteList {...defaultProps} />);

    const firstNote = screen.getByText('Test Note 1');

    // Should be focusable
    expect(firstNote.closest('[tabindex]')).toBeInTheDocument();

    // Should support keyboard interactions
    fireEvent.keyDown(firstNote, { key: 'Enter' });
    expect(defaultProps.onNoteSelect).toHaveBeenCalledWith(mockNotes[0]);
  });

  test('handles rapid clicking gracefully', async () => {
    render(<NoteList {...defaultProps} />);

    const firstNote = screen.getByText('Test Note 1');

    // Rapid multiple clicks
    fireEvent.click(firstNote);
    fireEvent.click(firstNote);
    fireEvent.click(firstNote);

    await waitFor(() => {
      expect(defaultProps.onNoteSelect).toHaveBeenCalledTimes(3);
    });
  });

  test('updates when notes prop changes', () => {
    const { rerender } = render(<NoteList {...defaultProps} />);

    expect(screen.getByText('Test Note 1')).toBeInTheDocument();

    const newNotes: Note[] = [
      {
        id: '6',
        title: 'Updated Note',
        content: 'Updated content',
        created_at: '2023-01-01T15:00:00Z',
        updated_at: '2023-01-01T15:00:00Z',
        user_id: 'user1',
        version: 1,
      },
    ];

    rerender(<NoteList {...defaultProps} notes={newNotes} />);

    expect(screen.queryByText('Test Note 1')).not.toBeInTheDocument();
    expect(screen.getByText('Updated Note')).toBeInTheDocument();
  });
});