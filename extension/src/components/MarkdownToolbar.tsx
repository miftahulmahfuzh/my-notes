import React, { useState } from 'react';

interface MarkdownToolbarProps {
  onAction: (action: string, value?: string) => void;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onAction }) => {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showCodeMenu, setShowCodeMenu] = useState(false);

  const handleAction = (action: string, value?: string) => {
    onAction(action, value);
    // Close menus after action
    setShowHeadingMenu(false);
    setShowCodeMenu(false);
  };

  return (
    <div className="markdown-toolbar">
      <div className="toolbar-group">
        <button
          onClick={() => handleAction('bold')}
          className="toolbar-btn"
          title="Bold (Ctrl+B)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button
          onClick={() => handleAction('italic')}
          className="toolbar-btn"
          title="Italic (Ctrl+I)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button
          onClick={() => handleAction('strikethrough')}
          className="toolbar-btn"
          title="Strikethrough"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <path d="M8 5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-1"></path>
            <path d="M17 14a3 3 0 0 1 0 6h-4a3 3 0 0 1-3-3"></path>
          </svg>
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <div className="toolbar-dropdown">
          <button
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
            className="toolbar-btn dropdown-toggle"
            title="Heading"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h8"></path>
              <path d="M4 6h8"></path>
              <path d="M4 18h8"></path>
              <path d="M20 6v12"></path>
            </svg>
          </button>
          {showHeadingMenu && (
            <div className="dropdown-menu">
              <button onClick={() => handleAction('heading', '1')} className="dropdown-item">
                <span className="heading-preview h1">Heading 1</span>
              </button>
              <button onClick={() => handleAction('heading', '2')} className="dropdown-item">
                <span className="heading-preview h2">Heading 2</span>
              </button>
              <button onClick={() => handleAction('heading', '3')} className="dropdown-item">
                <span className="heading-preview h3">Heading 3</span>
              </button>
              <button onClick={() => handleAction('heading', '4')} className="dropdown-item">
                <span className="heading-preview h4">Heading 4</span>
              </button>
              <button onClick={() => handleAction('heading', '5')} className="dropdown-item">
                <span className="heading-preview h5">Heading 5</span>
              </button>
              <button onClick={() => handleAction('heading', '6')} className="dropdown-item">
                <span className="heading-preview h6">Heading 6</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => handleAction('quote')}
          className="toolbar-btn"
          title="Quote"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031"></path>
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1"></path>
          </svg>
        </button>

        <button
          onClick={() => handleAction('code')}
          className="toolbar-btn"
          title="Inline code"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>

        <div className="toolbar-dropdown">
          <button
            onClick={() => setShowCodeMenu(!showCodeMenu)}
            className="toolbar-btn dropdown-toggle"
            title="Code block"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
          {showCodeMenu && (
            <div className="dropdown-menu">
              <button onClick={() => handleAction('codeBlock', '')} className="dropdown-item">
                Plain Text
              </button>
              <button onClick={() => handleAction('codeBlock', 'javascript')} className="dropdown-item">
                JavaScript
              </button>
              <button onClick={() => handleAction('codeBlock', 'typescript')} className="dropdown-item">
                TypeScript
              </button>
              <button onClick={() => handleAction('codeBlock', 'python')} className="dropdown-item">
                Python
              </button>
              <button onClick={() => handleAction('codeBlock', 'go')} className="dropdown-item">
                Go
              </button>
              <button onClick={() => handleAction('codeBlock', 'html')} className="dropdown-item">
                HTML
              </button>
              <button onClick={() => handleAction('codeBlock', 'css')} className="dropdown-item">
                CSS
              </button>
              <button onClick={() => handleAction('codeBlock', 'json')} className="dropdown-item">
                JSON
              </button>
              <button onClick={() => handleAction('codeBlock', 'bash')} className="dropdown-item">
                Bash/Shell
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          onClick={() => handleAction('list')}
          className="toolbar-btn"
          title="Unordered list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
        <button
          onClick={() => handleAction('orderedList')}
          className="toolbar-btn"
          title="Ordered list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"></line>
            <line x1="10" y1="12" x2="21" y2="12"></line>
            <line x1="10" y1="18" x2="21" y2="18"></line>
            <path d="M4 6h1v4"></path>
            <path d="M4 10h2"></path>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
          </svg>
        </button>
        <button
          onClick={() => handleAction('horizontalRule')}
          className="toolbar-btn"
          title="Horizontal rule"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button
          onClick={() => handleAction('link')}
          className="toolbar-btn"
          title="Insert link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </button>
        <button
          onClick={() => handleAction('image')}
          className="toolbar-btn"
          title="Insert image"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>
        <button
          onClick={() => handleAction('table')}
          className="toolbar-btn"
          title="Insert table"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MarkdownToolbar;