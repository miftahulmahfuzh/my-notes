import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../utils/config';

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  variables: string[];
  is_built_in: boolean;
  usage_count: number;
  is_public: boolean;
  icon: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface TemplateProcessingResult {
  content: string;
  variables: Record<string, string>;
  unfilled: string[];
  metadata: Record<string, string>;
  used_at: string;
}

interface UseTemplatesOptions {
  autoLoad?: boolean;
  includeBuiltIn?: boolean;
}

interface TemplateStats {
  [templateId: string]: number;
}

export const useTemplates = (options: UseTemplatesOptions = {}) => {
  const {
    autoLoad = true,
    includeBuiltIn = true
  } = options;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [builtInTemplates, setBuiltInTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateStats, setTemplateStats] = useState<TemplateStats>({});

  // Load all templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      // Load user templates
      const userResponse = await fetch(`${CONFIG.API_BASE_URL}/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to load user templates: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      console.log('User templates response (hook):', userData);
      const templates = Array.isArray(userData?.data) ? userData.data : [];
      setTemplates(templates);

      // Load built-in templates if enabled
      if (includeBuiltIn) {
        const builtInResponse = await fetch(`${CONFIG.API_BASE_URL}/templates/built-in`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (builtInResponse.ok) {
          const builtInData = await builtInResponse.json();
          console.log('Built-in templates response (hook):', builtInData);
          const builtInTemplates = Array.isArray(builtInData?.data) ? builtInData.data : [];
          setBuiltInTemplates(builtInTemplates);
        }
      }

      // Load template stats
      loadTemplateStats();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }, [includeBuiltIn]);

  // Load template usage statistics
  const loadTemplateStats = useCallback(async () => {
    try {
      const authToken = getAuthToken();
      if (!authToken) return;

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplateStats(data.stats || {});
      }
    } catch (err) {
      console.error('Error loading template stats:', err);
    }
  }, []);

  // Create template
  const createTemplate = useCallback(async (templateData: Omit<Template, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create template');
      }

      const result = await response.json();
      const newTemplate = result.data;

      setTemplates(prev => [...prev, newTemplate]);
      return newTemplate;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update template
  const updateTemplate = useCallback(async (id: string, templateData: Partial<Template>) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update template');
      }

      const result = await response.json();
      const updatedTemplate = result.data;

      setTemplates(prev =>
        prev.map(t => t.id === id ? updatedTemplate : t)
      );

      // Update selected template if it's the one being edited
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(updatedTemplate);
      }

      return updatedTemplate;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  // Delete template
  const deleteTemplate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete template');
      }

      setTemplates(prev => prev.filter(t => t.id !== id));

      // Clear selected template if it was deleted
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  // Apply template
  const applyTemplate = useCallback(async (templateId: string, variables: Record<string, string> = {}) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/${templateId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          variables,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply template');
      }

      const result = await response.json();
      const processingResult = result.results as TemplateProcessingResult;

      // Update template stats
      setTemplateStats(prev => ({
        ...prev,
        [templateId]: (prev[templateId] || 0) + 1
      }));

      return processingResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply template';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search templates
  const searchTemplates = useCallback(async (query: string, limit: number = 20) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get popular templates
  const getPopularTemplates = useCallback(async (limit: number = 10) => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        return [];
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/popular?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.data || [];

    } catch (err) {
      console.error('Error loading popular templates:', err);
      return [];
    }
  }, []);

  // Get template by ID
  const getTemplate = useCallback(async (id: string) => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/templates/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Template not found: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template not found');
      throw err;
    }
  }, []);

  // Filter templates by category
  const getTemplatesByCategory = useCallback((category: string) => {
    // Ensure arrays are properly initialized
    const safeTemplates = Array.isArray(templates) ? templates : [];
    const safeBuiltInTemplates = Array.isArray(builtInTemplates) ? builtInTemplates : [];

    const allTemplates = [...safeTemplates];
    if (includeBuiltIn) {
      allTemplates.push(...safeBuiltInTemplates);
    }

    if (category === 'all') {
      return allTemplates;
    }

    return allTemplates.filter(t => t.category === category);
  }, [templates, builtInTemplates, includeBuiltIn]);

  // Get built-in templates
  const getBuiltInTemplatesOnly = useCallback(() => {
    return builtInTemplates;
  }, [builtInTemplates]);

  // Get user templates only
  const getUserTemplatesOnly = useCallback(() => {
    return templates.filter(t => !t.is_built_in);
  }, [templates]);

  // Set selected template
  const setSelectedTemplateHandler = useCallback((template: Template | null) => {
    setSelectedTemplate(template);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load templates on mount if autoLoad is enabled
  useEffect(() => {
    if (autoLoad) {
      loadTemplates();
    }
  }, [autoLoad, loadTemplates]);

  return {
    // Data
    templates,
    builtInTemplates,
    selectedTemplate,
    templateStats,
    loading,
    error,

    // Actions
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    searchTemplates,
    getPopularTemplates,
    getTemplate,
    getTemplatesByCategory,
    getBuiltInTemplatesOnly,
    getUserTemplatesOnly,
    setSelectedTemplate: setSelectedTemplateHandler,
    clearError,
  };
};

// Helper function to get auth token
const getAuthToken = (): string | null => {
  // Try multiple storage methods for Chrome extension
  try {
    // Extension storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['authToken'], (result) => {
          resolve(result.authToken || null);
        });
      });
    }
  } catch (err) {
    console.warn('Chrome storage not available');
  }

  // Fallback to localStorage
  try {
    return localStorage.getItem('authToken');
  } catch (err) {
    console.warn('localStorage not available');
  }

  return null;
};

export default useTemplates;