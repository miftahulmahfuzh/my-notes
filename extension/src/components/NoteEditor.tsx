import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import { CONFIG } from '../utils/config';
import { authService } from '../auth';
import { apiService } from '../api';
import { TagsListResponse } from '../types';

interface NoteEditorProps {
  note?: Note;
  onSave: (note: { title?: string; content: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onSave,
  onCancel,
  loading = false,
  placeholder = "Start typing your note...",
  autoFocus = true
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  // Autocomplete state
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-generate title from first line if not provided
  const generateTitleFromContent = useCallback((text: string): string => {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    if (!firstLine) return '';
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }, []);

  // Update character and word count
  useEffect(() => {
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [content]);

  // Auto-generate title from content if title is empty
  useEffect(() => {
    if (!title && content && !note) {
      const generatedTitle = generateTitleFromContent(content);
      setTitle(generatedTitle);
    }
  }, [content, title, note, generateTitleFromContent]);

  
  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Load all tags on mount for autocomplete
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await apiService.getTags({ limit: 100 });
        if (response.success && response.data?.tags) {
          // Extract tag names (they already include # prefix from backend)
          const tagNames = response.data.tags.map(tag => tag.name);
          setAvailableTags(tagNames);
        }
      } catch (error) {
        console.error('Failed to load tags for autocomplete:', error);
        // Gracefully degrade - autocomplete won't work but editor still functions
      }
    };
    loadTags();
  }, []);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSuggestions &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        closeSuggestions();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  // Find the hashtag trigger position and extract partial tag
  const findHashtagContext = (text: string, cursorPos: number): { triggerPos: number | null; partialTag: string } => {
    // Search backwards from cursor to find the most recent #
    const beforeCursor = text.substring(0, cursorPos);
    const hashtagMatch = beforeCursor.match(/#(\w*)$/);

    if (hashtagMatch) {
      const triggerPos = beforeCursor.lastIndexOf('#');
      const partialTag = hashtagMatch[1]; // Text after #, before cursor
      return { triggerPos, partialTag };
    }

    return { triggerPos: null, partialTag: '' };
  };

  // Filter available tags based on partial input
  const filterSuggestions = useCallback((partial: string): string[] => {
    if (!partial) return availableTags;

    const partialLower = partial.toLowerCase();
    return availableTags.filter(tag =>
      tag.toLowerCase().startsWith(partialLower) ||
      tag.toLowerCase().includes(partialLower)
    ).slice(0, 20); // Limit to 20 suggestions
  }, [availableTags]);

  // Insert selected tag at cursor position
  const insertTag = (tag: string) => {
    if (triggerPosition === null || !textareaRef.current) return;

    const newContent =
      content.substring(0, triggerPosition) + // Content before #
      tag +                                    // Selected tag
      ' ' +                                    // Trailing space
      content.substring(textareaRef.current.selectionStart); // Content after cursor

    setContent(newContent);

    // Move cursor to position after inserted tag
    const newCursorPos = triggerPosition + tag.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
      }
    }, 0);

    // Close dropdown
    closeSuggestions();
  };

  // Close suggestions dropdown
  const closeSuggestions = () => {
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    setSelectedIndex(0);
    setTriggerPosition(null);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      alert('Note content cannot be empty');
      return;
    }

    if (content.length > 10000) {
      alert('Note content is too long (max 10,000 characters)');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ title: title || undefined, content });
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Autocomplete keyboard handlers (only when textarea is focused)
    if (document.activeElement === textareaRef.current && showSuggestions) {
      // Down arrow or Ctrl+J: move down in suggestions
      if ((e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) && filteredSuggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }

      // Up arrow or Ctrl+K: move up in suggestions
      if ((e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) && filteredSuggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        return;
      }

      // Ctrl+M or Enter: accept selected suggestion
      if ((e.key === 'm' && e.ctrlKey) || e.key === 'Enter') {
        e.preventDefault();
        if (filteredSuggestions[selectedIndex]) {
          insertTag(filteredSuggestions[selectedIndex]);
        }
        return;
      }

      // Ctrl+C: close dropdown (only when visible)
      if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        closeSuggestions();
        return;
      }

      // Escape: close dropdown
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSuggestions();
        return;
      }
    }

    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    // Tab to indent in textarea
    if (e.key === 'Tab' && !e.shiftKey && textareaRef.current === e.target) {
      e.preventDefault();
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
    // Enter key works normally to create new lines - no interference
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setTitle(value);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 10000) {
      setContent(value);

      // Check if we should show autocomplete
      if (textareaRef.current) {
        const cursorPos = textareaRef.current.selectionStart;
        const { triggerPos, partialTag } = findHashtagContext(value, cursorPos);

        // Only show if we have a # trigger and available tags
        if (triggerPos !== null && availableTags.length > 0) {
          setTriggerPosition(triggerPos);
          const suggestions = filterSuggestions(partialTag);
          setFilteredSuggestions(suggestions);
          setShowSuggestions(suggestions.length > 0);
          setSelectedIndex(0);
        } else {
          closeSuggestions();
        }
      }
    }
  };

  const hasChanges = content !== note?.content || title !== note?.title;

  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  const hashtags = extractHashtags(content);

  return (
    <div className="note-editor">
      <div className="editor-header">
        <h3 className="editor-title">
          {note ? 'Edit Note' : 'Create New Note'}
        </h3>
        <div className="editor-actions">
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving || loading}
            className="save-btn"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="title-section">
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            placeholder="Note title (optional)"
            className="title-input"
            maxLength={500}
          />
          <div className="title-counter">
            {title.length}/500
          </div>
        </div>

        <div className="content-section" style={{ position: 'relative' }}>
          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="tag-autocomplete-dropdown"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '4px',
                zIndex: 1000,
              }}
            >
              <div className="tag-autocomplete-list">
                {filteredSuggestions.map((tag, index) => (
                  <div
                    key={tag}
                    className={`tag-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => insertTag(tag)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="tag-autocomplete-text">{tag}</span>
                    {index === selectedIndex && (
                      <span className="tag-autocomplete-hint">Press Ctrl+M</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="tag-autocomplete-footer">
                <span>Use arrows or Ctrl+J/K to navigate</span>
                <span>Ctrl+M to accept</span>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="content-textarea"
            rows={8}
            maxLength={10000}
          />

          <div className="editor-footer">
            <div className="editor-stats">
              <span className="char-count">
                {charCount}/10,000 characters
              </span>
              <span className="word-count">
                {wordCount} words
              </span>
            </div>

            {hashtags.length > 0 && (
              <div className="hashtags-section">
                <h4 className="hashtags-title">Hashtags</h4>
                <div className="hashtags-list">
                  {hashtags.map((tag, index) => (
                    <span key={index} className="hashtag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="keyboard-shortcuts">
              <h4 className="shortcuts-title">Keyboard Shortcuts</h4>
              <div className="shortcuts-list">
                <div className="shortcut">
                  <kbd>Ctrl</kbd>+<kbd>s</kbd>
                  <span>Save note</span>
                </div>
                <div className="shortcut">
                  <kbd>#</kbd>
                  <span>Tag autocomplete</span>
                </div>
                <div className="shortcut">
                  <kbd>Ctrl</kbd>+<kbd>m</kbd>
                  <span>Accept tag</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;