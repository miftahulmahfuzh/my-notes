export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'note' | 'search' | 'view' | 'text' | 'application';
  defaultKey: string;
  userKey?: string;
  enabled: boolean;
  global: boolean; // Whether shortcut works globally or only in specific contexts
}

export interface ShortcutCategory {
  id: string;
  name: string;
  description: string;
  shortcuts: ShortcutAction[];
}

export interface ShortcutConfig {
  enabled: boolean;
  categories: ShortcutCategory[];
  userShortcuts: Record<string, string>; // Custom key mappings
}

export interface CommandPaletteItem {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  category: string;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredItems: CommandPaletteItem[];
}

// Built-in shortcut definitions
export const BUILTIN_SHORTCUTS: ShortcutAction[] = [
  // Navigation shortcuts
  {
    id: 'command-palette',
    name: 'Command Palette',
    description: 'Open the command palette',
    category: 'navigation',
    defaultKey: 'ctrl+k',
    enabled: true,
    global: true
  },
  {
    id: 'move-up',
    name: 'Move Up',
    description: 'Move selection up in note list',
    category: 'navigation',
    defaultKey: 'j',
    enabled: true,
    global: false
  },
  {
    id: 'move-down',
    name: 'Move Down',
    description: 'Move selection down in note list',
    category: 'navigation',
    defaultKey: 'k',
    enabled: true,
    global: false
  },
  {
    id: 'open-note',
    name: 'Open Note',
    description: 'Open selected note',
    category: 'navigation',
    defaultKey: 'enter',
    enabled: true,
    global: false
  },
  {
    id: 'escape',
    name: 'Escape/Cancel',
    description: 'Close modal or cancel action',
    category: 'navigation',
    defaultKey: 'escape',
    enabled: true,
    global: true
  },

  // Note actions
  {
    id: 'new-note',
    name: 'New Note',
    description: 'Create a new note',
    category: 'note',
    defaultKey: 'n',
    enabled: true,
    global: false
  },
  {
    id: 'edit-note',
    name: 'Edit Note',
    description: 'Edit current note',
    category: 'note',
    defaultKey: 'e',
    enabled: true,
    global: false
  },
  {
    id: 'delete-note',
    name: 'Delete Note',
    description: 'Delete current note',
    category: 'note',
    defaultKey: 'd',
    enabled: true,
    global: false
  },
  {
    id: 'save-note',
    name: 'Save Note',
    description: 'Save current note',
    category: 'note',
    defaultKey: 'ctrl+s',
    enabled: true,
    global: true
  },
  {
    id: 'save-and-close',
    name: 'Save and Close',
    description: 'Save note and close editor',
    category: 'note',
    defaultKey: 'ctrl+enter',
    enabled: true,
    global: true
  },

  // Search and filter shortcuts
  {
    id: 'focus-search',
    name: 'Focus Search',
    description: 'Focus search bar',
    category: 'search',
    defaultKey: '/',
    enabled: true,
    global: false
  },
  {
    id: 'find-in-note',
    name: 'Find in Note',
    description: 'Find text within current note',
    category: 'search',
    defaultKey: 'ctrl+f',
    enabled: true,
    global: true
  },
  {
    id: 'open-tag-selector',
    name: 'Tag Selector',
    description: 'Open tag selector',
    category: 'search',
    defaultKey: 't',
    enabled: true,
    global: false
  },
  {
    id: 'quick-tag',
    name: 'Quick Tag',
    description: 'Quickly add a tag',
    category: 'search',
    defaultKey: '#',
    enabled: true,
    global: false
  },

  // View mode shortcuts
  {
    id: 'toggle-preview',
    name: 'Toggle Preview',
    description: 'Toggle markdown preview',
    category: 'view',
    defaultKey: 'p',
    enabled: true,
    global: true
  },
  {
    id: 'list-view',
    name: 'List View',
    description: 'Switch to list view',
    category: 'view',
    defaultKey: 'l',
    enabled: true,
    global: false
  },
  {
    id: 'go-to-tag',
    name: 'Go to Tag',
    description: 'Navigate to specific tag',
    category: 'view',
    defaultKey: 'g',
    enabled: true,
    global: false
  },
  {
    id: 'view-1',
    name: 'View Mode 1',
    description: 'Switch to first view mode',
    category: 'view',
    defaultKey: 'ctrl+1',
    enabled: true,
    global: true
  },
  {
    id: 'view-2',
    name: 'View Mode 2',
    description: 'Switch to second view mode',
    category: 'view',
    defaultKey: 'ctrl+2',
    enabled: true,
    global: true
  },
  {
    id: 'view-3',
    name: 'View Mode 3',
    description: 'Switch to third view mode',
    category: 'view',
    defaultKey: 'ctrl+3',
    enabled: true,
    global: true
  },

  // Text editing shortcuts
  {
    id: 'bold-text',
    name: 'Bold Text',
    description: 'Format selected text as bold',
    category: 'text',
    defaultKey: 'ctrl+b',
    enabled: true,
    global: true
  },
  {
    id: 'italic-text',
    name: 'Italic Text',
    description: 'Format selected text as italic',
    category: 'text',
    defaultKey: 'ctrl+i',
    enabled: true,
    global: true
  },
  {
    id: 'insert-link',
    name: 'Insert Link',
    description: 'Insert a link',
    category: 'text',
    defaultKey: 'ctrl+k',
    enabled: true,
    global: true
  },
  {
    id: 'insert-code-block',
    name: 'Insert Code Block',
    description: 'Insert a code block',
    category: 'text',
    defaultKey: 'ctrl+shift+c',
    enabled: true,
    global: true
  },
  {
    id: 'indent-list',
    name: 'Indent List Item',
    description: 'Indent current list item',
    category: 'text',
    defaultKey: 'tab',
    enabled: true,
    global: false
  },
  {
    id: 'outdent-list',
    name: 'Outdent List Item',
    description: 'Outdent current list item',
    category: 'text',
    defaultKey: 'shift+tab',
    enabled: true,
    global: false
  },

  // Application shortcuts
  {
    id: 'show-help',
    name: 'Show Help',
    description: 'Show keyboard shortcuts help',
    category: 'application',
    defaultKey: 'ctrl+/',
    enabled: true,
    global: true
  },
  {
    id: 'show-shortcuts',
    name: 'Show Shortcuts',
    description: 'Show keyboard shortcuts reference',
    category: 'application',
    defaultKey: 'ctrl+shift+/',
    enabled: true,
    global: true
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Toggle sidebar visibility',
    category: 'application',
    defaultKey: 'ctrl+b',
    enabled: true,
    global: true
  },
  {
    id: 'focus-editor',
    name: 'Focus Editor',
    description: 'Focus note editor',
    category: 'application',
    defaultKey: 'ctrl+shift+e',
    enabled: true,
    global: true
  }
];

// Shortcut categories
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Navigate through the application',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'navigation')
  },
  {
    id: 'note',
    name: 'Note Actions',
    description: 'Actions related to note management',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'note')
  },
  {
    id: 'search',
    name: 'Search & Filter',
    description: 'Search and filter functionality',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'search')
  },
  {
    id: 'view',
    name: 'View Modes',
    description: 'Switch between different view modes',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'view')
  },
  {
    id: 'text',
    name: 'Text Editing',
    description: 'Text formatting and editing shortcuts',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'text')
  },
  {
    id: 'application',
    name: 'Application',
    description: 'Global application shortcuts',
    shortcuts: BUILTIN_SHORTCUTS.filter(s => s.category === 'application')
  }
];

export default BUILTIN_SHORTCUTS;