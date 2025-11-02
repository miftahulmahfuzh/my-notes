import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragCancelEvent,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  ClientRect,
  Active,
  Over,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  Modifiers,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Note } from '../types';

interface DragAndDropOptions {
  onNoteReorder?: (oldIndex: number, newIndex: number, noteId: string) => void;
  onNoteTag?: (noteId: string, tag: string) => void;
  onNotesTag?: (noteIds: string[], tag: string) => void;
  onMultiSelect?: (noteIds: string[]) => void;
  allowMultiSelect?: boolean;
  disabled?: boolean;
}

interface DragState {
  activeId: string | null;
  activeNote?: Note;
  activeIds: string[];
  selectedNotes: Set<string>;
  isDragging: boolean;
  draggedOverId: string | null;
}

export const useDragAndDrop = (options: DragAndDropOptions = {}) => {
  const {
    onNoteReorder,
    onNoteTag,
    onNotesTag,
    onMultiSelect,
    allowMultiSelect = false,
    disabled = false
  } = options;

  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    activeIds: [],
    selectedNotes: new Set(),
    isDragging: false,
    draggedOverId: null,
  });

  const [notes, setNotes] = useState<Note[]>([]);
  const lastActiveIdRef = useRef<string | null>(null);

  // Custom collision detection for tag areas
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const { active, droppableContainers } = args;

    // First check for pointer intersection (more precise)
    const pointerIntersections = pointerWithin(args);
    if (pointerIntersections.length > 0) {
      return pointerIntersections;
    }

    // Fallback to rect intersection
    return rectIntersection(args);
  }, []);

  // Sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 3px distance before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Find the active note
    const activeNote = notes.find(note => note.id === activeId);
    const selectedNotes = allowMultiSelect ? dragState.selectedNotes : new Set<string>();

    // If the dragged note is not selected and we're in multi-select mode, select it
    if (allowMultiSelect && !selectedNotes.has(activeId)) {
      selectedNotes.clear();
      selectedNotes.add(activeId);
    }

    const activeIds = allowMultiSelect ? Array.from(selectedNotes) : [activeId];

    setDragState(prev => ({
      ...prev,
      activeId,
      activeIds,
      activeNote,
      selectedNotes,
      isDragging: true,
    }));

    lastActiveIdRef.current = activeId;
  }, [notes, allowMultiSelect, dragState.selectedNotes]);

  // Handle drag over
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    if (!over) return;

    const overId = over.id as string;
    setDragState(prev => ({
      ...prev,
      draggedOverId: overId,
    }));
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;

    if (!over) {
      // Drag was cancelled or dropped outside droppable area
      setDragState({
        activeId: null,
        activeIds: [],
        selectedNotes: new Set(),
        isDragging: false,
        draggedOverId: null,
      });
      return;
    }

    const overId = over.id as string;

    // Check if we're dropping on a tag area
    if (overId.startsWith('tag-')) {
      const tag = overId.replace('tag-', '');
      const activeIds = dragState.activeIds;

      if (activeIds.length > 1 && onNotesTag) {
        // Multi-drag to tag
        onNotesTag(activeIds, tag);
      } else if (onNoteTag) {
        // Single drag to tag
        onNoteTag(activeId, tag);
      }
    } else {
      // Reordering notes
      if (activeId !== overId) {
        const oldIndex = notes.findIndex(note => note.id === activeId);
        const newIndex = notes.findIndex(note => note.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && onNoteReorder) {
          onNoteReorder(oldIndex, newIndex, activeId);
        }
      }
    }

    // Reset drag state
    setDragState({
      activeId: null,
      activeIds: [],
      selectedNotes: new Set(),
      isDragging: false,
      draggedOverId: null,
    });

    lastActiveIdRef.current = null;
  }, [notes, dragState.activeIds, onNoteReorder, onNoteTag, onNotesTag]);

  // Handle drag cancel
  const handleDragCancel = useCallback((event: DragCancelEvent) => {
    setDragState({
      activeId: null,
      activeIds: [],
      selectedNotes: new Set(),
      isDragging: false,
      draggedOverId: null,
    });

    lastActiveIdRef.current = null;
  }, []);

  // Toggle note selection
  const toggleNoteSelection = useCallback((noteId: string, selected?: boolean) => {
    if (!allowMultiSelect) return;

    setDragState(prev => {
      const newSelectedNotes = new Set(prev.selectedNotes);

      if (selected === undefined) {
        // Toggle
        if (newSelectedNotes.has(noteId)) {
          newSelectedNotes.delete(noteId);
        } else {
          newSelectedNotes.add(noteId);
        }
      } else {
        // Set specific state
        if (selected) {
          newSelectedNotes.add(noteId);
        } else {
          newSelectedNotes.delete(noteId);
        }
      }

      // Notify parent about selection change
      if (onMultiSelect) {
        onMultiSelect(Array.from(newSelectedNotes));
      }

      return {
        ...prev,
        selectedNotes: newSelectedNotes,
      };
    });
  }, [allowMultiSelect, onMultiSelect]);

  // Select single note
  const selectNote = useCallback((noteId: string) => {
    setDragState(prev => {
      const newSelectedNotes = new Set<string>();
      newSelectedNotes.add(noteId);

      if (onMultiSelect) {
        onMultiSelect([noteId]);
      }

      return {
        ...prev,
        selectedNotes: newSelectedNotes,
      };
    });
  }, [onMultiSelect]);

  // Select all notes
  const selectAllNotes = useCallback(() => {
    if (!allowMultiSelect) return;

    const allNoteIds = notes.map(note => note.id);
    const newSelectedNotes = new Set(allNoteIds);

    setDragState(prev => ({
      ...prev,
      selectedNotes: newSelectedNotes,
    }));

    if (onMultiSelect) {
      onMultiSelect(allNoteIds);
    }
  }, [allowMultiSelect, notes, onMultiSelect]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      selectedNotes: new Set(),
    }));

    if (onMultiSelect) {
      onMultiSelect([]);
    }
  }, [onMultiSelect]);

  // Update notes list
  const updateNotes = useCallback((newNotes: Note[]) => {
    setNotes(newNotes);
  }, []);

  // Check if a note is selected
  const isNoteSelected = useCallback((noteId: string) => {
    return dragState.selectedNotes.has(noteId);
  }, [dragState.selectedNotes]);

  // Get selected notes
  const getSelectedNotes = useCallback(() => {
    return notes.filter(note => dragState.selectedNotes.has(note.id));
  }, [notes, dragState.selectedNotes]);

  // Check if dragging multiple notes
  const isMultiDragging = dragState.activeIds.length > 1;

  // Create DndContext provider
  const DndProvider = ({ children }: { children: React.ReactNode }) => {
    if (disabled) {
      return <>{children}</>;
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        {dragState.isDragging && (
          <DragOverlay
            activeId={dragState.activeId}
            activeNote={dragState.activeNote}
            activeData={notes.find(note => note.id === dragState.activeId)}
            multiDragIds={dragState.activeIds}
            multiDragNotes={notes.filter(note => dragState.activeIds.includes(note.id))}
          />
        )}
      </DndContext>
    );
  };

  return {
    // State
    dragState,
    isDragging: dragState.isDragging,
    activeId: dragState.activeId,
    selectedNotes: dragState.selectedNotes,
    isMultiDragging,

    // Actions
    toggleNoteSelection,
    selectNote,
    selectAllNotes,
    clearSelection,
    updateNotes,
    isNoteSelected,
    getSelectedNotes,

    // Provider
    DndProvider,
  };
};

export default useDragAndDrop;