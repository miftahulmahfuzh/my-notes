export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    this.bindGlobalEvents();
  }

  // Register a keyboard shortcut
  register(shortcut: KeyboardShortcut): void {
    const key = this.generateKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  // Unregister a keyboard shortcut
  unregister(shortcut: Omit<KeyboardShortcut, 'action'>): void {
    const key = this.generateKey(shortcut);
    this.shortcuts.delete(key);
  }

  // Enable/disable keyboard shortcuts
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Generate a unique key for the shortcut
  private generateKey(shortcut: Omit<KeyboardShortcut, 'description' | 'action'>): string {
    return `${shortcut.ctrlKey ? 'ctrl+' : ''}${shortcut.shiftKey ? 'shift+' : ''}${shortcut.altKey ? 'alt+' : ''}${shortcut.metaKey ? 'meta+' : ''}${shortcut.key.toLowerCase()}`;
  }

  // Handle keyboard events
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    // Don't trigger shortcuts when user is typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Allow certain shortcuts even when typing
      const allowedShortcuts = ['escape', 'ctrl+s', 'meta+s', 'ctrl+shift+s', 'meta+shift+s'];
      const eventKey = this.generateKey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });

      if (!allowedShortcuts.includes(eventKey)) {
        return;
      }
    }

    const eventKey = this.generateKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    });

    const shortcut = this.shortcuts.get(eventKey);
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
    }
  };

  // Bind global keyboard events
  private bindGlobalEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  // Unbind global keyboard events
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  // Get all registered shortcuts
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  // Format shortcut for display
  static formatShortcut(shortcut: Omit<KeyboardShortcut, 'description' | 'action'>): string {
    const parts: string[] = [];

    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.metaKey) parts.push('Cmd');

    parts.push(shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1));

    return parts.join(' + ');
  }
}

// Create a singleton instance
export const keyboardManager = new KeyboardManager();

// Common shortcut combinations
export const SHORTCUTS = {
  // Save
  SAVE: { key: 's', ctrlKey: true },
  SAVE_SHIFT: { key: 's', ctrlKey: true, shiftKey: true },

  // Navigation
  NEW_NOTE: { key: 'n', ctrlKey: true },
  SEARCH: { key: 'k', ctrlKey: true },

  // Escape/Cancel
  ESCAPE: { key: 'Escape' },

  // Other useful shortcuts
  REFRESH: { key: 'r', ctrlKey: true },
  SELECT_ALL: { key: 'a', ctrlKey: true },
} as const;

// Helper function to check if a key event matches a shortcut
export const matchesShortcut = (event: KeyboardEvent, shortcut: Omit<KeyboardShortcut, 'description' | 'action'>): boolean => {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    !!event.ctrlKey === !!shortcut.ctrlKey &&
    !!event.shiftKey === !!shortcut.shiftKey &&
    !!event.altKey === !!shortcut.altKey &&
    !!event.metaKey === !!shortcut.metaKey
  );
};

// Hook for using keyboard shortcuts in React components
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  React.useEffect(() => {
    shortcuts.forEach(shortcut => {
      keyboardManager.register(shortcut);
    });

    return () => {
      shortcuts.forEach(shortcut => {
        keyboardManager.unregister(shortcut);
      });
    };
  }, [shortcuts]);
};