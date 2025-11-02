// Type definitions for Silence Notes

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  version?: number;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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