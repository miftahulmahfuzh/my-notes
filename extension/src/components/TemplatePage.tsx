import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Template } from '../types';
import { CONFIG } from '../utils/config';
import { authService } from '../auth';

// Custom hook for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Advanced search utility
const advancedSearch = (templates: Template[], query: string): Template[] => {
  if (!query.trim()) return templates;

  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

  return templates.filter(template => {
    const searchableFields = [
      template.name.toLowerCase(),
      template.description.toLowerCase(),
      template.content.toLowerCase(),
      template.category.toLowerCase(),
      ...template.tags.map(tag => tag.toLowerCase()),
      ...template.variables.map(variable => variable.toLowerCase())
    ].join(' ');

    // Calculate relevance score
    let score = 0;
    const fullText = searchableFields;

    // Exact phrase match
    if (fullText.includes(query.toLowerCase())) {
      score += 10;
    }

    // Individual term matches
    searchTerms.forEach(term => {
      if (template.name.toLowerCase().includes(term)) score += 5;
      if (template.description.toLowerCase().includes(term)) score += 3;
      if (template.category.toLowerCase().includes(term)) score += 2;
      if (template.tags.some(tag => tag.toLowerCase().includes(term))) score += 2;
      if (template.content.toLowerCase().includes(term)) score += 1;
      if (template.variables.some(variable => variable.toLowerCase().includes(term))) score += 1;
    });

    // Must have at least one match
    return score > 0;
  }).sort((a, b) => {
    // Sort by relevance (built-in templates first, then by name)
    if (a.is_built_in && !b.is_built_in) return -1;
    if (!a.is_built_in && b.is_built_in) return 1;
    return a.name.localeCompare(b.name);
  });
};

interface TemplatePageProps {
  onTemplateSelect: (templateId: string, variables: Record<string, string>) => void;
  onBack: () => void;
  noteId?: string; // For context - which note we're editing
}

const TemplatePage: React.FC<TemplatePageProps> = ({
  onTemplateSelect,
  onBack,
  noteId
}) => {
  // State management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [builtInTemplates, setBuiltInTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Refs for search functionality
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load templates on mount
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get auth headers from authService
      const authHeaders = await authService.getAuthHeader();

      if (!authHeaders.Authorization) {
        throw new Error('401 Unauthorized');
      }

      console.log('🔧 DEBUG: TemplatePage - Loading templates...');

      // Load user templates
      const userResponse = await fetch(`${CONFIG.API_BASE_URL}/templates`, {
        headers: authHeaders,
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('📥 DEBUG: TemplatePage - User templates response:', userData);
        // Backend returns {success: true, data: Array(2), total: 2}
        // So we need userData.data.data to get the actual array
        const templates = Array.isArray(userData?.data?.data) ? userData.data.data : [];
        console.log('✅ DEBUG: TemplatePage - Parsed user templates:', {
          isArray: Array.isArray(userData?.data?.data),
          data: userData?.data?.data,
          parsedLength: templates.length,
          templates: templates
        });
        setTemplates(templates);
      } else if (userResponse.status === 401) {
        throw new Error('401 Unauthorized');
      }

      // Load built-in templates
      const builtInResponse = await fetch(`${CONFIG.API_BASE_URL}/templates/built-in`, {
        headers: authHeaders,
      });

      if (builtInResponse.ok) {
        const builtInData = await builtInResponse.json();
        console.log('📥 DEBUG: TemplatePage - Built-in templates response:', builtInData);
        // Backend returns {success: true, data: Array(2), total: 2}
        // So we need builtInData.data.data to get the actual array
        const builtInTemplates = Array.isArray(builtInData?.data?.data) ? builtInData.data.data : [];
        console.log('✅ DEBUG: TemplatePage - Parsed built-in templates:', {
          isArray: Array.isArray(builtInData?.data?.data),
          data: builtInData?.data?.data,
          parsedLength: builtInTemplates.length,
          templates: builtInTemplates
        });
        setBuiltInTemplates(builtInTemplates);
      } else if (builtInResponse.status === 401) {
        throw new Error('401 Unauthorized');
      }

      console.log('🎉 DEBUG: TemplatePage - Templates loaded successfully');

    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Authorization')) {
          setError('Please log in to use templates');
        } else {
          setError('Failed to load templates');
        }
      } else {
        setError('Failed to load templates');
      }
      console.error('🔥 DEBUG: TemplatePage - Error loading templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates based on category and search
  const filteredTemplates = React.useMemo(() => {
    // Ensure arrays are properly initialized
    const safeTemplates = Array.isArray(templates) ? templates : [];
    const safeBuiltInTemplates = Array.isArray(builtInTemplates) ? builtInTemplates : [];

    console.log('🔍 DEBUG: TemplatePage - Filtering templates:', {
      safeTemplates: safeTemplates,
      safeBuiltInTemplates: safeBuiltInTemplates,
      selectedCategory,
      searchQuery,
      templatesLength: safeTemplates.length,
      builtInTemplatesLength: safeBuiltInTemplates.length
    });

    let allTemplates = [...safeTemplates];

    if (selectedCategory === 'all' || selectedCategory === 'built-in') {
      if (selectedCategory === 'built-in') {
        allTemplates = safeBuiltInTemplates;
        console.log('📋 DEBUG: TemplatePage - Using built-in templates only:', allTemplates.length);
      } else {
        allTemplates = [...safeTemplates, ...safeBuiltInTemplates];
        console.log('📋 DEBUG: TemplatePage - Using all templates:', allTemplates.length);
      }
    } else {
      allTemplates = [
        ...safeTemplates.filter(t => t.category === selectedCategory),
        ...safeBuiltInTemplates.filter(t => t.category === selectedCategory)
      ];
      console.log('📋 DEBUG: TemplatePage - Using category filtered templates:', {
        category: selectedCategory,
        userCount: safeTemplates.filter(t => t.category === selectedCategory).length,
        builtInCount: safeBuiltInTemplates.filter(t => t.category === selectedCategory).length,
        total: allTemplates.length
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const beforeSearch = allTemplates.length;
      allTemplates = allTemplates.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
      console.log('🔍 DEBUG: TemplatePage - After search filter:', {
        query,
        before: beforeSearch,
        after: allTemplates.length
      });
    }

    const sortedTemplates = allTemplates.sort((a, b) => {
      // Sort by usage count and built-in status
      if (a.is_built_in && !b.is_built_in) return -1;
      if (!a.is_built_in && b.is_built_in) return 1;
      return b.usage_count - a.usage_count;
    });

    console.log('✅ DEBUG: TemplatePage - Final filtered templates:', {
      count: sortedTemplates.length,
      templates: sortedTemplates.map(t => ({ id: t.id, name: t.name, category: t.category, is_built_in: t.is_built_in }))
    });

    return sortedTemplates;
  }, [templates, builtInTemplates, selectedCategory, searchQuery]);

  // Calculate category counts for display
  const getCategoryCounts = useCallback(() => {
    const allTemplates = [...(Array.isArray(templates) ? templates : []), ...(Array.isArray(builtInTemplates) ? builtInTemplates : [])];

    return {
      all: allTemplates.length,
      'built-in': allTemplates.filter(t => t.is_built_in).length,
      meeting: allTemplates.filter(t => t.category === 'meeting').length,
      personal: allTemplates.filter(t => t.category === 'personal').length,
      work: allTemplates.filter(t => t.category === 'work').length,
    };
  }, [templates, builtInTemplates]);

  // Handle template click
  const handleTemplateClick = (template: Template) => {
    console.log('🖱️ DEBUG: TemplatePage - Template clicked:', template.name);
    setSelectedTemplate(template);

    if (template.variables.length > 0) {
      // Initialize variables with built-in values
      const initialVariables: Record<string, string> = {};
      template.variables.forEach(variable => {
        initialVariables[variable] = getBuiltInVariableValue(variable);
      });
      setTemplateVariables(initialVariables);
      setShowVariableDialog(true);
    } else {
      // Apply template directly if no variables
      onTemplateSelect(template.id, {});
    }
  };

  // Handle variable change
  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Handle template application
  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      console.log('🚀 DEBUG: TemplatePage - Applying template:', selectedTemplate.name);
      console.log('📝 DEBUG: TemplatePage - Variables:', templateVariables);
      onTemplateSelect(selectedTemplate.id, templateVariables);
      setShowVariableDialog(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
    }
  };

  // Get built-in variable value
  const getBuiltInVariableValue = (variable: string): string => {
    const now = new Date();
    switch (variable) {
      case 'date':
        return now.toLocaleDateString();
      case 'time':
        return now.toLocaleTimeString();
      case 'datetime':
        return now.toLocaleString();
      case 'today':
        return now.toLocaleDateString();
      case 'tomorrow':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString();
      case 'yesterday':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString();
      case 'year':
        return now.getFullYear().toString();
      case 'month':
        return now.toLocaleDateString('en-US', { month: 'long' });
      case 'uuid':
        return crypto.randomUUID();
      default:
        return '';
    }
  };

  // Format template icon
  const formatTemplateIcon = (icon: string) => {
    const iconMap: Record<string, string> = {
      'users': '👥',
      'book': '📚',
      'book-open': '📖',
      'bug': '🐛',
      'folder': '📁',
      'briefcase': '💼',
      'check-circle': '✅',
      'user': '👤',
      'calendar': '📅',
      'star': '⭐',
      'heart': '❤️',
      'lightbulb': '💡',
      'rocket': '🚀',
      'target': '🎯',
      'clock': '🕐',
      'coffee': '☕',
    };

    return iconMap[icon] || '📝';
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="template-page">
        {/* Header */}
        <div className="template-page-header">
          <div className="template-header-content">
            <button onClick={onBack} className="back-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12,19 5,12 12,5"></polyline>
              </svg>
              Back to Edit Note
            </button>
            <h1 className="template-page-title">Choose Template</h1>
            {noteId && <span className="template-context">For note: {noteId.substring(0, 8)}...</span>}
          </div>
        </div>

        {/* Search Bar Skeleton */}
        <div className="template-search">
          <div className="search-input-container">
            <div className="skeleton skeleton-search" style={{ height: '40px', width: '100%', borderRadius: '8px' }}></div>
          </div>
        </div>

        {/* Category Navigation Skeleton */}
        <div className="template-category-nav">
          <div className="category-tabs">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton skeleton-category-tab" style={{ height: '44px', width: '100px', borderRadius: '12px' }}></div>
            ))}
          </div>
        </div>

        {/* Skeleton Cards */}
        <div className="template-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="template-skeleton-card">
              <div className="skeleton skeleton-icon"></div>
              <div className="skeleton skeleton-title"></div>
              <div className="skeleton skeleton-description"></div>
              <div className="skeleton skeleton-description"></div>
              <div className="skeleton-variables">
                <div className="skeleton skeleton-variable"></div>
                <div className="skeleton skeleton-variable"></div>
              </div>
              <div className="skeleton-meta">
                <div className="skeleton skeleton-category"></div>
                <div className="skeleton skeleton-usage"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="template-page">
        <div className="template-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>{error}</p>
          <button onClick={loadTemplates} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-page">
      {/* Header */}
      <div className="template-page-header">
        <div className="template-header-content">
          <button onClick={onBack} className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12,19 5,12 12,5"></polyline>
            </svg>
            Back to Edit Note
          </button>
          <h1 className="template-page-title">Choose Template</h1>
          {noteId && <span className="template-context">For note: {noteId.substring(0, 8)}...</span>}
        </div>
      </div>

      {/* Search Bar */}
      <div className="template-search">
        <div className="search-input-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Category Navigation */}
      <div className="template-category-nav">
        <div className="category-tabs">
          <button
            className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
            data-count={getCategoryCounts().all}
          >
            All Templates
          </button>
          <button
            className={`category-tab ${selectedCategory === 'built-in' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('built-in')}
            data-count={getCategoryCounts()['built-in']}
          >
            Built-in
          </button>
          <button
            className={`category-tab ${selectedCategory === 'meeting' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('meeting')}
            data-count={getCategoryCounts().meeting}
          >
            Meeting
          </button>
          <button
            className={`category-tab ${selectedCategory === 'personal' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('personal')}
            data-count={getCategoryCounts().personal}
          >
            Personal
          </button>
          <button
            className={`category-tab ${selectedCategory === 'work' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('work')}
            data-count={getCategoryCounts().work}
          >
            Work
          </button>
        </div>
      </div>

      {/* Template Gallery */}
      <div className="template-gallery">
        {filteredTemplates.length === 0 ? (
          <div className="template-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            <p>No templates found</p>
            {searchQuery && (
              <p>Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="template-grid">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => handleTemplateClick(template)}
              >
                <div className="template-icon">
                  {formatTemplateIcon(template.icon)}
                </div>
                <div className="template-info">
                  <h3 className="template-name">
                    {template.name}
                    {template.is_built_in && (
                      <span className="built-in-badge">Built-in</span>
                    )}
                  </h3>
                  <p className="template-description">{template.description}</p>
                  <div className="template-meta">
                    <span className="template-category">{template.category}</span>
                    <span className="template-usage">{template.usage_count} uses</span>
                  </div>
                  {template.variables.length > 0 && (
                    <div className="template-variables">
                      {template.variables.slice(0, 3).map(variable => (
                        <span key={variable} className="variable-tag">
                          {variable}
                        </span>
                      ))}
                      {template.variables.length > 3 && (
                        <span className="variable-more">
                          +{template.variables.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variable Dialog */}
      {showVariableDialog && selectedTemplate && (
        <div className="template-variable-dialog-overlay">
          <div className="template-variable-dialog">
            <div className="dialog-header">
              <h3>Apply Template: {selectedTemplate.name}</h3>
              <button
                onClick={() => setShowVariableDialog(false)}
                className="close-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="dialog-content">
              <p className="template-description">{selectedTemplate.description}</p>

              <div className="variables-section">
                <h4>Template Variables</h4>
                {selectedTemplate.variables.map(variable => (
                  <div key={variable} className="variable-field">
                    <label htmlFor={`var-${variable}`}>
                      {variable.charAt(0).toUpperCase() + variable.slice(1).replace(/_/g, ' ')}
                    </label>
                    <input
                      id={`var-${variable}`}
                      type="text"
                      value={templateVariables[variable] || getBuiltInVariableValue(variable)}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
                      className="variable-input"
                    />
                  </div>
                ))}
              </div>

              <div className="template-preview">
                <h4>Preview</h4>
                <div className="preview-content">
                  {selectedTemplate.variables.reduce((content, variable) => {
                    const value = templateVariables[variable] || getBuiltInVariableValue(variable) || `{{${variable}}}`;
                    return content.replace(new RegExp(`{{${variable}}}`, 'g'), value);
                  }, selectedTemplate.content).split('\n').slice(0, 10).join('\n')}
                  {selectedTemplate.content.split('\n').length > 10 && '\n...'}
                </div>
              </div>
            </div>

            <div className="dialog-actions">
              <button
                onClick={() => setShowVariableDialog(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTemplate}
                className="apply-btn"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatePage;