import { Note, ApiResponse, HealthResponse } from '../types';

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
  static async getNotes(): Promise<ApiResponse<Note[]>> {
    // TODO: Implement authentication
    return this.request<Note[]>('/notes', {
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

  static async updateNote(id: string, updates: { title?: string; content?: string }): Promise<ApiResponse<Note>> {
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