import { ShortcutAction, ShortcutConfig, CommandPaletteItem } from '../types/shortcuts';

// Parse shortcut key string into components
export const parseShortcut = (shortcut: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
} => {
  const parts = shortcut.toLowerCase().split('+');
  const result = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: ''
  };

  parts.forEach(part => {
    switch (part) {
      case 'ctrl':
        result.ctrl = true;
        break;
      case 'alt':
        result.alt = true;
        break;
      case 'shift':
        result.shift = true;
        break;
      case 'meta':
      case 'cmd':
        result.meta = true;
        break;
      default:
        result.key = part;
        break;
    }
  });

  return result;
};

// Format shortcut for display
export const formatShortcut = (shortcut: string, platform: 'mac' | 'windows' | 'linux' = 'windows'): string => {
  const parsed = parseShortcut(shortcut);
  const parts: string[] = [];

  if (parsed.ctrl) {
    parts.push(platform === 'mac' ? '⌃' : 'Ctrl');
  }
  if (parsed.alt) {
    parts.push(platform === 'mac' ? '⌥' : 'Alt');
  }
  if (parsed.shift) {
    parts.push(platform === 'mac' ? '⇧' : 'Shift');
  }
  if (parsed.meta) {
    parts.push(platform === 'mac' ? '⌘' : 'Ctrl');
  }

  // Format main key
  let mainKey = parsed.key.toUpperCase();
  switch (parsed.key.toLowerCase()) {
    case 'space':
      mainKey = 'Space';
      break;
    case 'escape':
      mainKey = 'Esc';
      break;
    case 'enter':
      mainKey = 'Enter';
      break;
    case 'tab':
      mainKey = 'Tab';
      break;
    case 'backspace':
      mainKey = 'Backspace';
      break;
    case 'delete':
      mainKey = 'Delete';
      break;
    case 'up':
      mainKey = '↑';
      break;
    case 'down':
      mainKey = '↓';
      break;
    case 'left':
      mainKey = '←';
      break;
    case 'right':
      mainKey = '→';
      break;
    case 'home':
      mainKey = 'Home';
      break;
    case 'end':
      mainKey = 'End';
      break;
    case 'pageup':
      mainKey = 'Page Up';
      break;
    case 'pagedown':
      mainKey = 'Page Down';
      break;
    default:
      if (parsed.key.startsWith('f')) {
        mainKey = parsed.key.toUpperCase(); // F1, F2, etc.
      }
      break;
  }

  parts.push(mainKey);
  return parts.join(platform === 'mac' ? '' : '+');
};

// Get current platform
export const getPlatform = (): 'mac' | 'windows' | 'linux' => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'mac';
  if (userAgent.includes('linux')) return 'linux';
  return 'windows';
};

// Convert shortcut for current platform
export const normalizeShortcut = (shortcut: string): string => {
  const platform = getPlatform();
  const parsed = parseShortcut(shortcut);

  // On Mac, convert Ctrl to Cmd for most shortcuts (except a few exceptions)
  if (platform === 'mac' && parsed.ctrl && !parsed.meta) {
    const exceptions = ['space', 'tab', 'enter', 'escape'];
    if (!exceptions.includes(parsed.key.toLowerCase())) {
      parsed.ctrl = false;
      parsed.meta = true;
    }
  }

  // Rebuild shortcut string
  const parts: string[] = [];
  if (parsed.ctrl) parts.push('ctrl');
  if (parsed.alt) parts.push('alt');
  if (parsed.shift) parts.push('shift');
  if (parsed.meta) parts.push('meta');
  parts.push(parsed.key);

  return parts.join('+');
};

// Check if two shortcuts are equivalent
export const areShortcutsEqual = (shortcut1: string, shortcut2: string): boolean => {
  const normalized1 = normalizeShortcut(shortcut1);
  const normalized2 = normalizeShortcut(shortcut2);
  return normalized1 === normalized2;
};

// Validate shortcut format
export const validateShortcut = (shortcut: string): boolean => {
  try {
    const parsed = parseShortcut(shortcut);

    // Check if main key is valid
    const validKeys = [
      // Letters and numbers
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',

      // Function keys
      'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',

      // Special keys
      'escape', 'enter', 'tab', 'space', 'backspace', 'delete', 'insert',
      'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',

      // Punctuation and symbols
      ';', '=', ',', '-', '.', '/', '\\', "'", '`', '[', ']', 'numplus', 'numminus',
      'nummultiply', 'numdivide', 'numenter'
    ];

    return validKeys.includes(parsed.key.toLowerCase());
  } catch (error) {
    return false;
  }
};

// Check if shortcut is reserved by the browser
export const isBrowserReserved = (shortcut: string): boolean => {
  const normalized = normalizeShortcut(shortcut);

  // Common browser shortcuts that shouldn't be overridden
  const reserved = [
    'ctrl+r', // Refresh
    'ctrl+shift+r', // Hard refresh
    'ctrl+w', // Close tab
    'ctrl+t', // New tab
    'ctrl+n', // New window
    'ctrl+shift+t', // Reopen closed tab
    'ctrl+tab', // Switch tabs
    'ctrl+shift+tab', // Switch tabs backwards
    'ctrl+f', // Find
    'ctrl+shift+f', // Find in all tabs
    'ctrl+g', // Find next
    'ctrl+shift+g', // Find previous
    'ctrl+l', // Focus address bar
    'ctrl+shift+j', // Developer tools
    'ctrl+shift+i', // Developer tools
    'ctrl+u', // View source
    'ctrl+s', // Save
    'ctrl+p', // Print
    'ctrl+c', // Copy
    'ctrl+v', // Paste
    'ctrl+x', // Cut
    'ctrl+a', // Select all
    'ctrl+z', // Undo
    'ctrl+y', // Redo
    'ctrl+shift+z', // Redo
    'f5', // Refresh
    'f11', // Fullscreen
    'f12', // Developer tools
  ];

  return reserved.includes(normalized);
};

