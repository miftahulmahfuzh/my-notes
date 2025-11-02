import React, { useState } from 'react';
import { ShortcutCategory, ShortcutAction } from '../types/shortcuts';

interface ShortcutHelpProps {
  shortcuts: ShortcutCategory[];
  onClose: () => void;
  onEditShortcut?: (shortcut: ShortcutAction) => void;
}

const ShortcutHelp: React.FC<ShortcutHelpProps> = ({
  shortcuts,
  onClose,
  onEditShortcut
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter shortcuts based on category and search
  const filteredShortcuts = shortcuts
    .filter(category =>
      activeCategory === 'all' || category.id === activeCategory
    )
    .flatMap(category => category.shortcuts)
    .filter(shortcut => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        shortcut.name.toLowerCase().includes(query) ||
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.defaultKey.toLowerCase().includes(query)
      );
    });

  const formatShortcut = (shortcut: string): string => {
    return shortcut
      .split('+')
      .map(key => {
        switch (key.toLowerCase()) {
          case 'ctrl': return 'Ctrl';
          case 'alt': return 'Alt';
          case 'shift': return 'Shift';
          case 'meta':
          case 'cmd': return 'Cmd';
          default: return key.toUpperCase();
        }
      })
      .join(' + ');
  };

  const handleShortcutClick = (shortcut: ShortcutAction) => {
    if (onEditShortcut) {
      onEditShortcut(shortcut);
    }
  };

  return (
    <div className="shortcut-help-overlay">
      <div className="shortcut-help-modal">
        <div className="shortcut-help-header">
          <h2>Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="close-btn"
            title="Close help"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="shortcut-help-controls">
          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All Shortcuts
            </button>
            {shortcuts.map(category => (
              <button
                key={category.id}
                className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="search-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="shortcut-help-content">
          {filteredShortcuts.length === 0 ? (
            <div className="no-shortcuts-found">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              <p>No shortcuts found</p>
              <p>Try searching with different keywords</p>
            </div>
          ) : (
            <div className="shortcuts-grid">
              {filteredShortcuts.map(shortcut => (
                <div
                  key={shortcut.id}
                  className="shortcut-item"
                  onClick={() => handleShortcutClick(shortcut)}
                >
                  <div className="shortcut-info">
                    <div className="shortcut-name">
                      {shortcut.name}
                      {!shortcut.enabled && (
                        <span className="disabled-badge">Disabled</span>
                      )}
                    </div>
                    <div className="shortcut-description">
                      {shortcut.description}
                    </div>
                    <div className="shortcut-category">
                      {shortcuts.find(cat => cat.id === shortcut.category)?.name}
                    </div>
                  </div>
                  <div className="shortcut-keys">
                    <kbd className="shortcut-key">
                      {formatShortcut(shortcut.userKey || shortcut.defaultKey)}
                    </kbd>
                    {onEditShortcut && (
                      <button
                        className="edit-shortcut-btn"
                        title="Edit shortcut"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShortcutClick(shortcut);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shortcut-help-footer">
          <div className="shortcut-tips">
            <h3>Tips for using shortcuts</h3>
            <ul>
              <li>Use <kbd>Ctrl</kbd> + <kbd>K</kbd> to quickly open the command palette</li>
              <li>Most shortcuts work globally throughout the application</li>
              <li>Context-sensitive shortcuts only work when relevant</li>
              <li>You can customize shortcuts in the settings</li>
              <li>Hold <kbd>Shift</kbd> with navigation shortcuts for alternative actions</li>
            </ul>
          </div>

          <div className="shortcut-legend">
            <h3>Legend</h3>
            <div className="legend-items">
              <div className="legend-item">
                <kbd>Ctrl</kbd>
                <span>Control key (Windows/Linux)</span>
              </div>
              <div className="legend-item">
                <kbd>Cmd</kbd>
                <span>Command key (Mac)</span>
              </div>
              <div className="legend-item">
                <kbd>Shift</kbd>
                <span>Shift key</span>
              </div>
              <div className="legend-item">
                <kbd>Alt</kbd>
                <span>Alt key (Option on Mac)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelp;