import React, { useState, useEffect, useCallback } from 'react';
import { Template } from '../types';

interface TemplateSelectorProps {
  onTemplateSelect: (templateId: string, variables?: Record<string, string>) => void;
  onClose: () => void;
  categories?: string[];
  initialCategory?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  variables: string[];
  is_built_in: boolean;
  usage_count: number;
  icon: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onTemplateSelect,
  onClose,
  categories = [],
  initialCategory = 'all'
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [builtInTemplates, setBuiltInTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load user templates
      const userResponse = await fetch('/api/v1/templates', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setTemplates(userData.data || []);
      }

      // Load built-in templates
      const builtInResponse = await fetch('/api/v1/templates/built-in', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (builtInResponse.ok) {
        const builtInData = await builtInResponse.json();
        setBuiltInTemplates(builtInData.data || []);
      }
    } catch (err) {
      setError('Failed to load templates');
      console.error('Error loading templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates based on category and search
  const filteredTemplates = React.useMemo(() => {
    let allTemplates = [...templates];

    if (selectedCategory === 'all' || selectedCategory === 'built-in') {
      if (selectedCategory === 'built-in') {
        allTemplates = builtInTemplates;
      } else {
        allTemplates = [...templates, ...builtInTemplates];
      }
    } else {
      allTemplates = [
        ...templates.filter(t => t.category === selectedCategory),
        ...builtInTemplates.filter(t => t.category === selectedCategory)
      ];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allTemplates = allTemplates.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return allTemplates.sort((a, b) => {
      // Sort by usage count and built-in status
      if (a.is_built_in && !b.is_built_in) return -1;
      if (!a.is_built_in && b.is_built_in) return 1;
      return b.usage_count - a.usage_count;
    });
  }, [templates, builtInTemplates, selectedCategory, searchQuery]);

  const handleTemplateClick = (template: Template) => {
    if (template.variables.length > 0) {
      setSelectedTemplate(template);
      setShowVariableDialog(true);
    } else {
      onTemplateSelect(template.id);
      onClose();
    }
  };

  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate.id, templateVariables);
      setShowVariableDialog(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
      onClose();
    }
  };

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

  const getAuthToken = (): string => {
    // Get auth token from storage
    return localStorage.getItem('authToken') || '';
  };

  if (showVariableDialog && selectedTemplate) {
    return (
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
    );
  }

  return (
    <div className="template-selector-overlay">
      <div className="template-selector-modal">
        <div className="selector-header">
          <h3>Choose Template</h3>
          <button
            onClick={onClose}
            className="close-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="selector-controls">
          <div className="category-tabs">
            <button
              className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Templates
            </button>
            <button
              className={`category-tab ${selectedCategory === 'built-in' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('built-in')}
            >
              Built-in
            </button>
            {categories.map(category => (
              <button
                key={category}
                className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
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
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="selector-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading templates...</p>
            </div>
          ) : error ? (
            <div className="error-state">
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
          ) : filteredTemplates.length === 0 ? (
            <div className="empty-state">
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
            <div className="templates-grid">
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
                    <h4 className="template-name">
                      {template.name}
                      {template.is_built_in && (
                        <span className="built-in-badge">Built-in</span>
                      )}
                    </h4>
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

        <div className="selector-footer">
          <div className="footer-info">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;