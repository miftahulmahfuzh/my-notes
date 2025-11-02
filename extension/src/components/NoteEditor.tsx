import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import TemplateSelector from './TemplateSelector';

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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!content.trim()) return;

    setAutoSaveStatus('saving');
    try {
      await onSave({ title: title || undefined, content });
      setAutoSaveStatus('saved');
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Auto-save failed:', error);
    }
  }, [title, content, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (content.trim() && content !== note?.content) {
        autoSave();
      }
    }, 2000); // 2 second debounce

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, note?.content, autoSave]);

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
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          handleSave();
          break;
        case 'Enter':
          // Ctrl+Enter should save (not Enter alone)
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          if (content !== note?.content || title !== note?.title) {
            if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
              onCancel();
            }
          } else {
            onCancel();
          }
          break;
      }
    }

    // Shift+Enter should save (as per user request for Ctrl+Shift+Enter)
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
      return;
    }

    // For regular Enter key in textarea, let it work naturally (create new line)
    // We don't handle it here, so the textarea default behavior applies

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

  const handleTemplateSelect = async (templateId: string, variables?: Record<string, string>) => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('Please log in to use templates');
        return;
      }

      const response = await fetch(`/api/v1/templates/${templateId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          variables: variables || {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply template');
      }

      const result = await response.json();
      const processedContent = result.results.content;

      // Apply the template content
      setContent(processedContent);

      // Auto-generate title from template content if no title exists
      if (!title) {
        const generatedTitle = generateTitleFromContent(processedContent);
        setTitle(generatedTitle);
      }

      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert('Failed to apply template. Please try again.');
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
            onClick={() => setShowTemplateSelector(true)}
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

            <div className="editor-status">
              {autoSaveStatus === 'saving' && (
                <span className="auto-save-status saving">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Saving...
                </span>
              )}
              {autoSaveStatus === 'saved' && hasChanges && (
                <span className="auto-save-status saved">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Saved
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="auto-save-status error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  Save failed
                </span>
              )}
            </div>
          </div>
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
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
              <span>Save note</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>
              <span>Save note</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>Esc</kbd>
              <span>Cancel (with confirmation)</span>
            </div>
            <div className="shortcut">
              <kbd>Tab</kbd>
              <span>Indent text</span>
            </div>
          </div>
        </div>
      </div>

      {showTemplateSelector && (
        <TemplateSelector
          onTemplateSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
};

export default NoteEditor;