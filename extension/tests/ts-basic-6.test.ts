/**
 * TypeScript test - Step 6: Path Aliases and Real Service Imports
 */

import { Note } from '@/types';
import { StorageErrorType } from '@/types/storage';

test('can import types using path aliases', () => {
  const note: Note = {
    id: 'test-note-1',
    title: 'Test Note',
    content: 'Test content',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user_id: 'user-123',
    version: 1,
  };

  expect(note.id).toBe('test-note-1');
  expect(note.title).toBe('Test Note');
});

test('can import enum types using path aliases', () => {
  expect(StorageErrorType.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
  expect(StorageErrorType.DATA_CORRUPTION).toBe('DATA_CORRUPTION');
  expect(StorageErrorType.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
  expect(StorageErrorType.ACCESS_DENIED).toBe('ACCESS_DENIED');
  expect(StorageErrorType.UNKNOWN).toBe('UNKNOWN');
});

test('path aliases work correctly with complex types', () => {
  // Test that complex type structures work
  const storageError: StorageErrorType = StorageErrorType.DATA_CORRUPTION;

  const errors: StorageErrorType[] = [
    StorageErrorType.QUOTA_EXCEEDED,
    StorageErrorType.DATA_CORRUPTION,
    StorageErrorType.VERSION_MISMATCH,
  ];

  expect(errors).toHaveLength(3);
  expect(errors).toContain(storageError);
});

test('type checking works with imported types', () => {
  // TypeScript should catch type errors
  const note: Note = {
    id: 'test-note-1',
    title: 'Test Note',
    content: 'Test content',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  // This should cause a TypeScript error if uncommented:
  // const invalidNote: Note = { id: 'test', title: 123 }; // title should be string

  expect(note.user_id).toBeUndefined(); // optional property
});