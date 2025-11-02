import { useEffect, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ShortcutAction, ShortcutCategory } from '../types/shortcuts';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  scope?: string;
  allowOverlap?: boolean;
}

interface ShortcutHandler {
  action: ShortcutAction;
  handler: () => void;
  enabled: boolean;
}

export const useKeyboardShortcuts = (
  shortcuts: ShortcutCategory[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const {
    enabled = true,
    scope = 'global',
    allowOverlap = false
  } = options;

  const handlersRef = useRef<Map<string, ShortcutHandler>>(new Map());
  const globalHandlersRef = useRef<Map<string, ShortcutHandler>>(new Map());

  // Register a shortcut handler
  const registerShortcut = useCallback((
    action: ShortcutAction,
    handler: () => void,
    isEnabled: boolean = true
  ) => {
    const key = action.userKey || action.defaultKey;
    const shortcutHandler: ShortcutHandler = {
      action,
      handler,
      enabled: isEnabled
    };

    if (action.global) {
      globalHandlersRef.current.set(key, shortcutHandler);
    } else {
      handlersRef.current.set(key, shortcutHandler);
    }
  }, []);

  // Unregister a shortcut handler
  const unregisterShortcut = useCallback((key: string) => {
    handlersRef.current.delete(key);
    globalHandlersRef.current.delete(key);
  }, []);

  // Execute a shortcut handler
  const executeShortcut = useCallback((key: string) => {
    // Try local handlers first
    let handler = handlersRef.current.get(key);

    // If not found, try global handlers
    if (!handler) {
      handler = globalHandlersRef.current.get(key);
    }

    if (handler && handler.enabled && enabled) {
      try {
        handler.handler();
        return true;
      } catch (error) {
        console.error(`Error executing shortcut ${key}:`, error);
        return false;
      }
    }

    return false;
  }, [enabled]);

  // Get all registered shortcuts
  const getRegisteredShortcuts = useCallback(() => {
    const localShortcuts = Array.from(handlersRef.current.entries()).map(([key, handler]) => ({
      key,
      ...handler.action,
      userKey: key,
      enabled: handler.enabled
    }));

    const globalShortcuts = Array.from(globalHandlersRef.current.entries()).map(([key, handler]) => ({
      key,
      ...handler.action,
      userKey: key,
      enabled: handler.enabled
    }));

    return [...localShortcuts, ...globalShortcuts];
  }, []);

  // Enable/disable a shortcut
  const toggleShortcut = useCallback((key: string, isEnabled: boolean) => {
    const handler = handlersRef.current.get(key) || globalHandlersRef.current.get(key);
    if (handler) {
      handler.enabled = isEnabled;
    }
  }, []);

  // Set up hotkeys using react-hotkeys-hook
  useEffect(() => {
    if (!enabled) return;

    // Register all enabled shortcuts from categories
    shortcuts.forEach(category => {
      category.shortcuts.forEach(action => {
        if (action.enabled) {
          const key = action.userKey || action.defaultKey;

          // Only register if we don't have a custom handler
          if (!handlersRef.current.has(key) && !globalHandlersRef.current.has(key)) {
            registerShortcut(action, () => {
              console.log(`Shortcut triggered: ${action.name} (${key})`);
            }, action.enabled);
          }
        }
      });
    });

    // Clean up on unmount
    return () => {
      handlersRef.current.clear();
      globalHandlersRef.current.clear();
    };
  }, [shortcuts, enabled, registerShortcut]);

  // Set up global keydown listener for custom handling
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when user is typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        // Only allow global shortcuts when typing
        const key = formatKeyEvent(event);
        const globalHandler = globalHandlersRef.current.get(key);
        if (globalHandler && globalHandler.enabled) {
          event.preventDefault();
          executeShortcut(key);
        }
        return;
      }

      const key = formatKeyEvent(event);
      const wasHandled = executeShortcut(key);

      if (wasHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, executeShortcut]);

  // Utility function to format keyboard events into shortcut keys
  const formatKeyEvent = (event: KeyboardEvent): string => {
    const parts: string[] = [];

    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');

    // Handle special keys
    let key = event.key.toLowerCase();
    switch (key) {
      case ' ':
        key = 'space';
        break;
      case 'escape':
        key = 'escape';
        break;
      case 'enter':
        key = 'enter';
        break;
      case 'tab':
        key = 'tab';
        break;
      case 'backspace':
        key = 'backspace';
        break;
      case 'delete':
        key = 'delete';
        break;
      case 'arrowup':
        key = 'up';
        break;
      case 'arrowdown':
        key = 'down';
        break;
      case 'arrowleft':
        key = 'left';
        break;
      case 'arrowright':
        key = 'right';
        break;
      default:
        // For single letters, use uppercase
        if (key.length === 1) {
          key = key.toUpperCase();
        }
        break;
    }

    parts.push(key);
    return parts.join('+');
  };

  // Validate shortcut key format
  const validateShortcut = useCallback((shortcut: string): boolean => {
    const parts = shortcut.toLowerCase().split('+');
    const validModifiers = ['ctrl', 'alt', 'shift', 'meta'];
    const validKeys = [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
      'escape', 'enter', 'tab', 'space', 'backspace', 'delete',
      'up', 'down', 'left', 'right',
      'home', 'end', 'pageup', 'pagedown',
      ';', '=', ',', '-', '.', '/', '\\', "'", '`', '[', ']'
    ];

    const modifiers = parts.slice(0, -1);
    const mainKey = parts[parts.length - 1];

    // Check if all modifiers are valid
    if (modifiers.some(mod => !validModifiers.includes(mod))) {
      return false;
    }

    // Check if main key is valid
    return validKeys.includes(mainKey);
  }, []);

  // Convert platform-specific keys
  const normalizeShortcut = useCallback((shortcut: string): string => {
    // Convert Mac-specific keys to cross-platform format
    return shortcut
      .replace(/⌘/g, 'meta')
      .replace(/⌥/g, 'alt')
      .replace(/⌃/g, 'ctrl')
      .replace(/⇧/g, 'shift')
      .toLowerCase();
  }, []);

  // Check if a shortcut conflicts with another
  const checkConflict = useCallback((shortcut: string, excludeActionId?: string): boolean => {
    const key = normalizeShortcut(shortcut);

    for (const [registeredKey, handler] of handlersRef.current) {
      if (normalizeShortcut(registeredKey) === key && handler.action.id !== excludeActionId) {
        return true;
      }
    }

    for (const [registeredKey, handler] of globalHandlersRef.current) {
      if (normalizeShortcut(registeredKey) === key && handler.action.id !== excludeActionId) {
        return true;
      }
    }

    return false;
  }, [normalizeShortcut]);

  return {
    registerShortcut,
    unregisterShortcut,
    executeShortcut,
    getRegisteredShortcuts,
    toggleShortcut,
    validateShortcut,
    normalizeShortcut,
    checkConflict,
    formatKeyEvent
  };
};

export default useKeyboardShortcuts;