import { Note } from '../types';

// Note reordering utilities
export const reorderNotes = (
  notes: Note[],
  oldIndex: number,
  newIndex: number
): Note[] => {
  if (oldIndex === newIndex) return notes;

  const newNotes = [...notes];
  const [movedNote] = newNotes.splice(oldIndex, 1);
  newNotes.splice(newIndex, 0, movedNote);

  return newNotes;
};

// Multi-note reordering utilities
export const reorderMultipleNotes = (
  notes: Note[],
  sourceIndices: number[],
  targetIndex: number
): Note[] => {
  if (sourceIndices.length === 0) return notes;

  const newNotes = [...notes];
  const movedNotes = sourceIndices
    .sort((a, b) => b - a) // Sort in descending order to avoid index shifting
    .map(index => newNotes[index]);

  // Remove notes from original positions
  sourceIndices
    .sort((a, b) => b - a)
    .forEach(index => newNotes.splice(index, 1));

  // Insert notes at target position
  const adjustedTargetIndex = Math.min(targetIndex, newNotes.length);
  newNotes.splice(adjustedTargetIndex, 0, ...movedNotes);

  return newNotes;
};

// Tag assignment utilities
export const assignTagToNote = (
  note: Note,
  tag: string
): Note => {
  const existingTags = extractHashtags(note.content);

  // Check if tag already exists
  if (existingTags.includes(tag)) {
    return note;
  }

  // Add tag to content
  const newContent = existingTags.length > 0
    ? `${note.content} ${tag}`
    : `${note.content}\n\n${tag}`;

  return {
    ...note,
    content: newContent,
    updated_at: new Date().toISOString(),
  };
};

export const assignTagToMultipleNotes = (
  notes: Note[],
  noteIds: string[],
  tag: string
): Note[] => {
  return notes.map(note => {
    if (!noteIds.includes(note.id)) {
      return note;
    }
    return assignTagToNote(note, tag);
  });
};

// Tag removal utilities
export const removeTagFromNote = (
  note: Note,
  tag: string
): Note => {
  // Remove tag from content
  const regex = new RegExp(`#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  const newContent = note.content.replace(regex, '').trim();

  return {
    ...note,
    content: newContent,
    updated_at: new Date().toISOString(),
  };
};

export const removeTagFromMultipleNotes = (
  notes: Note[],
  noteIds: string[],
  tag: string
): Note[] => {
  return notes.map(note => {
    if (!noteIds.includes(note.id)) {
      return note;
    }
    return removeTagFromNote(note, tag);
  });
};

// Hashtag extraction utilities
export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = content.match(hashtagRegex);
  return matches ? [...new Set(matches)] : [];
};

export const extractHashtagsWithPosition = (
  content: string
): Array<{ tag: string; position: number; length: number }> => {
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const results: Array<{ tag: string; position: number; length: number }> = [];
  let match;

  while ((match = hashtagRegex.exec(content)) !== null) {
    results.push({
      tag: match[0],
      position: match.index,
      length: match[0].length,
    });
  }

  return results;
};

// Tag statistics utilities
export const getTagStatistics = (notes: Note[]): Array<{ tag: string; count: number; notes: string[] }> => {
  const tagMap = new Map<string, Set<string>>();

  notes.forEach(note => {
    const tags = extractHashtags(note.content);
    tags.forEach(tag => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, new Set());
      }
      tagMap.get(tag)!.add(note.id);
    });
  });

  return Array.from(tagMap.entries())
    .map(([tag, noteIds]) => ({
      tag,
      count: noteIds.size,
      notes: Array.from(noteIds),
    }))
    .sort((a, b) => b.count - a.count);
};

// Drag validation utilities
export const canDragNote = (note: Note): boolean => {
  // Add any validation logic here
  return true;
};

export const canDropOnTag = (tag: string, noteIds: string[]): boolean => {
  // Add any validation logic here
  return true;
};

// Animation utilities
export const getDragAnimation = (duration: number = 200) => ({
  duration,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.01)',
});

// Accessibility utilities
export const getDragAriaLabel = (note: Note, isMultiDrag: boolean, selectedCount: number): string => {
  if (isMultiDrag) {
    return `Dragging ${selectedCount} notes, starting with "${note.title || 'Untitled Note'}"`;
  }
  return `Dragging note: ${note.title || 'Untitled Note'}`;
};

export const getDropZoneAriaLabel = (tag: string, noteCount: number): string => {
  return `Drop zone for tag ${tag}. Currently has ${noteCount} notes.`;
};

// Touch device support
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// Performance optimization utilities
export const debounceDragEvents = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const throttleDragEvents = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Local storage utilities for drag preferences
export const saveDragPreferences = async (preferences: {
  animationSpeed: number;
  enableMultiSelect: boolean;
  showDragHandles: boolean;
  autoSortTags: boolean;
}): Promise<void> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ dragPreferences: preferences });
    } else {
      localStorage.setItem('dragPreferences', JSON.stringify(preferences));
    }
  } catch (error) {
    console.error('Failed to save drag preferences:', error);
  }
};

export const loadDragPreferences = async (): Promise<{
  animationSpeed: number;
  enableMultiSelect: boolean;
  showDragHandles: boolean;
  autoSortTags: boolean;
}> => {
  const defaults = {
    animationSpeed: 200,
    enableMultiSelect: true,
    showDragHandles: true,
    autoSortTags: false,
  };

  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('dragPreferences');
      return { ...defaults, ...result.dragPreferences };
    } else {
      const stored = localStorage.getItem('dragPreferences');
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    }
  } catch (error) {
    console.error('Failed to load drag preferences:', error);
    return defaults;
  }
};

// Error handling utilities
export const handleDragError = (error: Error, context: string): void => {
  console.error(`Drag & Drop Error (${context}):`, error);

  // You could add error reporting here
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'DRAG_ERROR',
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  }
};

// Debug utilities
export const debugDragEvent = (event: string, data: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DragDebug] ${event}:`, data);
  }
};

export default {
  reorderNotes,
  reorderMultipleNotes,
  assignTagToNote,
  assignTagToMultipleNotes,
  removeTagFromNote,
  removeTagFromMultipleNotes,
  extractHashtags,
  extractHashtagsWithPosition,
  getTagStatistics,
  canDragNote,
  canDropOnTag,
  getDragAnimation,
  getDragAriaLabel,
  getDropZoneAriaLabel,
  isTouchDevice,
  getTouchDistance,
  debounceDragEvents,
  throttleDragEvents,
  saveDragPreferences,
  loadDragPreferences,
  handleDragError,
  debugDragEvent,
};