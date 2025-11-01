import React, { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onTagFilter: (tag: string) => void;
  placeholder?: string;
  initialValue?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onTagFilter,
  placeholder = "Search notes...",
  initialValue = ''
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches from storage
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const result = await chrome.storage.local.get(['recentSearches']);
        setRecentSearches(result.recentSearches || []);
      } catch (error) {
        console.error('Failed to load recent searches:', error);
      }
    };
    loadRecentSearches();
  }, []);

  // Save recent searches to storage
  const saveRecentSearches = async (searches: string[]) => {
    try {
      await chrome.storage.local.set({ recentSearches: searches.slice(0, 10) }); // Keep only 10 most recent
    } catch (error) {
      console.error('Failed to save recent searches:', error);
    }
  };

  // Extract hashtags from query
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#\w+/g;
    const matches = text.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  };

  // Generate suggestions based on query
  const generateSuggestions = (input: string): string[] => {
    const hashtags = extractHashtags(input);
    const suggestions: string[] = [];

    // Add hashtag suggestions
    if (hashtags.length > 0) {
      hashtags.forEach(tag => {
        suggestions.push(`Filter by ${tag}`);
      });
    }

    // Add recent searches that match
    recentSearches.forEach(search => {
      if (search.toLowerCase().includes(input.toLowerCase()) && search !== input) {
        suggestions.push(search);
      }
    });

    // Add popular search suggestions
    if (input.length > 0) {
      const popularSuggestions = [
        `${input} #important`,
        `${input} #work`,
        `${input} #personal`,
        `${input} #todo`,
        `${input} #idea`
      ];
      suggestions.push(...popularSuggestions);
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length > 0) {
      const newSuggestions = generateSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle search submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  // Perform search
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Check if it's a hashtag search
    const hashtags = extractHashtags(searchQuery);
    if (hashtags.length === 1 && searchQuery.trim() === hashtags[0]) {
      onTagFilter(hashtags[0]);
    } else {
      onSearch(searchQuery.trim());
    }

    // Save to recent searches
    const updatedRecentSearches = [searchQuery.trim(), ...recentSearches.filter(s => s !== searchQuery.trim())];
    setRecentSearches(updatedRecentSearches);
    saveRecentSearches(updatedRecentSearches);

    // Clear suggestions
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.startsWith('Filter by ')) {
      const tag = suggestion.replace('Filter by ', '');
      onTagFilter(tag);
      setQuery(tag);
    } else {
      setQuery(suggestion);
      performSearch(suggestion);
    }
  };

  // Handle clear search
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSearch('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle quick tag shortcuts
  const handleQuickTag = (tag: string) => {
    const newQuery = query ? `${query} ${tag}` : tag;
    setQuery(newQuery);
    onTagFilter(tag);
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <div className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="search-input"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="search-clear"
              title="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <button type="submit" className="search-btn" disabled={!query.trim()}>
          Search
        </button>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="search-suggestions">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="suggestion-item"
            >
              {suggestion.startsWith('Filter by ') ? (
                <>
                  <span className="suggestion-icon">#</span>
                  <span className="suggestion-text">{suggestion}</span>
                </>
              ) : (
                <>
                  <span className="suggestion-icon">🔍</span>
                  <span className="suggestion-text">{suggestion}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick tag shortcuts */}
      <div className="quick-tags">
        <span className="quick-tags-label">Quick tags:</span>
        {['#important', '#work', '#personal', '#todo', '#idea'].map(tag => (
          <button
            key={tag}
            onClick={() => handleQuickTag(tag)}
            className="quick-tag-btn"
            title={`Filter by ${tag}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Recent searches */}
      {recentSearches.length > 0 && !query && (
        <div className="recent-searches">
          <span className="recent-searches-label">Recent:</span>
          {recentSearches.slice(0, 5).map((search, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(search);
                performSearch(search);
              }}
              className="recent-search-btn"
              title={`Search for "${search}"`}
            >
              {search}
            </button>
          ))}
        </div>
      )}

      {/* Search tips */}
      <div className="search-tips">
        <div className="tip">
          <strong>Tip:</strong> Use hashtags like #work or #todo to filter notes
        </div>
        <div className="tip">
          <strong>Tip:</strong> Press Ctrl+K to quickly focus search
        </div>
      </div>
    </div>
  );
};

export default SearchBar;