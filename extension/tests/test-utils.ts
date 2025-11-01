/**
 * Test utilities for step-by-step TypeScript testing
 */

export interface TestNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  version?: number;
}

export const createTestNote = (overrides: Partial<TestNote> = {}): TestNote => ({
  id: 'test-note-1',
  title: 'Test Note',
  content: 'Test content #hashtag',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'test-user-1',
  version: 1,
  ...overrides,
});

export const TEST_CONSTANTS = {
  MAX_TITLE_LENGTH: 100,
  MAX_CONTENT_LENGTH: 10000,
  DEFAULT_TIMEOUT: 5000,
} as const;