// Check if shortcut conflicts with system shortcuts
export const isSystemReserved = (shortcut: string): boolean => {
  const platform = getPlatform();
  const normalized = normalizeShortcut(shortcut);

  if (platform === 'mac') {
    const macReserved = [
      'cmd+q', // Quit
      'cmd+w', // Close window
      'cmd+m', // Minimize
      'cmd+option+m', // Minimize all
      'cmd+h', // Hide
      'cmd+option+h', // Hide others
      'cmd+space', // Spotlight
      'cmd+tab', // App switcher
      'cmd+shift+tab', // App switcher backwards
      'cmd+option+esc', // Force quit
      'cmd+ctrl+q', // Log out
      'cmd+shift+3', // Screenshot
      'cmd+shift+4', // Screenshot selection
      'cmd+shift+5', // Screenshot options
      'cmd+c', // Copy
      'cmd+v', // Paste
      'cmd+x', // Cut
      'cmd+z', // Undo
      'cmd+shift+z', // Redo
      'cmd+a', // Select all
      'cmd+f', // Find
      'cmd+g', // Find next
      'cmd+shift+g', // Find previous
      'cmd+s', // Save
      'cmd+o', // Open
      'cmd+n', // New
      'cmd+p', // Print
    ];
    return macReserved.includes(normalized);
  }

  return false; // Windows/Linux have fewer system-level shortcuts
};

// Create command palette items from actions
export const createCommandPaletteItems = (
  actions: ShortcutAction[],
  commandHandlers: Record<string, () => void>,
  recentCommands?: string[]
): CommandPaletteItem[] => {
  return actions.map(action => {
    const isRecent = recentCommands?.includes(action.id) || false;

    return {
      id: action.id,
      title: action.name,
      description: action.description,
      category: action.category,
      action: commandHandlers[action.id] || (() => console.warn(`No handler for action: ${action.id}`)),
      shortcut: action.userKey || action.defaultKey,
      keywords: [
        action.name,
        action.description,
        action.category,
        ...(action.id.split('-'))
      ].filter(Boolean).map(k => k.toLowerCase())
    };
  });
};

// Save shortcut configuration to storage
export const saveShortcutConfig = async (config: ShortcutConfig): Promise<void> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ shortcutConfig: config });
    } else {
      localStorage.setItem('shortcutConfig', JSON.stringify(config));
    }
  } catch (error) {
    console.error('Failed to save shortcut config:', error);
  }
};

// Load shortcut configuration from storage
export const loadShortcutConfig = async (): Promise<ShortcutConfig | null> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('shortcutConfig');
      return result.shortcutConfig || null;
    } else {
      const stored = localStorage.getItem('shortcutConfig');
      return stored ? JSON.parse(stored) : null;
    }
  } catch (error) {
    console.error('Failed to load shortcut config:', error);
    return null;
  }
};

// Get default shortcut configuration
export const getDefaultShortcutConfig = (): ShortcutConfig => ({
  enabled: true,
  categories: [],
  userShortcuts: {}
});

// Merge user shortcuts with built-in shortcuts
export const mergeShortcuts = (
  builtIn: ShortcutAction[],
  userConfig: ShortcutConfig
): ShortcutAction[] => {
  return builtIn.map(shortcut => ({
    ...shortcut,
    userKey: userConfig.userShortcuts[shortcut.id],
    enabled: userConfig.categories
      .find(cat => cat.id === shortcut.category)
      ?.shortcuts.find(s => s.id === shortcut.id)?.enabled ?? shortcut.enabled
  }));
};

// Export shortcut configuration for sharing
export const exportShortcutConfig = (config: ShortcutConfig): string => {
  return JSON.stringify(config, null, 2);
};

// Import shortcut configuration
export const importShortcutConfig = (configJson: string): ShortcutConfig | null => {
  try {
    const config = JSON.parse(configJson);

    // Validate the configuration
    if (typeof config !== 'object' || !('enabled' in config) || !('userShortcuts' in config)) {
      throw new Error('Invalid shortcut configuration format');
    }

    return config as ShortcutConfig;
  } catch (error) {
    console.error('Failed to import shortcut config:', error);
    return null;
  }
};

// Reset shortcuts to defaults
export const resetShortcuts = async (): Promise<void> => {
  const defaultConfig = getDefaultShortcutConfig();
  await saveShortcutConfig(defaultConfig);
};

export default {
  parseShortcut,
  formatShortcut,
  getPlatform,
  normalizeShortcut,
  areShortcutsEqual,
  validateShortcut,
  isBrowserReserved,
  isSystemReserved,
  createCommandPaletteItems,
  saveShortcutConfig,
  loadShortcutConfig,
  getDefaultShortcutConfig,
  mergeShortcuts,
  exportShortcutConfig,
  importShortcutConfig,
  resetShortcuts
};