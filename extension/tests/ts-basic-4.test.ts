/**
 * TypeScript test - Step 4: Module Imports and Exports
 */

import { TestNote, createTestNote, TEST_CONSTANTS } from './test-utils';

test('can import interfaces', () => {
  const note: TestNote = {
    id: 'test-1',
    title: 'Test Note',
    content: 'Test content',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  expect(note.id).toBe('test-1');
  expect(note.title).toBe('Test Note');
});

test('can import functions', () => {
  const note = createTestNote({ title: 'Custom Title' });

  expect(note.title).toBe('Custom Title');
  expect(note.content).toBe('Test content #hashtag');
  expect(note.user_id).toBe('test-user-1');
});

test('can import constants', () => {
  expect(TEST_CONSTANTS.MAX_TITLE_LENGTH).toBe(100);
  expect(TEST_CONSTANTS.MAX_CONTENT_LENGTH).toBe(10000);
  expect(TEST_CONSTANTS.DEFAULT_TIMEOUT).toBe(5000);
});

test('imported constants are readonly', () => {
  // TypeScript should prevent this:
  // TEST_CONSTANTS.MAX_TITLE_LENGTH = 200;

  expect(typeof TEST_CONSTANTS.MAX_TITLE_LENGTH).toBe('number');
});