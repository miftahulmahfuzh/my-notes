import React, { useState, useEffect, useCallback } from 'react';

interface TemplateEditorProps {
  template?: any;
  onSave: (template: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  variables: string[];
  is_public: boolean;
  icon: string;
  tags: string[];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<Template>({
    id: template?.id || '',
    name: template?.name || '',
    description: template?.description || '',
    content: template?.content || '',
    category: template?.category || 'personal',
    variables: template?.variables || [],
    is_public: template?.is_public || false,
    icon: template?.icon || 'document',
    tags: template?.tags || []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Available icons
  const availableIcons = [
    { value: 'document', label: 'Document', emoji: '📄' },
    { value: 'book', label: 'Book', emoji: '📚' },
    { value: 'book-open', label: 'Book Open', emoji: '📖' },
    { value: 'users', label: 'Users', emoji: '👥' },
    { value: 'briefcase', label: 'Briefcase', emoji: '💼' },
    { value: 'folder', label: 'Folder', emoji: '📁' },
    { value: 'bug', label: 'Bug', emoji: '🐛' },
    { value: 'check-circle', label: 'Check', emoji: '✅' },
    { value: 'star', label: 'Star', emoji: '⭐' },
    { value: 'heart', label: 'Heart', emoji: '❤️' },
    { value: 'lightbulb', label: 'Lightbulb', emoji: '💡' },
    { value: 'rocket', label: 'Rocket', emoji: '🚀' },
    { value: 'target', label: 'Target', emoji: '🎯' },
    { value: 'calendar', label: 'Calendar', emoji: '📅' },
    { value: 'clock', label: 'Clock', emoji: '🕐' },
    { value: 'coffee', label: 'Coffee', emoji: '☕' },
    { value: 'message', label: 'Message', emoji: '💬' },
    { value: 'phone', label: 'Phone', emoji: '📞' },
    { value: 'email', label: 'Email', emoji: '📧' }
  ];

  // Available categories
  const availableCategories = [
    'personal',
    'work',
    'meeting',
    'project',
    'productivity',
    'creativity',
    'learning',
    'health',
    'finance',
    'travel'
  ];

  // Extract variables from template content
  const extractVariables = useCallback((content: string): string[] => {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1].trim();
      if (!varName.startsWith('date') && !varName.startsWith('time') && !varName.startsWith('user')) {
        variables.add(varName);
      }
    }

    return Array.from(variables);
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Template content is required';
    }

    if (formData.content.length > 50000) {
      newErrors.content = 'Content too long (max 50,000 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form input changes
  const handleInputChange = (field: keyof Template, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Extract variables when content changes
    if (field === 'content') {
      const variables = extractVariables(value);
      setFormData(prev => ({ ...prev, variables }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrors({ submit: 'Failed to save template. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Add tag
  const addTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      handleInputChange('tags', [...formData.tags, trimmedTag]);
      setNewTag('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  // Handle Enter key in tag input
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Generate template preview
  const generatePreview = (): string => {
    let preview = formData.content;

    // Replace variables with placeholder values
    const variables = extractVariables(preview);
    variables.forEach(variable => {
      const placeholder = variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      preview = preview.replace(new RegExp(`{{${variable}}}`, 'g'), placeholder);
    });

    // Replace built-in variables
    const now = new Date();
    preview = preview.replace(/\{\{date\}\}/g, now.toLocaleDateString());
    preview = preview.replace(/\{\{time\}\}/g, now.toLocaleTimeString());
    preview = preview.replace(/\{\{datetime\}\}/g, now.toLocaleString());

    return preview;
  };

  return (
    <div className="template-editor">
      <div className="editor-header">
        <h3>{template ? 'Edit Template' : 'Create New Template'}</h3>
        <div className="header-actions">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`preview-btn ${showPreview ? 'active' : ''}`}
            title="Toggle preview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Preview
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || loading}
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

      <form onSubmit={handleSubmit} className="template-form">
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="name">Template Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Enter template name"
              maxLength={100}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="form-input"
              placeholder="Brief description of the template"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="form-select"
            >
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="icon">Icon</label>
            <select
              id="icon"
              value={formData.icon}
              onChange={(e) => handleInputChange('icon', e.target.value)}
              className="form-select"
            >
              {availableIcons.map(icon => (
                <option key={icon.value} value={icon.value}>
                  {icon.emoji} {icon.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="content">Template Content *</label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            className={`form-textarea ${errors.content ? 'error' : ''}`}
            placeholder="Enter template content with variables like {{variable_name}}"
            rows={12}
            maxLength={50000}
          />
          {errors.content && <span className="error-message">{errors.content}</span>}
          <div className="content-footer">
            <span className="char-count">{formData.content.length}/50,000</span>
            {formData.variables.length > 0 && (
              <span className="variables-count">
                {formData.variables.length} variable{formData.variables.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {formData.variables.length > 0 && (
          <div className="form-group">
            <label>Detected Variables</label>
            <div className="variables-list">
              {formData.variables.map(variable => (
                <span key={variable} className="variable-tag">
                  {variable}
                </span>
              ))}
            </div>
            <p className="variables-help">
              These variables will be available for customization when applying the template.
            </p>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="tags">Tags</label>
          <div className="tags-input-container">
            <div className="tags-list">
              {formData.tags.map(tag => (
                <span key={tag} className="tag">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="tag-remove"
                    title="Remove tag"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="Add a tag..."
              className="tag-input"
            />
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.is_public}
              onChange={(e) => handleInputChange('is_public', e.target.checked)}
            />
            <span>Share this template with other users</span>
          </label>
        </div>

        {errors.submit && (
          <div className="form-error">
            {errors.submit}
          </div>
        )}
      </form>

      {showPreview && (
        <div className="template-preview">
          <h4>Template Preview</h4>
          <div className="preview-content">
            {generatePreview() || 'No content to preview'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateEditor;