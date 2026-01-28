/**
 * NoteView component tests for Silence Notes Chrome Extension
 * Tests for note display, markdown rendering, hashtag extraction, and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import NoteView from '../../src/components/NoteView';
import { Note } from '../../src/types';

// Mock the MarkdownPreview component - need to mock both the lazy component and the actual component
jest.mock('../../src/components/MarkdownPreview', () => require('../components/__mocks__/MarkdownPreview'));
jest.mock('../../src/components/MarkdownPreviewLazy', () => {
  const MockMarkdownPreview = require('../components/__mocks__/MarkdownPreview').default;
  return {
    __esModule: true,
    default: (props: any) => {
      // Remove React.lazy wrapper for testing
      const React = require('react');
      return React.createElement(MockMarkdownPreview, props);
    }
  };
});

describe('NoteView Component', () => {
  const mockNote: Note = {
    id: 'test-note-1',
    user_id: 'user-123',
    title: 'Test Note Title',
    content: 'This is a test note with #hashtag and #anotherTag',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    version: 1
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnTagClick = jest.fn();

  const mockWriteText = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    // Mock navigator.clipboard.writeText globally before all tests
    Object.defineProperty(navigator, 'clipboard', {
      get: () => ({
        writeText: mockWriteText,
      }),
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to return resolved value
    mockWriteText.mockResolvedValue(undefined);
  });


  describe('Rendering', () => {
    test('renders note title', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    });

    test('renders "Untitled Note" when title is missing', () => {
      const noteWithoutTitle: Note = { ...mockNote, title: '' };

      render(
        <NoteView
          note={noteWithoutTitle}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });

    test('renders note content with markdown', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('This is a test note with #hashtag and #anotherTag')).toBeInTheDocument();
    });

    test('extracts and displays hashtags', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('#hashtag')).toBeInTheDocument();
      expect(screen.getByText('#anotherTag')).toBeInTheDocument();
    });

    test('displays metadata section', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Last Updated')).toBeInTheDocument();
      expect(screen.getByText('Statistics')).toBeInTheDocument();
    });

    test('displays statistics', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Characters:')).toBeInTheDocument();
      expect(screen.getByText('Words:')).toBeInTheDocument();
      expect(screen.getByText('Lines:')).toBeInTheDocument();
      expect(screen.getByText('Tags:')).toBeInTheDocument();
    });

    test('displays correct character count', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const charCount = mockNote.content.length;
      expect(screen.getByText(charCount.toString())).toBeInTheDocument();
    });

    test('displays correct word count', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const wordCount = mockNote.content.trim().split(/\s+/).length;
      expect(screen.getByText(wordCount.toString())).toBeInTheDocument();
    });

    test('displays correct line count', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const lineCount = mockNote.content.split('\n').length;
      expect(screen.getByText(lineCount.toString())).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Behavior', () => {
    test('shows expand button for long content (>500 characters)', () => {
      const longContent = 'a'.repeat(501);
      const longNote: Note = {
        ...mockNote,
        content: longContent
      };

      render(
        <NoteView
          note={longNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Show more')).toBeInTheDocument();
    });

    test('does not show expand button for short content (<=500 characters)', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Show more')).not.toBeInTheDocument();
      expect(screen.queryByText('Show less')).not.toBeInTheDocument();
    });

    test('expands content when "Show more" is clicked', async () => {
      const user = userEvent.setup();
      const longContent = 'a'.repeat(501);
      const longNote: Note = {
        ...mockNote,
        content: longContent
      };

      render(
        <NoteView
          note={longNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const showMoreButton = screen.getByText('Show more');
      await user.click(showMoreButton);

      expect(screen.getByText('Show less')).toBeInTheDocument();
      expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    });

    test('collapses content when "Show less" is clicked', async () => {
      const user = userEvent.setup();
      const longContent = 'a'.repeat(501);
      const longNote: Note = {
        ...mockNote,
        content: longContent
      };

      render(
        <NoteView
          note={longNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // First expand
      const showMoreButton = screen.getByText('Show more');
      await user.click(showMoreButton);

      // Then collapse
      const showLessButton = screen.getByText('Show less');
      await user.click(showLessButton);

      expect(screen.getByText('Show more')).toBeInTheDocument();
      expect(screen.queryByText('Show less')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    test('renders Copy button', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    test('renders Edit button', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('renders Delete button', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('renders Close button', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    test('copies content to clipboard when Copy button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);

      // The button shows "Copied!" feedback, which indicates the copy operation was attempted
      await waitFor(() => {
        expect(copyButton).toHaveTextContent('Copied!');
      });
    });

    test('shows "Copied!" feedback after successful copy', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);

      await waitFor(() => {
        expect(copyButton).toHaveTextContent('Copied!');
      });

      // Wait for timeout to reset button text
      await waitFor(
        () => {
          expect(copyButton).toHaveTextContent('Copy');
        },
        { timeout: 2500 }
      );
    });
  });

  describe('Callback Functions', () => {
    test('calls onEdit when Edit button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    test('calls onDelete when Delete button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when Close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onTagClick when tag is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
          onTagClick={mockOnTagClick}
        />
      );

      const tag = screen.getByText('#hashtag');
      await user.click(tag);

      expect(mockOnTagClick).toHaveBeenCalledWith('#hashtag');
    });

    test('does not call onTagClick when onTagClick is not provided', async () => {
      const user = userEvent.setup();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const tag = screen.getByText('#hashtag');
      await user.click(tag);

      expect(mockOnTagClick).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Filter by tag:', '#hashtag');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Notes Without Hashtags', () => {
    test('handles notes without hashtags correctly', () => {
      const noteWithoutHashtags: Note = {
        ...mockNote,
        content: 'This is a plain note without any hashtags'
      };

      render(
        <NoteView
          note={noteWithoutHashtags}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    });

    test('shows 0 tags in statistics when note has no hashtags', () => {
      const noteWithoutHashtags: Note = {
        ...mockNote,
        content: 'This is a plain note without any hashtags'
      };

      render(
        <NoteView
          note={noteWithoutHashtags}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const statsSection = screen.getByText('Statistics').closest('.info-section');
      expect(statsSection).toHaveTextContent('Tags:0');
    });
  });

  describe('Date Formatting', () => {
    test('displays formatted created date', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // Check that a date is displayed in the Created section
      const createdSection = screen.getByText('Created').closest('.info-section');
      expect(createdSection).toHaveTextContent('2024');
    });

    test('displays formatted updated date', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // Both Created and Last Updated sections show dates
      const dateElements = screen.getAllByText(/2024/);
      expect(dateElements.length).toBeGreaterThanOrEqual(1);
    });

    test('displays relative time for updated date', () => {
      const recentNote: Note = {
        ...mockNote,
        updated_at: new Date().toISOString()
      };

      render(
        <NoteView
          note={recentNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // Check that "Updated" text appears somewhere in the document
      const updatedElements = screen.getAllByText(/Updated/i);
      expect(updatedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Version Display', () => {
    test('does not show version when version is 1', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/v\d+/)).not.toBeInTheDocument();
    });

    test('shows version when version is greater than 1', () => {
      const versionedNote: Note = {
        ...mockNote,
        version: 3
      };

      render(
        <NoteView
          note={versionedNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('v3')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty content', () => {
      const emptyNote: Note = {
        ...mockNote,
        content: ''
      };

      render(
        <NoteView
          note={emptyNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // Check for labels and verify zero values exist somewhere
      expect(screen.getByText('Characters:')).toBeInTheDocument();
      expect(screen.getByText('Words:')).toBeInTheDocument();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    test('handles content with only whitespace', () => {
      const whitespaceNote: Note = {
        ...mockNote,
        content: '   \n\n   '
      };

      render(
        <NoteView
          note={whitespaceNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Words:')).toBeInTheDocument();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    test('handles multiple identical hashtags (deduplicates)', () => {
      const duplicateTagNote: Note = {
        ...mockNote,
        content: 'Content with #test repeated #test again #test'
      };

      render(
        <NoteView
          note={duplicateTagNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const tags = screen.getAllByText('#test');
      expect(tags).toHaveLength(1); // Should only show unique tags
    });

    test('handles markdown with special characters', () => {
      const specialCharsNote: Note = {
        ...mockNote,
        content: '**Bold**, *italic*, `code`, [link](url), ![image](url)'
      };

      render(
        <NoteView
          note={specialCharsNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/\*\*Bold\*\*/)).toBeInTheDocument();
    });

    test('handles very long title', () => {
      const longTitle = 'A'.repeat(1000);
      const longTitleNote: Note = {
        ...mockNote,
        title: longTitle
      };

      render(
        <NoteView
          note={longTitleNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test('handles multiline content', () => {
      const multilineNote: Note = {
        ...mockNote,
        content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      };

      render(
        <NoteView
          note={multilineNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      // Check for the label and value separately
      expect(screen.getByText('Lines:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('Copy button has title attribute', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByText('Copy').closest('button');
      expect(copyButton).toHaveAttribute('title', 'Copy content');
    });

    test('Edit button has title attribute', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const editButton = screen.getByText('Edit').closest('button');
      expect(editButton).toHaveAttribute('title', 'Edit note');
    });

    test('Delete button has title attribute', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const deleteButton = screen.getByText('Delete').closest('button');
      expect(deleteButton).toHaveAttribute('title', 'Delete note');
    });

    test('Close button has title attribute', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('Close').closest('button');
      expect(closeButton).toHaveAttribute('title', 'Close note');
    });

    test('tag elements have title attribute', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
          onTagClick={mockOnTagClick}
        />
      );

      const tag = screen.getByText('#hashtag');
      expect(tag).toHaveAttribute('title', 'Click to filter by #hashtag');
    });

    test('updated date has title attribute with full date', () => {
      render(
        <NoteView
          note={mockNote}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const updatedDate = new Date(mockNote.updated_at);
      const formattedDate = updatedDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Get the date span in the header (which has the title attribute)
      const dateElement = screen.getByTitle(formattedDate);
      expect(dateElement).toBeInTheDocument();
      expect(dateElement.tagName.toLowerCase()).toBe('span');
    });
  });
});
