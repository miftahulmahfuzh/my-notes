/**
 * API service for Silence Notes Chrome Extension
 */

// Import types from our centralized type definitions
export type {
  Note,
  NoteResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteListResponse,
  SearchRequest,
  SearchResult,
  ApiResponse,
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
  PrettifyResponse
} from './types';

// Also import them for use within the file
import {
  Note,
  NoteResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteListResponse,
  SearchRequest,
  SearchResult,
  ApiResponse,
  TagsListResponse,
  PrettifyResponse
} from './types';

import { CONFIG } from './utils/config';

/**
 * Configuration for API service
 */
interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * API Service Class - Robust implementation with error handling and retries
 */
class ApiService {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: Partial<ApiConfig> = {}) {
    // Default configuration
    const defaultConfig: ApiConfig = {
      baseUrl: CONFIG.API_BASE_URL,
      timeout: 10000, // 10 seconds
      retryAttempts: 3,
      retryDelay: 1000 // 1 second
    };

    const finalConfig = { ...defaultConfig, ...config };
    this.baseUrl = finalConfig.baseUrl;
    this.timeout = finalConfig.timeout;
    this.retryAttempts = finalConfig.retryAttempts;
    this.retryDelay = finalConfig.retryDelay;
  }

  /**
   * Get authentication service (for direct access)
   */
  async getAuthService() {
    const { authService } = await import('./auth');
    return authService;
  }

  /**
   * Make API request with proper headers, timeout, and retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.performRequest<T>(endpoint, options);

        // If successful, return the result
        if (result.success || !this.isRetryableError(result.error)) {
          return result;
        }

        // If it's a retryable error, continue to next attempt
        const errorStr = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        lastError = new Error(errorStr || 'Unknown error');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(lastError.message)) {
          break;
        }
      }

      // If this is not the last attempt, wait before retrying
      if (attempt < this.retryAttempts) {
        await this.delay(this.retryAttempts * attempt);
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError?.message || 'Request failed after all retry attempts',
      message: 'Network request failed'
    };
  }

  /**
   * Perform a single API request
   */
  private async performRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle empty responses
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        // data.error might be an object (ApiError) or string
        const errorMessage = typeof data.error === 'object'
          ? (data.error?.message || data.error?.code || data.error?.details || 'Unknown error')
          : data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;

        return {
          success: false,
          error: errorMessage,
          message: typeof data.message === 'string' ? data.message : 'Request failed'
        };
      }

      // Handle wrapped APIResponse format from backend
      // Backend returns: {success: true, data: {...}}
      // Frontend expects: {success: true, data: actualData}
      let responseData = data as T;

      // If the data has the backend's APIResponse structure, extract the inner data
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        responseData = (data as any).data;
      }

      return {
        success: true,
        data: responseData,
        message: (data as any)?.message || 'Success'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error?: string | unknown): boolean {
    if (!error) return false;

    const errorStr = typeof error === 'string' ? error : String(error);
    const errorLower = errorStr.toLowerCase();

    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'fetch',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'HTTP 5',
      'Internal Server Error',
      'Bad Gateway',
      'Service Unavailable',
      'Gateway Timeout'
    ];

    return retryableErrors.some(retryableError =>
      errorLower.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Delay for a specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a new note
   * POST /api/v1/notes
   */
  async createNote(request: CreateNoteRequest): Promise<ApiResponse<NoteResponse>> {
    return this.makeRequest<NoteResponse>('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get all notes for the current user with pagination
   * GET /api/v1/notes?limit=20&offset=0&order_by=updated_at&order_dir=desc
   */
  async getNotes(params: {
    limit?: number;
    offset?: number;
    order_by?: 'created_at' | 'updated_at' | 'title';
    order_dir?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<NoteListResponse>> {
    const searchParams = new URLSearchParams();

    // Set defaults
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const orderBy = params.order_by ?? 'updated_at';
    const orderDir = params.order_dir ?? 'desc';

    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());
    searchParams.append('order_by', orderBy);
    searchParams.append('order_dir', orderDir);

    const query = searchParams.toString();
    const endpoint = `/api/v1/notes${query ? `?${query}` : ''}`;

    return this.makeRequest<NoteListResponse>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Get a single note by ID
   * GET /api/v1/notes/{id}
   */
  async getNote(id: string): Promise<ApiResponse<NoteResponse>> {
    return this.makeRequest<NoteResponse>(`/api/v1/notes/${id}`, {
      method: 'GET',
    });
  }

  /**
   * Update an existing note
   * PUT /api/v1/notes/{id}
   */
  async updateNote(id: string, request: UpdateNoteRequest): Promise<ApiResponse<NoteResponse>> {
    return this.makeRequest<NoteResponse>(`/api/v1/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  /**
   * Prettify a note using AI
   * POST /api/v1/notes/{id}/prettify
   */
  async prettifyNote(id: string): Promise<ApiResponse<PrettifyResponse>> {
    return this.makeRequest<PrettifyResponse>(`/api/v1/notes/${id}/prettify`, {
      method: 'POST',
    });
  }

  /**
   * Delete a note
   * DELETE /api/v1/notes/{id}
   */
  async deleteNote(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>(`/api/v1/notes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search notes with query and tags
   * GET /api/v1/search/notes?query=...&tags=tag1,tag2&limit=20&offset=0
   */
  async searchNotes(params: SearchRequest): Promise<ApiResponse<SearchResult>> {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append('query', params.query);
    if (params.tags && params.tags.length > 0) {
      searchParams.append('tags', params.tags.join(','));
    }
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    if (params.order_by) searchParams.append('order_by', params.order_by);
    if (params.order_dir) searchParams.append('order_dir', params.order_dir);

    const query = searchParams.toString();
    const endpoint = `/api/v1/search/notes${query ? `?${query}` : ''}`;

    return this.makeRequest<SearchResult>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Semantic search notes with LLM
   * GET /api/v1/search/notes?semantic=true&query=...
   */
  async semanticSearch(query: string): Promise<ApiResponse<SearchResult & { duration: number }>> {
    const searchParams = new URLSearchParams();

    if (query) searchParams.append('query', query);
    searchParams.append('semantic', 'true');

    const endpoint = `/api/v1/search/notes?${searchParams.toString()}`;

    return this.makeRequest<SearchResult & { duration: number }>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Get notes by tag
   * GET /api/v1/notes/tags/{tag}?limit=20&offset=0
   */
  async getNotesByTag(tag: string, params: {
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<SearchResult>> {
    const searchParams = new URLSearchParams();

    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());

    const query = searchParams.toString();
    const endpoint = `/api/v1/notes/tags/${encodeURIComponent(tag)}${query ? `?${query}` : ''}`;

    return this.makeRequest<SearchResult>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Get note statistics
   * GET /api/v1/notes/stats
   */
  async getNoteStats(): Promise<ApiResponse<{
    total_notes: number;
    last_sync: string;
    [key: string]: any;
  }>> {
    return this.makeRequest<any>('/api/v1/notes/stats', {
      method: 'GET',
    });
  }

  /**
   * Sync notes with server
   * GET /api/v1/notes/sync?since=...&limit=1000&offset=0
   */
  async syncNotes(params: {
    since?: string; // RFC3339 timestamp
    limit?: number;
    offset?: number;
    include_deleted?: boolean;
    sync_token?: string;
  } = {}): Promise<ApiResponse<{
    notes: NoteResponse[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    sync_token: string;
    server_time: string;
    conflicts: any[];
    metadata: any;
  }>> {
    const searchParams = new URLSearchParams();

    if (params.since) searchParams.append('since', params.since);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    if (params.include_deleted) searchParams.append('include_deleted', 'true');
    if (params.sync_token) searchParams.append('sync_token', params.sync_token);

    const query = searchParams.toString();
    const endpoint = `/api/v1/notes/sync${query ? `?${query}` : ''}`;

    return this.makeRequest<any>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Batch create notes
   * POST /api/v1/notes/batch
   */
  async batchCreateNotes(requests: CreateNoteRequest[]): Promise<ApiResponse<{
    notes: NoteResponse[];
    count: number;
  }>> {
    return this.makeRequest<any>('/api/v1/notes/batch', {
      method: 'POST',
      body: JSON.stringify(requests),
    });
  }

  /**
   * Batch update notes
   * PUT /api/v1/notes/batch
   */
  async batchUpdateNotes(updates: Array<{
    note_id: string;
    updates: UpdateNoteRequest;
  }>): Promise<ApiResponse<{
    notes: NoteResponse[];
    count: number;
  }>> {
    return this.makeRequest<any>('/api/v1/notes/batch', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
  }

  /**
   * Check if the API is available
   * GET /api/v1/health
   */
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.makeRequest<{ status: string }>('/api/v1/health', {
      method: 'GET',
    });
  }

  /**
   * Get all tags for the current user
   * GET /api/v1/tags?limit=100&offset=0
   */
  async getTags(params: {
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<TagsListResponse>> {
    const searchParams = new URLSearchParams();

    // Set defaults - fetch up to 100 tags at once
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());

    const query = searchParams.toString();
    const endpoint = `/api/v1/tags${query ? `?${query}` : ''}`;

    return this.makeRequest<TagsListResponse>(endpoint, {
      method: 'GET',
    });
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;