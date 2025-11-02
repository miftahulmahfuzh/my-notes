import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import { CONFIG } from '../utils/config';
import { authService } from '../auth';

interface NoteEditorProps {
  note?: Note;
  onSave: (note: { title?: string; content: string }) => Promise<void>;
  onCancel: () => void;
  onShowTemplates?: (noteId?: string) => void; // New prop for template navigation
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onSave,
  onCancel,
  onShowTemplates,
  loading = false,
  placeholder = "Start typing your note...",
  autoFocus = true
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    }
  };

  // Handle template navigation - call the parent navigation function
  const handleShowTemplates = () => {
    if (onShowTemplates) {
      onShowTemplates(note?.id);
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
            onClick={handleShowTemplates}
            className="template-btn"
            title="Choose a template"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Templates
          </button>
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

        <div className="content-section">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;