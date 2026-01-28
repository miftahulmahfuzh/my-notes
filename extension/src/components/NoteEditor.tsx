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
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number; lineHeight: number } | null>(null);
  const [shouldFlip, setShouldFlip] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll selected item into view
  useEffect(() => {
    if (showSuggestions && selectedIndex >= 0 && suggestionsRef.current) {
      const listContainer = suggestionsRef.current.querySelector('.tag-autocomplete-list');
      if (listContainer) {
        const items = listContainer.querySelectorAll('.tag-autocomplete-item');
        const selectedItem = items[selectedIndex] as HTMLDivElement;
        if (selectedItem) {
          selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }, [selectedIndex, showSuggestions]);

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

  // Calculate cursor pixel coordinates using mirror div technique
  const calculateCursorCoordinates = useCallback((text: string, cursorPos: number): { x: number; y: number; lineHeight: number } | null => {
    if (!textareaRef.current) return null;

    const textarea = textareaRef.current;
    const style = window.getComputedStyle(textarea);
    const properties = [
      'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
      'fontSize', 'lineHeight', 'fontFamily', 'textAlign',
      'textTransform', 'textIndent', 'textDecoration',
      'letterSpacing', 'wordSpacing', 'direction', 'writingMode'
    ];

    // Create mirror div that mimics textarea styling
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.left = '0px';
    mirror.style.top = '0px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.width = style.width;
    mirror.style.height = style.height;

    properties.forEach(prop => {
      mirror.style[prop as any] = style[prop as any];
    });

    // Get the text before cursor
    const textBeforeCursor = text.substring(0, cursorPos);

    // Split by lines to calculate position
    const lines = textBeforeCursor.split('\n');
    const currentLineText = lines[lines.length - 1]; // Text on current line only

    // Set only the current line text to get X position
    mirror.textContent = currentLineText;

    // Add a span at the end to measure cursor position on current line
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    document.body.appendChild(mirror);

    // Get the span position (this gives us X on current line)
    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    // Calculate line height from computed style
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;

    // X position is the width of text before cursor on current line, plus padding, minus horizontal scroll
    const paddingLeft = parseFloat(style.paddingLeft);
    const x = spanRect.left - mirrorRect.left + paddingLeft - textarea.scrollLeft;

    // Y position is (line number - 1) * line height, plus padding, minus vertical scroll
    const paddingTop = parseFloat(style.paddingTop);
    const y = (lines.length - 1) * lineHeight + paddingTop - textarea.scrollTop;

    document.body.removeChild(mirror);

    return { x, y, lineHeight };
  }, []);

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
    setCursorCoords(null);
    setShouldFlip(false);
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

          // Calculate cursor pixel position
          const coords = calculateCursorCoordinates(value, cursorPos);
          console.log('🔍 Debug cursor coords:', coords);
          if (coords) {
            setCursorCoords(coords);

            // Check if dropdown should flip (not enough space below)
            const textareaRect = textareaRef.current.getBoundingClientRect();
            const estimatedDropdownHeight = 220; // Approximate height
            const spaceBelow = textareaRect.height - coords.y;
            setShouldFlip(spaceBelow < estimatedDropdownHeight);
            console.log('🔍 Debug positioning:', { coords, spaceBelow, shouldFlip: spaceBelow < estimatedDropdownHeight });
          }

          const suggestions = filterSuggestions(partialTag);
          setFilteredSuggestions(suggestions);
          setShowSuggestions(suggestions.length > 0);
          setSelectedIndex(0);
          console.log('🔍 Debug showSuggestions:', suggestions.length > 0);
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
              style={cursorCoords ? {
                position: 'absolute',
                left: `${Math.min(cursorCoords.x + 40, 400)}px`, // Add ~5 char offset, prevent going too far right
                top: shouldFlip ? 'auto' : `${cursorCoords.y + cursorCoords.lineHeight + 4}px`,
                bottom: shouldFlip ? `${cursorCoords.y - 4}px` : 'auto',
                width: 'fit-content',
                minWidth: '150px',
                maxWidth: '300px',
                zIndex: 9999,
                backgroundColor: 'white',
                border: '2px solid #FF4D00',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              } : {
                // Fallback positioning if cursor calculation fails
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '4px',
                width: 'fit-content',
                minWidth: '150px',
                maxWidth: '300px',
                zIndex: 9999,
                backgroundColor: 'white',
                border: '2px solid #FF4D00',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div className="tag-autocomplete-list">
                {filteredSuggestions.map((tag, index) => (
                  <div
                    key={tag}
                    ref={index === selectedIndex ? selectedItemRef : null}
                    className={`tag-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => insertTag(tag)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="tag-autocomplete-text">{tag}</span>
                    {index === selectedIndex && (
                      <span className="tag-autocomplete-hint">↵</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="tag-autocomplete-footer">
                <span>↑↓ or Ctrl+J/K</span>
                <span>Enter to accept</span>
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