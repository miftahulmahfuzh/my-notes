// Type definitions for Silence Notes

/**
 * Core Note interface - matches backend API response
 */
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

/**
 * Note response format from API (includes extracted tags)
 */
export interface NoteResponse extends Note {
  tags: string[];
}

/**
 * Request payload for creating a note
 */
export interface CreateNoteRequest {
  title?: string;
  content: string;
}

/**
 * Request payload for updating a note
 */
export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  version?: number;
}

/**
 * Paginated notes list response
 */
export interface NoteListResponse {
  notes: Note[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

/**
 * Search request parameters
 */
export interface SearchRequest {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at' | 'title';
  order_dir?: 'asc' | 'desc';
}

/**
 * Search result response
 */
export interface SearchResult {
  notes: Note[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

export interface NoteTag {
  note_id: string;
  tag_id: string;
  created_at: string;
}

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  autoSync: boolean;
  syncInterval: number;
  theme: 'light' | 'dark';
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Detailed API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Error API response wrapper
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Success API response wrapper
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface CreateNoteRequest {
  title?: string;
  content: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  version?: number;
}

export interface SearchRequest {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  notes: Note[];
  total: number;
  hasMore: boolean;
}

// Chrome Extension Message Types
export interface SyncNotesMessage {
  type: 'SYNC_NOTES';
  data?: any;
}

export interface CreateNoteMessage {
  type: 'CREATE_NOTE';
  content: string;
  source?: {
    url: string;
    title: string;
  };
}

export interface CreateNoteFromSelectionMessage {
  type: 'CREATE_NOTE_FROM_SELECTION';
}

/**
 * Template for note creation
 */
export interface Template {
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

/**
 * Template variable for substitution
 */
export interface TemplateVariable {
  name: string;
  type: 'text' | 'date' | 'select';
  description: string;
  default_value?: string;
  options?: string[]; // For select type
}

// Export Union type for all message types
export type ExtensionMessage =
  | SyncNotesMessage
  | CreateNoteMessage
  | CreateNoteFromSelectionMessage;

// Export Union type for Chrome runtime message responses
export interface MessageResponse {
  success: boolean;
  message?: string;
  data?: any;
}