import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommandPaletteItem, CommandPaletteState } from '../types/shortcuts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  recentItems?: CommandPaletteItem[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  recentItems = []
}) => {
  const [state, setState] = useState<CommandPaletteState>({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    filteredItems: []
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filterItems = useCallback((query: string, allItems: CommandPaletteItem[]): CommandPaletteItem[] => {
    if (!query.trim()) {
      // Show recent items first, then all other items
      return [...recentItems, ...allItems.filter(item =>
        !recentItems.some(recent => recent.id === item.id)
      )];
    }

    const lowerQuery = query.toLowerCase();
    return allItems.filter(item => {
      // Search in title, description, keywords, and category
      const searchableText = [
        item.title,
        item.description || '',
        item.category,
        ...(item.keywords || [])
      ].join(' ').toLowerCase();

      return searchableText.includes(lowerQuery);
    });
  }, [recentItems]);

  // Update filtered items when query or items change
  useEffect(() => {
    if (isOpen) {
      const filtered = filterItems(state.query, items);
      setState(prev => ({
        ...prev,
        isOpen: true,
        filteredItems: filtered,
        selectedIndex: Math.min(prev.selectedIndex, Math.max(0, filtered.length - 1))
      }));
    }
  }, [isOpen, items, state.query, filterItems]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const { selectedIndex, filteredItems } = state;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, filteredItems.length - 1)
        }));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0)
        }));
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        handleClose();
        break;

      case 'Tab':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
        break;

      default:
        break;
    }
  }, [state, filteredItems]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && state.filteredItems[state.selectedIndex]) {
      const selectedElement = listRef.current.children[state.selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [state.selectedIndex, state.filteredItems]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({
      ...prev,
      query: e.target.value,
      selectedIndex: 0
    }));
  };

  const executeItem = (item: CommandPaletteItem) => {
    try {
      item.action();
      handleClose();
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  };

  const handleClose = () => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      query: '',
      selectedIndex: 0,
      filteredItems: []
    }));
    onClose();
  };

  const handleItemClick = (item: CommandPaletteItem, index: number) => {
    setState(prev => ({ ...prev, selectedIndex: index }));
    executeItem(item);
  };

  // Group items by category
  const groupedItems = state.filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CommandPaletteItem[]>);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="command-palette-overlay" onClick={handleBackdropClick}>
      <div className="command-palette-modal">
        <div className="command-palette-header">
          <div className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={state.query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="command-palette-input"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="command-palette-actions">
            <kbd>↑↓</kbd> to navigate
            <kbd>Enter</kbd> to select
            <kbd>Esc</kbd> to close
          </div>
        </div>

        <div className="command-palette-content" ref={listRef}>
          {state.filteredItems.length === 0 ? (
            <div className="command-palette-empty">
              <p>No commands found</p>
              {state.query && (
                <p>Try searching for different keywords</p>
              )}
            </div>
          ) : (
            <div className="command-palette-list">
              {Object.entries(groupedItems).map(([category, categoryItems], categoryIndex) => (
                <div key={category} className="command-palette-category">
                  {Object.keys(groupedItems).length > 1 && (
                    <div className="category-header">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </div>
                  )}
                  {categoryItems.map((item, itemIndex) => {
                    const globalIndex = state.filteredItems.indexOf(item);
                    const isSelected = globalIndex === state.selectedIndex;
                    const isRecent = recentItems.some(recent => recent.id === item.id);

                    return (
                      <button
                        key={item.id}
                        className={`command-palette-item ${isSelected ? 'selected' : ''} ${isRecent ? 'recent' : ''}`}
                        onClick={() => handleItemClick(item, globalIndex)}
                        onMouseEnter={() => setState(prev => ({ ...prev, selectedIndex: globalIndex }))}
                      >
                        <div className="item-content">
                          {item.icon && (
                            <div className="item-icon">
                              {item.icon}
                            </div>
                          )}
                          <div className="item-text">
                            <div className="item-title">
                              {item.title}
                              {isRecent && <span className="recent-badge">Recent</span>}
                            </div>
                            {item.description && (
                              <div className="item-description">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {item.shortcut && (
                          <div className="item-shortcut">
                            {formatShortcut(item.shortcut)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {state.query && (
          <div className="command-palette-footer">
            <div className="search-info">
              {state.filteredItems.length} {state.filteredItems.length === 1 ? 'result' : 'results'}
              {state.query && ` for "${state.query}"`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Format shortcut key for display
const formatShortcut = (shortcut: string): string => {
  return shortcut
    .split('+')
    .map(key => {
      switch (key.toLowerCase()) {
        case 'ctrl': return '⌃';
        case 'alt': return '⌥';
        case 'shift': return '⇧';
        case 'meta':
        case 'cmd': return '⌘';
        default: return key.toUpperCase();
      }
    })
    .join('');
};

export default CommandPalette;