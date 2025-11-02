import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar from './MarkdownToolbar';
import MarkdownHelp from './MarkdownHelp';

interface MarkdownEditorProps {
  note?: Note;
  onSave: (note: { title?: string; content: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

interface MarkdownResult {
  html: string;
  toc: Array<{
    level: number;
    title: string;
    anchor: string;
    children: any[];
  }>;
  metadata: Record<string, string>;
  tags: string[];
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  onSave,
  onCancel,
  loading = false,
  placeholder = "Start typing your markdown note...",
  autoFocus = true
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [showHelp, setShowHelp] = useState(false);
  const [previewData, setPreviewData] = useState<MarkdownResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-generate title from first line if not provided
  const generateTitleFromContent = useCallback((text: string): string => {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    if (!firstLine) return '';

    // Remove markdown formatting from title
    const cleanLine = firstLine.replace(/^#+\s*/, ''); // Remove heading markers
    return cleanLine.length > 50 ? cleanLine.substring(0, 47) + '...' : cleanLine;
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

  // Sync scroll between editor and preview in split mode
  const handleEditorScroll = useCallback(() => {
    if (previewMode === 'split' && textareaRef.current && previewRef.current) {
      const editor = textareaRef.current;
      const preview = previewRef.current;

      const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
      preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
    }
  }, [previewMode]);

  // Preview markdown content
  const previewMarkdown = useCallback(async (markdownContent: string) => {
    if (!markdownContent.trim()) {
      setPreviewData(null);
      return;
    }

    setIsPreviewLoading(true);
    try {
      // In a real implementation, this would call the backend API
      // For now, we'll simulate a local preview
      const mockPreview: MarkdownResult = {
        html: generateSimpleMarkdownHTML(markdownContent),
        toc: extractTOC(markdownContent),
        metadata: { title: generateTitleFromContent(markdownContent) },
        tags: extractHashtags(markdownContent)
      };
      setPreviewData(mockPreview);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewData(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [generateTitleFromContent]);

  // Update preview when content changes
  useEffect(() => {
    if (previewMode === 'preview' || previewMode === 'split') {
      const timeoutId = setTimeout(() => {
        previewMarkdown(content);
      }, 300); // Debounce preview

      return () => clearTimeout(timeoutId);
    }
  }, [content, previewMode, previewMarkdown]);

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
    if (autoFocus && textareaRef.current && previewMode === 'edit') {
      textareaRef.current.focus();
    }
  }, [autoFocus, previewMode]);

  const handleSave = async () => {
    if (!content.trim()) {
      alert('Note content cannot be empty');
      return;
    }

    if (content.length > 50000) { // Increased limit for markdown
      alert('Note content is too long (max 50,000 characters)');
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
        case 'p':
          e.preventDefault();
          setPreviewMode(previewMode === 'edit' ? 'preview' : 'edit');
          break;
        case '/':
          e.preventDefault();
          setShowHelp(!showHelp);
          break;
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
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

    // Markdown-specific shortcuts
    if (!e.ctrlKey && !e.metaKey && textareaRef.current === e.target) {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          insertMarkdown('  ');
          break;
        case 'b':
          if (e.shiftKey) {
            e.preventDefault();
            wrapSelection('**', '**');
          }
          break;
        case 'i':
          if (e.shiftKey) {
            e.preventDefault();
            wrapSelection('*', '*');
          }
          break;
        case '`':
          if (e.shiftKey) {
            e.preventDefault();
            wrapSelection('`', '`');
          }
          break;
      }
    }
  };

  const insertMarkdown = (markdown: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newContent = content.substring(0, start) + markdown + content.substring(end);
    setContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + markdown.length;
      }
    }, 0);
  };

  const wrapSelection = (before: string, after: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    setContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + before.length;
        textareaRef.current.selectionEnd = start + before.length + selectedText.length;
      }
    }, 0);
  };

  const handleToolbarAction = (action: string, value?: string) => {
    switch (action) {
      case 'bold':
        wrapSelection('**', '**');
        break;
      case 'italic':
        wrapSelection('*', '*');
        break;
      case 'strikethrough':
        wrapSelection('~~', '~~');
        break;
      case 'code':
        wrapSelection('`', '`');
        break;
      case 'codeBlock':
        if (value) {
          insertMarkdown(`\`\`\`${value}\n\`\`\`\n`);
        } else {
          insertMarkdown('\n```\n\n```\n');
        }
        break;
      case 'heading':
        const level = parseInt(value || '1');
        wrapSelection('#'.repeat(level) + ' ', '');
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          wrapSelection('[', `](${url})`);
        }
        break;
      case 'image':
        const imageUrl = prompt('Enter image URL:');
        const altText = prompt('Enter alt text:');
        if (imageUrl) {
          insertMarkdown(`![${altText || ''}](${imageUrl})`);
        }
        break;
      case 'list':
        wrapSelection('- ', '');
        break;
      case 'orderedList':
        wrapSelection('1. ', '');
        break;
      case 'quote':
        wrapSelection('> ', '');
        break;
      case 'horizontalRule':
        insertMarkdown('\n---\n');
        break;
      case 'table':
        insertMarkdown('\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n');
        break;
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
    if (value.length <= 50000) { // Increased limit for markdown
      setContent(value);
    }
  };

  const hasChanges = content !== note?.content || title !== note?.title;

  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  const extractTOC = (text: string): Array<{ level: number; title: string; anchor: string; children: any[] }> => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: Array<{ level: number; title: string; anchor: string; children: any[] }> = [];
    let match;

    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[1].length;
      const title = match[2];
      const anchor = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

      toc.push({
        level,
        title,
        anchor,
        children: []
      });
    }

