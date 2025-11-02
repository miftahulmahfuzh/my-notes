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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Enhanced preview state management
  const [previewMode, setPreviewMode] = useState<'simple' | 'detailed' | 'diff'>('simple');
  const [showValidation, setShowValidation] = useState(true);
  const [highlightMissing, setHighlightMissing] = useState(true);
  const [autoRefreshPreview, setAutoRefreshPreview] = useState(true);
  const [previewStatistics, setPreviewStatistics] = useState<ReturnType<typeof getPreviewStatistics> | null>(null);
  const [previewValidation, setPreviewValidation] = useState<ReturnType<typeof validateTemplateVariables> | null>(null);
  const [previewDiff, setPreviewDiff] = useState<ReturnType<typeof generatePreviewDiff> | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

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

      console.log('TemplatePage: Loading templates...');

      // Load user templates
      const userResponse = await fetch(`${CONFIG.API_BASE_URL}/templates`, {
        headers: authHeaders,
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
                // Backend returns {success: true, data: Array(2), total: 2}
        // So we need userData.data.data to get the actual array
        const templates = Array.isArray(userData?.data?.data) ? userData.data.data : [];

        console.log('✅ TemplatePage - Loaded user templates:', {
          count: templates.length,
          templateIds: templates.map((t: Template) => ({ id: t.id, name: t.name }))
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
        console.log('🏗️ DEBUG: TemplatePage - Setting built-in templates:', {
          count: builtInTemplates.length,
          templateIds: builtInTemplates.map((t: Template) => ({ id: t.id, name: t.name }))
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

  
  // Handle search on Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && searchQuery.trim() && searchInputRef.current === document.activeElement) {
        addToSearchHistory(searchQuery);
        setShowSuggestions(false);
      }
      if (e.key === 'Escape' && searchInputRef.current === document.activeElement) {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchQuery]);

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

    // Apply advanced search
    if (debouncedSearchQuery) {
      const beforeSearch = allTemplates.length;
      allTemplates = advancedSearch(allTemplates, debouncedSearchQuery);
      console.log('🔍 DEBUG: TemplatePage - After advanced search filter:', {
        query: debouncedSearchQuery,
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
  }, [templates, builtInTemplates, selectedCategory, debouncedSearchQuery]);

  // Calculate category counts for display
  const getCategoryCounts = useCallback(() => {
    const allTemplates = [...(Array.isArray(templates) ? templates : []), ...(Array.isArray(builtInTemplates) ? builtInTemplates : [])];

    console.log('🔗 DEBUG: TemplatePage - Combining templates for category counts:', {
      userTemplatesCount: templates.length,
      builtInTemplatesCount: builtInTemplates.length,
      totalCombined: allTemplates.length,
      allTemplateIds: allTemplates.map((t: Template) => ({ id: t.id, name: t.name, source: t.is_built_in ? 'built-in' : 'user' })),
      duplicatesByName: allTemplates.filter((t, index, arr) => arr.findIndex(x => x.name === t.name) !== index)
    });

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
    setShowDetailsModal(true);
  };

  
  // Handle applying template from details modal
  const handleApplyFromDetails = () => {
    if (selectedTemplate) {
      console.log('🚀 DEBUG: TemplatePage - Applying template from details:', selectedTemplate.name);

      if (selectedTemplate.variables.length > 0) {
        // Initialize variables with built-in values
        const initialVariables: Record<string, string> = {};
        selectedTemplate.variables.forEach(variable => {
          initialVariables[variable] = getBuiltInVariableValue(variable);
        });
        setTemplateVariables(initialVariables);

        // Initialize preview data
        updatePreviewData(selectedTemplate, initialVariables);

        setShowDetailsModal(false);
        setShowVariableDialog(true);
      } else {
        // Apply template directly if no variables
        onTemplateSelect(selectedTemplate.id, {});
        setShowDetailsModal(false);
      }
    }
  };

  // Handle variable change
  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));

    // Auto-refresh preview if enabled
    if (autoRefreshPreview && selectedTemplate) {
      updatePreviewData(selectedTemplate, {
        ...templateVariables,
        [variable]: value
      });
    }
  };

  // Update all preview data when variables or template changes
  const updatePreviewData = useCallback((
    template: Template,
    variables: Record<string, string>
  ) => {
    console.log('🔄 DEBUG: TemplatePage - Updating preview data for:', template.name);

    // Generate preview content
    const previewResult = generatePreviewContent(template, variables, {
      highlightMissing,
      includeValidation: showValidation,
      maxLines: previewMode === 'simple' ? 15 : Infinity
    });
    setPreviewContent(previewResult.content);

    // Generate validation results
    if (showValidation) {
      const validation = validateTemplateVariables(template, variables);
      setPreviewValidation(validation);
    }

    // Generate statistics
    const stats = getPreviewStatistics(template, previewResult.content, variables);
    setPreviewStatistics(stats);

    // Generate diff if in diff mode
    if (previewMode === 'diff') {
      const diff = generatePreviewDiff(template.content, previewResult.content, variables);
      setPreviewDiff(diff);
    }
  }, [highlightMissing, showValidation, previewMode, autoRefreshPreview]);

  // Handle preview mode change
  const handlePreviewModeChange = (mode: 'simple' | 'detailed' | 'diff') => {
    setPreviewMode(mode);
    if (selectedTemplate) {
      updatePreviewData(selectedTemplate, templateVariables);
    }
  };

  // Handle validation toggle
  const handleValidationToggle = () => {
    setShowValidation(prev => !prev);
    if (selectedTemplate) {
      updatePreviewData(selectedTemplate, templateVariables);
    }
  };

  // Handle highlight missing toggle
  const handleHighlightMissingToggle = () => {
    setHighlightMissing(prev => !prev);
    if (selectedTemplate) {
      updatePreviewData(selectedTemplate, templateVariables);
    }
  };

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    setAutoRefreshPreview(prev => !prev);
    if (!autoRefreshPreview && selectedTemplate) {
      // Manual refresh when disabling auto-refresh
      updatePreviewData(selectedTemplate, templateVariables);
    }
  };

  // Manual refresh function
  const refreshPreview = () => {
    if (selectedTemplate) {
      updatePreviewData(selectedTemplate, templateVariables);
    }
  };

  // Helper function to determine variable type
  const getVariableType = (variable: string): string => {
    if (variable.includes('date') || variable.includes('time')) return 'Date/Time';
    if (variable.includes('email')) return 'Email';
    if (variable.includes('url')) return 'URL';
    if (variable.includes('phone')) return 'Phone';
    if (variable.includes('title') || variable.includes('description')) return 'Text';
    if (variable.includes('priority') || variable.includes('status')) return 'Status';
    return 'String';
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

  // Get description for template variables
  const getVariableDescription = (variable: string): string => {
    switch (variable) {
      case 'date':
        return 'Current date in local format';
      case 'time':
        return 'Current time in local format';
      case 'datetime':
        return 'Current date and time in local format';
      case 'today':
        return 'Today\'s date';
      case 'tomorrow':
        return 'Tomorrow\'s date';
      case 'yesterday':
        return 'Yesterday\'s date';
      case 'year':
        return 'Current year (4-digit)';
      case 'month':
        return 'Current month name';
      case 'uuid':
        return 'Random unique identifier';
      case 'title':
        return 'Note title or subject';
      case 'author':
        return 'Author name or creator';
      case 'description':
        return 'Brief description or summary';
      case 'tags':
        return 'Comma-separated tags';
      case 'priority':
        return 'Priority level (high, medium, low)';
      case 'status':
        return 'Current status or progress';
      case 'deadline':
        return 'Due date or deadline';
      case 'category':
        return 'Category or type classification';
      case 'project':
        return 'Project name or identifier';
      case 'client':
        return 'Client name or organization';
      case 'location':
        return 'Location or venue';
      case 'attendees':
        return 'List of attendees or participants';
      case 'agenda':
        return 'Meeting agenda or topics';
      case 'notes':
        return 'Additional notes or comments';
      case 'url':
        return 'Website or resource link';
      case 'email':
        return 'Email address';
      case 'phone':
        return 'Phone number';
      case 'company':
        return 'Company or organization name';
      default:
        return `Custom variable: ${variable.replace(/_/g, ' ')}`;
    }
  };

  // ===== ADVANCED TEMPLATE PREVIEW SYSTEM =====

  // Preview content with variable substitution
  const generatePreviewContent = (
    template: Template,
    variables: Record<string, string>,
    options: {
      highlightMissing?: boolean;
      includeValidation?: boolean;
      maxLines?: number;
    } = {}
  ): {
    content: string;
    hasMissingVariables: boolean;
    missingVariables: string[];
    lineCount: number;
    validation: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
    };
  } => {
    const {
      highlightMissing = true,
      includeValidation = true,
      maxLines = Infinity
    } = options;

    let processedContent = template.content;
    const missingVariables: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Process each variable in the template
    template.variables.forEach(variable => {
      const variablePattern = new RegExp(`{{${variable}}}`, 'g');
      const variableValue = variables[variable] || getBuiltInVariableValue(variable);

      if (variableValue) {
        // Replace variable with value
        processedContent = processedContent.replace(variablePattern, variableValue);
      } else {
        // Variable is missing
        missingVariables.push(variable);
        if (highlightMissing) {
          processedContent = processedContent.replace(variablePattern, `⚠️{{${variable}}}⚠️`);
        }
        errors.push(`Missing value for variable: {{${variable}}}`);
      }
    });

    // Check for any remaining unmatched variables
    const unmatchedVariablePattern = /{{([^}]+)}}/g;
    let match;
    while ((match = unmatchedVariablePattern.exec(processedContent)) !== null) {
      const unmatchedVar = match[1];
      if (!template.variables.includes(unmatchedVar)) {
        warnings.push(`Unknown variable found: {{${unmatchedVar}}}`);
        if (highlightMissing) {
          processedContent = processedContent.replace(
            new RegExp(`{{${unmatchedVar}}}`, 'g'),
            `❓{{${unmatchedVar}}}❓`
          );
        }
      }
    }

    // Limit lines if specified
    const lines = processedContent.split('\n');
    const truncatedContent = lines.slice(0, maxLines).join('\n');
    const wasTruncated = lines.length > maxLines;

    if (wasTruncated) {
      warnings.push(`Preview truncated to ${maxLines} lines (original: ${lines.length} lines)`);
    }

    return {
      content: wasTruncated ? truncatedContent + '\n\n... (content truncated)' : truncatedContent,
      hasMissingVariables: missingVariables.length > 0,
      missingVariables,
      lineCount: lines.length,
      validation: {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    };
  };

  // Generate diff view between original and processed content
  const generatePreviewDiff = (
    originalContent: string,
    processedContent: string,
    variables: Record<string, string>
  ): {
    additions: string[];
    modifications: Array<{ original: string; modified: string }>;
    unchanged: string[];
    summary: {
      totalLines: number;
      changedLines: number;
      addedLines: number;
      modifiedLines: number;
    };
  } => {
    const originalLines = originalContent.split('\n');
    const processedLines = processedContent.split('\n');

    const additions: string[] = [];
    const modifications: Array<{ original: string; modified: string }> = [];
    const unchanged: string[] = [];

    const maxLines = Math.max(originalLines.length, processedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const processedLine = processedLines[i] || '';

      if (originalLine === processedLine) {
        if (originalLine.trim() !== '') {
          unchanged.push(originalLine);
        }
      } else if (!originalLine && processedLine) {
        additions.push(processedLine);
      } else if (originalLine && !processedLine) {
        // Line was removed
        modifications.push({ original: originalLine, modified: '[REMOVED]' });
      } else {
        // Line was modified
        modifications.push({ original: originalLine, modified: processedLine });
      }
    }

    return {
      additions,
      modifications,
      unchanged,
      summary: {
        totalLines: maxLines,
        changedLines: additions.length + modifications.length,
        addedLines: additions.length,
        modifiedLines: modifications.length
      }
    };
  };

  // Validate template variables
  const validateTemplateVariables = (
    template: Template,
    variables: Record<string, string>
  ): {
    isValid: boolean;
    errors: Array<{
      variable: string;
      type: 'missing' | 'invalid_format' | 'empty';
      message: string;
    }>;
    warnings: Array<{
      variable: string;
      type: 'suggestion' | 'format_tip';
      message: string;
    }>;
  } => {
    const errors: Array<{
      variable: string;
      type: 'missing' | 'invalid_format' | 'empty';
      message: string;
    }> = [];
    const warnings: Array<{
      variable: string;
      type: 'suggestion' | 'format_tip';
      message: string;
    }> = [];

    template.variables.forEach(variable => {
      const value = variables[variable] || getBuiltInVariableValue(variable);

      // Check for missing required variables
      if (!value || value.trim() === '') {
        errors.push({
          variable,
          type: 'missing',
          message: `Variable {{${variable}}} is required but no value was provided`
        });
        return;
      }

      // Variable-specific validations
      if (variable.includes('email') && !value.includes('@')) {
        errors.push({
          variable,
          type: 'invalid_format',
          message: `Email format appears invalid for {{${variable}}}`
        });
      }

      if (variable.includes('date') || variable.includes('time')) {
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          warnings.push({
            variable,
            type: 'format_tip',
            message: `Date format might be invalid for {{${variable}}}`
          });
        }
      }

      if (variable.includes('url') && !value.startsWith('http')) {
        warnings.push({
          variable,
          type: 'suggestion',
          message: `URL should typically start with http:// or https:// for {{${variable}}}`
        });
      }

      if (variable.includes('phone') && !/^[\d\s\-\+\(\)]+$/.test(value)) {
        warnings.push({
          variable,
          type: 'format_tip',
          message: `Phone number format might be invalid for {{${variable}}}`
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  // Get preview statistics
  const getPreviewStatistics = (
    template: Template,
    processedContent: string,
    variables: Record<string, string>
  ): {
    characterCount: number;
    wordCount: number;
    lineCount: number;
    variableCount: number;
    substitutedVariableCount: number;
    estimatedReadTime: number; // in minutes
  } => {
    const characterCount = processedContent.length;
    const wordCount = processedContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const lineCount = processedContent.split('\n').length;
    const variableCount = template.variables.length;
    const substitutedVariableCount = template.variables.filter(v =>
      variables[v] || getBuiltInVariableValue(v)
    ).length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words/minute

    return {
      characterCount,
      wordCount,
      lineCount,
      variableCount,
      substitutedVariableCount,
      estimatedReadTime
    };
  };

  // Enhanced search functionality
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearching(value.trim().length > 0);

    // Generate search suggestions
    if (value.trim().length > 0) {
      generateSearchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Generate search suggestions from templates
  const generateSearchSuggestions = (query: string) => {
    const allTemplates = [...(Array.isArray(templates) ? templates : []), ...(Array.isArray(builtInTemplates) ? builtInTemplates : [])];
    const queryLower = query.toLowerCase();

    console.log('🔍 DEBUG: TemplatePage - Generating search suggestions:', {
      query,
      userTemplatesCount: templates.length,
      builtInTemplatesCount: builtInTemplates.length,
      totalCombined: allTemplates.length,
      allTemplateIds: allTemplates.map((t: Template) => ({ id: t.id, name: t.name, source: t.is_built_in ? 'built-in' : 'user' })),
      duplicatesByName: allTemplates.filter((t, index, arr) => arr.findIndex(x => x.name === t.name) !== index)
    });

    const suggestions = new Set<string>();

    // Add matching template names
    allTemplates.forEach(template => {
      if (template.name.toLowerCase().includes(queryLower)) {
        suggestions.add(template.name);
      }
    });

    // Add matching categories
    const categories = [...new Set(allTemplates.map(t => t.category))];
    categories.forEach(category => {
      if (category.toLowerCase().includes(queryLower)) {
        suggestions.add(category);
      }
    });

    // Add matching tags
    const tags = [...new Set(allTemplates.flatMap(t => t.tags))];
    tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        suggestions.add(tag);
      }
    });

    setSearchSuggestions(Array.from(suggestions).slice(0, 8));
  };

  // Handle search suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    addToSearchHistory(suggestion);

    // Focus search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Add to search history
  const addToSearchHistory = (query: string) => {
    if (!query.trim()) return;

    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);

    // Save to localStorage
    try {
      localStorage.setItem('template-search-history', JSON.stringify(newHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  };

  // Load search history from localStorage
  const loadSearchHistory = useCallback(() => {
    try {
      const saved = localStorage.getItem('template-search-history');
      if (saved) {
        const history = JSON.parse(saved);
        if (Array.isArray(history)) {
          setSearchHistory(history);
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
    loadSearchHistory();
  }, [loadTemplates, loadSearchHistory]);

  // Debug: Monitor template state changes
  useEffect(() => {
    console.log('🔄 DEBUG: TemplatePage - Template state changed:', {
      userTemplatesCount: templates.length,
      builtInTemplatesCount: builtInTemplates.length,
      userTemplateIds: templates.map((t: Template) => ({ id: t.id, name: t.name })),
      builtInTemplateIds: builtInTemplates.map((t: Template) => ({ id: t.id, name: t.name })),
      totalCombined: templates.length + builtInTemplates.length,
      potentialDuplicates: [...templates, ...builtInTemplates].filter((t, index, arr) => arr.findIndex(x => x.name === t.name) !== index)
    });
  }, [templates, builtInTemplates]);

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchQuery.trim().length === 0 && searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle search input blur
  const handleSearchBlur = () => {
    // Delay hiding suggestions to allow click on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setShowSuggestions(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
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

      {/* Enhanced Search Bar */}
      <div className="template-search">
        <div className="search-input-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search templates by name, category, or tags..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className={`search-input ${isSearching ? 'searching' : ''}`}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="search-clear-btn"
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (
          <div className="search-suggestions">
            <div className="suggestions-header">
              <span>Search Suggestions</span>
            </div>
            {searchSuggestions.length > 0 ? (
              <div className="suggestions-list">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="suggestion-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            ) : searchHistory.length > 0 ? (
              <div className="suggestions-list">
                <div className="suggestions-section-title">Recent Searches</div>
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(item)}
                    className="suggestion-item history-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 7H7"></path>
                      <path d="M17 17H7"></path>
                    </svg>
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="suggestions-empty">
                <span>No suggestions available</span>
              </div>
            )}
          </div>
        )}
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
            {(() => {
              console.log('🎨 DEBUG: TemplatePage - Rendering filtered templates:', {
                filteredCount: filteredTemplates.length,
                searchQuery,
                selectedCategory,
                filteredTemplateIds: filteredTemplates.map((t: Template) => ({ id: t.id, name: t.name, source: t.is_built_in ? 'built-in' : 'user' })),
                duplicatesByName: filteredTemplates.filter((t, index, arr) => arr.findIndex(x => x.name === t.name) !== index),
                renderKeys: filteredTemplates.map(t => t.id)
              });
              return null;
            })()}
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

      {/* Template Details Modal */}
      {showDetailsModal && selectedTemplate && (
        <div className="template-details-overlay">
          <div className="template-details-modal">
            {/* Modal Header */}
            <div className="details-header">
              <div className="details-header-content">
                <div className="details-icon">
                  {formatTemplateIcon(selectedTemplate.icon)}
                </div>
                <div className="details-title-section">
                  <h2 className="details-title">
                    {selectedTemplate.name}
                    {selectedTemplate.is_built_in && (
                      <span className="built-in-badge">Built-in</span>
                    )}
                  </h2>
                  <div className="details-meta">
                    <span className="details-category">{selectedTemplate.category}</span>
                    <span className="details-usage">{selectedTemplate.usage_count} uses</span>
                    <span className="details-date">
                      Created: {new Date(selectedTemplate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="details-close-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="details-content">
              {/* Description Section */}
              <div className="details-section">
                <h3 className="details-section-title">Description</h3>
                <p className="details-description">{selectedTemplate.description}</p>
              </div>

              {/* Tags Section */}
              {selectedTemplate.tags.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">Tags</h3>
                  <div className="details-tags">
                    {selectedTemplate.tags.map(tag => (
                      <span key={tag} className="details-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variables Section */}
              {selectedTemplate.variables.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">Template Variables</h3>
                  <div className="details-variables">
                    {selectedTemplate.variables.map(variable => (
                      <div key={variable} className="details-variable">
                        <div className="variable-info">
                          <span className="variable-name">
                            {`{{${variable}}}`}
                          </span>
                          <span className="variable-description">
                            {getVariableDescription(variable)}
                          </span>
                        </div>
                        <div className="variable-example">
                          Example: {getBuiltInVariableValue(variable) || `[${variable.replace(/_/g, ' ')}]`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Template Content Preview */}
              <div className="details-section">
                <h3 className="details-section-title">Template Content</h3>
                <div className="details-content-preview">
                  <div className="content-preview">
                    {selectedTemplate.content.split('\n').map((line, index) => (
                      <div key={index} className="preview-line">
                        <span className="line-number">{index + 1}</span>
                        <span className="line-content">{line || '\u00A0'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="details-section">
                <h3 className="details-section-title">Statistics</h3>
                <div className="details-stats">
                  <div className="stat-item">
                    <span className="stat-label">Content Length</span>
                    <span className="stat-value">{selectedTemplate.content.length} characters</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Line Count</span>
                    <span className="stat-value">{selectedTemplate.content.split('\n').length} lines</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Variables</span>
                    <span className="stat-value">{selectedTemplate.variables.length} variables</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Tags</span>
                    <span className="stat-value">{selectedTemplate.tags.length} tags</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="details-actions">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="details-cancel-btn"
              >
                Close
              </button>
              <button
                onClick={handleApplyFromDetails}
                className="details-apply-btn"
              >
                {selectedTemplate.variables.length > 0 ? 'Configure & Apply' : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Variable Dialog with Advanced Preview */}
      {showVariableDialog && selectedTemplate && (
        <div className="enhanced-variable-dialog-overlay">
          <div className="enhanced-variable-dialog">
            {/* Dialog Header */}
            <div className="enhanced-dialog-header">
              <div className="header-content">
                <div className="template-icon-large">
                  {formatTemplateIcon(selectedTemplate.icon)}
                </div>
                <div className="header-text">
                  <h3 className="dialog-title">Apply Template: {selectedTemplate.name}</h3>
                  <p className="dialog-subtitle">{selectedTemplate.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowVariableDialog(false)}
                className="enhanced-close-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="enhanced-dialog-content">
              {/* Variables Section */}
              <div className="variables-section">
                <div className="section-header">
                  <h4 className="section-title">Template Variables</h4>
                  <div className="variable-count-badge">
                    {selectedTemplate.variables.length} variables
                  </div>
                </div>

                <div className="variables-grid">
                  {selectedTemplate.variables.map(variable => (
                    <div key={variable} className="enhanced-variable-field">
                      <div className="variable-header">
                        <label htmlFor={`var-${variable}`} className="variable-label">
                          <span className="variable-name">
                            {`{${variable}}`}
                          </span>
                          <span className="variable-display-name">
                            {variable.charAt(0).toUpperCase() + variable.slice(1).replace(/_/g, ' ')}
                          </span>
                        </label>
                        <div className="variable-type">
                          {getVariableType(variable)}
                        </div>
                      </div>
                      <input
                        id={`var-${variable}`}
                        type="text"
                        value={templateVariables[variable] || getBuiltInVariableValue(variable)}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
                        className="enhanced-variable-input"
                      />
                      <div className="variable-hint">
                        {getVariableDescription(variable)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Preview Section */}
              <div className="enhanced-preview-section">
                <div className="preview-header">
                  <h4 className="preview-title">Live Preview</h4>
                  <div className="preview-controls">
                    <div className="preview-mode-tabs">
                      <button
                        className={`mode-tab ${previewMode === 'simple' ? 'active' : ''}`}
                        onClick={() => handlePreviewModeChange('simple')}
                      >
                        Simple
                      </button>
                      <button
                        className={`mode-tab ${previewMode === 'detailed' ? 'active' : ''}`}
                        onClick={() => handlePreviewModeChange('detailed')}
                      >
                        Detailed
                      </button>
                      <button
                        className={`mode-tab ${previewMode === 'diff' ? 'active' : ''}`}
                        onClick={() => handlePreviewModeChange('diff')}
                      >
                        Diff
                      </button>
                    </div>
                    <div className="preview-options">
                      <button
                        className={`option-toggle ${showValidation ? 'active' : ''}`}
                        onClick={handleValidationToggle}
                        title="Toggle validation"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 11l3 3L22 4"></path>
                          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                        </svg>
                      </button>
                      <button
                        className={`option-toggle ${highlightMissing ? 'active' : ''}`}
                        onClick={handleHighlightMissingToggle}
                        title="Toggle highlight missing variables"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"></circle>
                          <path d="m21 21-4.35-4.35"></path>
                        </svg>
                      </button>
                      <button
                        className={`option-toggle ${autoRefreshPreview ? 'active' : ''}`}
                        onClick={handleAutoRefreshToggle}
                        title="Toggle auto-refresh"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 4v6h6"></path>
                          <path d="M23 20v-6h-6"></path>
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                        </svg>
                      </button>
                      <button
                        onClick={refreshPreview}
                        className="refresh-btn"
                        title="Refresh preview"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6"></path>
                          <path d="M1 20v-6h6"></path>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Content Based on Mode */}
                <div className="preview-content-wrapper">
                  {previewMode === 'simple' && (
                    <div className="simple-preview">
                      <div className="preview-textarea">
                        {previewContent.split('\n').map((line, index) => (
                          <div key={index} className="preview-line">
                            <span className="line-number">{index + 1}</span>
                            <span className="line-content">{line || '\u00A0'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewMode === 'detailed' && (
                    <div className="detailed-preview">
                      <div className="preview-content">
                        {previewContent.split('\n').map((line, index) => (
                          <div key={index} className="preview-line">
                            <span className="line-number">{index + 1}</span>
                            <span className="line-content">{line || '\u00A0'}</span>
                          </div>
                        ))}
                      </div>

                      {/* Statistics Panel */}
                      {previewStatistics && (
                        <div className="preview-stats-panel">
                          <h5>Statistics</h5>
                          <div className="stats-grid">
                            <div className="stat-item">
                              <span className="stat-label">Characters</span>
                              <span className="stat-value">{previewStatistics.characterCount}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Words</span>
                              <span className="stat-value">{previewStatistics.wordCount}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Lines</span>
                              <span className="stat-value">{previewStatistics.lineCount}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Variables</span>
                              <span className="stat-value">{previewStatistics.substitutedVariableCount}/{previewStatistics.variableCount}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Read Time</span>
                              <span className="stat-value">{previewStatistics.estimatedReadTime} min</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {previewMode === 'diff' && previewDiff && (
                    <div className="diff-preview">
                      <div className="diff-summary">
                        <div className="diff-stats">
                          <span className="diff-stat">
                            Total: {previewDiff.summary.totalLines} lines
                          </span>
                          <span className="diff-stat added">
                            +{previewDiff.summary.addedLines} added
                          </span>
                          <span className="diff-stat modified">
                            ~{previewDiff.summary.modifiedLines} modified
                          </span>
                        </div>
                      </div>

                      <div className="diff-content">
                        {previewDiff.modifications.map((mod, index) => (
                          <div key={index} className="diff-modification">
                            <div className="diff-original">- {mod.original}</div>
                            <div className="diff-modified">+ {mod.modified}</div>
                          </div>
                        ))}
                        {previewDiff.additions.map((addition, index) => (
                          <div key={index} className="diff-addition">
                            <div className="diff-added">+ {addition}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Panel */}
                {showValidation && previewValidation && (
                  <div className="validation-panel">
                    <div className={`validation-status ${previewValidation.isValid ? 'valid' : 'invalid'}`}>
                      <div className="status-icon">
                        {previewValidation.isValid ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5"></path>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                          </svg>
                        )}
                      </div>
                      <span className="status-text">
                        {previewValidation.isValid ? 'All variables configured correctly' : `${previewValidation.errors.length} issues found`}
                      </span>
                    </div>

                    {previewValidation.errors.length > 0 && (
                      <div className="validation-errors">
                        <h5>Errors</h5>
                        {previewValidation.errors.map((error, index) => (
                          <div key={index} className="validation-error">
                            <span className="error-variable">{`{${error.variable}}`}</span>
                            <span className="error-message">{error.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {previewValidation.warnings.length > 0 && (
                      <div className="validation-warnings">
                        <h5>Suggestions</h5>
                        {previewValidation.warnings.map((warning, index) => (
                          <div key={index} className="validation-warning">
                            <span className="warning-variable">{`{${warning.variable}}`}</span>
                            <span className="warning-message">{warning.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Dialog Actions */}
            <div className="enhanced-dialog-actions">
              <button
                onClick={() => setShowVariableDialog(false)}
                className="enhanced-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTemplate}
                className={`enhanced-apply-btn ${!previewValidation?.isValid ? 'disabled' : ''}`}
                disabled={!previewValidation?.isValid}
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