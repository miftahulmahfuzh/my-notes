import { Note, ApiResponse, HealthResponse } from '../types';

export interface SyncResponse {
  notes: Note[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  syncToken: string;
  serverTime: string;
  conflicts: any[];
  metadata: {
    lastSyncAt: string;
    serverTime: string;
    totalNotes: number;
    updatedNotes: number;
    hasConflicts: boolean;
  };
}

const API_BASE_URL = 'http://localhost:8080/api/v1';

export class ApiService {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Health check
  static async healthCheck(): Promise<ApiResponse<HealthResponse>> {
    return this.request<HealthResponse>('/health');
  }

  // Notes API
  static async getNotes(params: { limit?: number; offset?: number; orderBy?: string; orderDir?: string; updated_since?: string } = {}): Promise<ApiResponse<{ notes: Note[]; total: number; page: number; limit: number; hasMore: boolean }>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    if (params.orderBy) searchParams.append('order_by', params.orderBy);
    if (params.orderDir) searchParams.append('order_dir', params.orderDir);
    if (params.updated_since) searchParams.append('updated_since', params.updated_since);

    const endpoint = `/notes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  static async createNote(note: { title?: string; content: string }): Promise<ApiResponse<Note>> {
    return this.request<Note>('/notes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(note),
    });
  }

  static async getNote(id: string): Promise<ApiResponse<Note>> {
    return this.request<Note>(`/notes/${id}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  static async updateNote(id: string, updates: { title?: string; content?: string; version?: number }): Promise<ApiResponse<Note>> {
    return this.request<Note>(`/notes/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(updates),
    });
  }

  static async deleteNote(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/notes/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  static async searchNotes(params: { query?: string; tags?: string[]; limit?: number; offset?: number }): Promise<ApiResponse<{ notes: Note[]; total: number; page: number; limit: number; hasMore: boolean }>> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('query', params.query);
    if (params.tags) searchParams.append('tags', params.tags.join(','));
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const endpoint = `/search/notes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  static async getNotesByTag(tag: string, params: { limit?: number; offset?: number } = {}): Promise<ApiResponse<{ notes: Note[]; total: number; page: number; limit: number; hasMore: boolean }>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const endpoint = `/notes/tags/${encodeURIComponent(tag)}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  
  static async batchCreateNotes(notes: { title?: string; content: string }[]): Promise<ApiResponse<{ notes: Note[]; count: number }>> {
    return this.request('/notes/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(notes),
    });
  }

  static async batchUpdateNotes(updates: { noteId: string; updates: { title?: string; content?: string; version?: number } }[]): Promise<ApiResponse<{ notes: Note[]; count: number }>> {
    return this.request('/notes/batch', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify({ updates }),
    });
  }

  static async getNoteStats(): Promise<ApiResponse<{ total_notes: number; last_sync: string }>> {
    return this.request('/notes/stats', {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  // Sync API
  static async syncNotes(params: {
    since?: string;
    limit?: number;
    offset?: number;
    syncToken?: string;
    includeDeleted?: boolean;
  } = {}): Promise<ApiResponse<SyncResponse>> {
    const searchParams = new URLSearchParams();
    if (params.since) searchParams.append('since', params.since);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    if (params.syncToken) searchParams.append('sync_token', params.syncToken);
    if (params.includeDeleted) searchParams.append('include_deleted', 'true');

    return this.request<SyncResponse>(`/notes/sync?${searchParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
      },
    });
  }

  static async forceSync(): Promise<ApiResponse<SyncResponse>> {
    // Force sync by getting all recent notes (last 24 hours)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return this.syncNotes({
      since,
      limit: 1000,
      includeDeleted: false
    });
  }

  // Authentication
  private static async getAuthToken(): Promise<string> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken || '');
      });
    });
  }

  static async setAuthToken(token: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ authToken: token }, () => resolve());
    });
  }

  static async clearAuthToken(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['authToken'], () => resolve());
    });
  }
}