    return toc;
  };

  const generateSimpleMarkdownHTML = (markdown: string): string => {
    // This is a very basic markdown parser for preview
    // In production, use a proper library or backend API
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  };

  const hashtags = extractHashtags(content);

  return (
    <div className="markdown-editor">
      <div className="editor-header">
        <h3 className="editor-title">
          {note ? 'Edit Markdown Note' : 'Create New Markdown Note'}
        </h3>
        <div className="editor-actions">
          <div className="view-modes">
            <button
              onClick={() => setPreviewMode('edit')}
              className={`view-mode-btn ${previewMode === 'edit' ? 'active' : ''}`}
              title="Edit mode (Ctrl+P)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
            </button>
            <button
              onClick={() => setPreviewMode('preview')}
              className={`view-mode-btn ${previewMode === 'preview' ? 'active' : ''}`}
              title="Preview mode"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Preview
            </button>
            <button
              onClick={() => setPreviewMode('split')}
              className={`view-mode-btn ${previewMode === 'split' ? 'active' : ''}`}
              title="Split view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
              Split
            </button>
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="help-btn"
            title="Markdown help (Ctrl+/)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
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

      {/* Markdown Toolbar */}
      {(previewMode === 'edit' || previewMode === 'split') && (
        <MarkdownToolbar onAction={handleToolbarAction} />
      )}

      {/* Markdown Help */}
      {showHelp && (
        <MarkdownHelp onClose={() => setShowHelp(false)} />
      )}

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

        <div className={`content-section ${previewMode}`}>
          {previewMode === 'edit' && (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onScroll={handleEditorScroll}
              placeholder={placeholder}
              className="content-textarea markdown-textarea"
              rows={12}
              maxLength={50000}
              style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
            />
          )}

          {previewMode === 'preview' && (
            <div className="preview-container">
              {isPreviewLoading ? (
                <div className="preview-loading">
                  <div className="loading-spinner"></div>
                  <p>Rendering preview...</p>
                </div>
              ) : previewData ? (
                <MarkdownPreview
                  html={previewData.html}
                  toc={previewData.toc}
                  metadata={previewData.metadata}
                />
              ) : (
                <div className="preview-empty">
                  <p>Nothing to preview. Start writing markdown content.</p>
                </div>
              )}
            </div>
          )}

          {previewMode === 'split' && (
            <div className="split-view">
              <div className="editor-pane">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  onScroll={handleEditorScroll}
                  placeholder={placeholder}
                  className="content-textarea markdown-textarea"
                  rows={12}
                  maxLength={50000}
                  style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                />
              </div>
              <div className="preview-pane" ref={previewRef}>
                {isPreviewLoading ? (
                  <div className="preview-loading">
                    <div className="loading-spinner"></div>
                    <p>Rendering preview...</p>
                  </div>
                ) : previewData ? (
                  <MarkdownPreview
                    html={previewData.html}
                    toc={previewData.toc}
                    metadata={previewData.metadata}
                  />
                ) : (
                  <div className="preview-empty">
                    <p>Nothing to preview. Start writing markdown content.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(previewMode === 'edit' || previewMode === 'split') && (
            <div className="editor-footer">
              <div className="editor-stats">
                <span className="char-count">
                  {charCount}/50,000 characters
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
          )}
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
          <h4 className="shortcuts-title">Markdown Keyboard Shortcuts</h4>
          <div className="shortcuts-list">
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
              <span>Save note</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>P</kbd>
              <span>Toggle preview mode</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>/</kbd>
              <span>Show markdown help</span>
            </div>
            <div className="shortcut">
              <kbd>Shift</kbd> + <kbd>B</kbd>
              <span>Bold text</span>
            </div>
            <div className="shortcut">
              <kbd>Shift</kbd> + <kbd>I</kbd>
              <span>Italic text</span>
            </div>
            <div className="shortcut">
              <kbd>Shift</kbd> + <kbd>`</kbd>
              <span>Inline code</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>
              <span>Save note</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>Esc</kbd>
              <span>Cancel (with confirmation)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;