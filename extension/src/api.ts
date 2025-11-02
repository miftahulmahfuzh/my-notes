/**
 * API service for Silence Notes Chrome Extension
 */

// API Types
export interface Note {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  created_at: string;
  updated_at: string;
  version: number;
  tags?: string[];
  sync_metadata?: Record<string, any>;
}

export interface CreateNoteRequest {
  title?: string;
  content: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface NoteListResponse {
  notes: Note[];
  total: number;
  page: number;
  limit: number;
}

/**
 * API Service Class
 */
class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    // Default to localhost for development
    this.baseUrl = 'http://localhost:8080';
  }

  /**
   * Get authentication service (for direct access)
   */
  async getAuthService() {
    const { authService } = await import('./auth');
    return authService;
  }

  /**
   * Make API request with proper headers
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth header dynamically
      const { authService } = await import('./auth');
      const authHeader = await authService.getAuthHeader();
      Object.assign(headers, authHeader);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
          message: data.message || 'Request failed'
        };
      }

      return {
        success: true,
        data: data as T,
        message: data.message || 'Success'
      };

    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Network request failed'
      };
    }
  }

  /**
   * Create a new note
   */
  async createNote(request: CreateNoteRequest): Promise<ApiResponse<Note>> {
    return this.makeRequest<Note>('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get all notes for the current user
   */
  async getNotes(params: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
  } = {}): Promise<ApiResponse<NoteListResponse>> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.tags) searchParams.append('tags', params.tags.join(','));

    const query = searchParams.toString();
    const endpoint = `/api/v1/notes${query ? `?${query}` : ''}`;

    return this.makeRequest<NoteListResponse>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Get a single note by ID
   */
  async getNote(id: string): Promise<ApiResponse<Note>> {
    return this.makeRequest<Note>(`/api/v1/notes/${id}`, {
      method: 'GET',
    });
  }

  /**
   * Update an existing note
   */
  async updateNote(id: string, request: Partial<CreateNoteRequest>): Promise<ApiResponse<Note>> {
    return this.makeRequest<Note>(`/api/v1/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/v1/notes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check if the API is available
   */
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`);
      const data = await response.json();

      return {
        success: response.ok,
        data: data,
        message: response.ok ? 'API is healthy' : 'API is not healthy'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'API health check failed'
      };
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;