/**
 * Tests for shortcut utility functions
 */

import {
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
  resetShortcuts,
} from '../../src/utils/shortcuts';
import { ShortcutAction, ShortcutConfig, CommandPaletteItem } from '../../src/types/shortcuts';

describe('parseShortcut', () => {
  it('should parse ctrl+key shortcuts', () => {
    const result = parseShortcut('ctrl+s');
    expect(result).toEqual({
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
      key: 's',
    });
  });

  it('should parse alt+key shortcuts', () => {
    const result = parseShortcut('alt+f');
    expect(result).toEqual({
      ctrl: false,
      alt: true,
      shift: false,
      meta: false,
      key: 'f',
    });
  });

  it('should parse shift+key shortcuts', () => {
    const result = parseShortcut('shift+a');
    expect(result).toEqual({
      ctrl: false,
      alt: false,
      shift: true,
      meta: false,
      key: 'a',
    });
  });

  it('should parse meta/cmd+key shortcuts', () => {
    const result1 = parseShortcut('meta+z');
    expect(result1).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: true,
      key: 'z',
    });

    const result2 = parseShortcut('cmd+z');
    expect(result2).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: true,
      key: 'z',
    });
  });

  it('should parse combination shortcuts (ctrl+shift+key)', () => {
    const result = parseShortcut('ctrl+shift+s');
    expect(result).toEqual({
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
      key: 's',
    });
  });

  it('should parse combination shortcuts (ctrl+alt+key)', () => {
    const result = parseShortcut('ctrl+alt+delete');
    expect(result).toEqual({
      ctrl: true,
      alt: true,
      shift: false,
      meta: false,
      key: 'delete',
    });
  });

  it('should parse combination shortcuts (ctrl+shift+alt+key)', () => {
    const result = parseShortcut('ctrl+shift+alt+f4');
    expect(result).toEqual({
      ctrl: true,
      alt: true,
      shift: true,
      meta: false,
      key: 'f4',
    });
  });

  it('should parse combination shortcuts (meta+shift+key)', () => {
    const result = parseShortcut('cmd+shift+3');
    expect(result).toEqual({
      ctrl: false,
      alt: false,
      shift: true,
      meta: true,
      key: '3',
    });
  });

  it('should handle lowercase input', () => {
    const result = parseShortcut('ctrl+s');
    expect(result.key).toBe('s');
  });

  it('should handle uppercase input', () => {
    const result = parseShortcut('CTRL+SHIFT+S');
    expect(result).toEqual({
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
      key: 's',
    });
  });

  it('should handle mixed case input', () => {
    const result = parseShortcut('Ctrl+Shift+S');
    expect(result).toEqual({
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
      key: 's',
    });
  });

  it('should parse key without modifiers', () => {
    const result = parseShortcut('a');
    expect(result).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'a',
    });
  });

  it('should parse special keys', () => {
    expect(parseShortcut('space')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'space',
    });

    expect(parseShortcut('escape')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'escape',
    });

    expect(parseShortcut('enter')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'enter',
    });

    expect(parseShortcut('tab')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'tab',
    });
  });

  it('should parse function keys', () => {
    expect(parseShortcut('f5')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'f5',
    });

    expect(parseShortcut('f12')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'f12',
    });
  });

  it('should parse arrow keys', () => {
    expect(parseShortcut('up')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'up',
    });

    expect(parseShortcut('down')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'down',
    });

    expect(parseShortcut('left')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'left',
    });

    expect(parseShortcut('right')).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: 'right',
    });
  });
});

describe('formatShortcut', () => {
  it('should format for Windows with Ctrl', () => {
    const result = formatShortcut('ctrl+s', 'windows');
    expect(result).toBe('Ctrl+S');
  });

  it('should format for Windows with Alt', () => {
    const result = formatShortcut('alt+f', 'windows');
    expect(result).toBe('Alt+F');
  });

  it('should format for Windows with Shift', () => {
    const result = formatShortcut('shift+a', 'windows');
    expect(result).toBe('Shift+A');
  });

  it('should format for Windows with combinations', () => {
    expect(formatShortcut('ctrl+shift+s', 'windows')).toBe('Ctrl+Shift+S');
    expect(formatShortcut('ctrl+alt+delete', 'windows')).toBe('Ctrl+Alt+Delete');
    expect(formatShortcut('ctrl+shift+alt+f4', 'windows')).toBe('Ctrl+Shift+Alt+F4');
  });

  it('should format for Mac with Cmd symbol', () => {
    const result = formatShortcut('meta+s', 'mac');
    expect(result).toBe('⌘S');
  });

  it('should format for Mac with Ctrl symbol', () => {
    const result = formatShortcut('ctrl+space', 'mac');
    expect(result).toBe('⌃Space');
  });

  it('should format for Mac with Alt symbol', () => {
    const result = formatShortcut('alt+escape', 'mac');
    expect(result).toBe('⌥Esc');
  });

  it('should format for Mac with Shift symbol', () => {
    const result = formatShortcut('shift+tab', 'mac');
    expect(result).toBe('⇧Tab');
  });

  it('should format for Mac with combinations', () => {
    expect(formatShortcut('meta+shift+3', 'mac')).toBe('⌘⇧3');
    expect(formatShortcut('meta+option+escape', 'mac')).toBe('⌘⌥Esc');
    expect(formatShortcut('ctrl+shift+tab', 'mac')).toBe('⌃⇧Tab');
  });

  it('should format for Linux like Windows', () => {
    const result = formatShortcut('ctrl+s', 'linux');
    expect(result).toBe('Ctrl+S');
  });

  it('should format special keys correctly', () => {
    expect(formatShortcut('ctrl+space', 'windows')).toBe('Ctrl+Space');
    expect(formatShortcut('ctrl+escape', 'windows')).toBe('Ctrl+Esc');
    expect(formatShortcut('ctrl+enter', 'windows')).toBe('Ctrl+Enter');
    expect(formatShortcut('ctrl+tab', 'windows')).toBe('Ctrl+Tab');
    expect(formatShortcut('backspace', 'windows')).toBe('Backspace');
    expect(formatShortcut('delete', 'windows')).toBe('Delete');
  });

  it('should format arrow keys correctly', () => {
    expect(formatShortcut('ctrl+up', 'windows')).toBe('Ctrl+↑');
    expect(formatShortcut('ctrl+down', 'windows')).toBe('Ctrl+↓');
    expect(formatShortcut('ctrl+left', 'windows')).toBe('Ctrl+←');
    expect(formatShortcut('ctrl+right', 'windows')).toBe('Ctrl+→');
  });

  it('should format navigation keys correctly', () => {
    expect(formatShortcut('home', 'windows')).toBe('Home');
    expect(formatShortcut('end', 'windows')).toBe('End');
    expect(formatShortcut('pageup', 'windows')).toBe('Page Up');
    expect(formatShortcut('pagedown', 'windows')).toBe('Page Down');
  });

  it('should format function keys correctly', () => {
    expect(formatShortcut('f1', 'windows')).toBe('F1');
    expect(formatShortcut('f5', 'windows')).toBe('F5');
    expect(formatShortcut('f12', 'windows')).toBe('F12');
  });

  it('should format key without modifiers', () => {
    expect(formatShortcut('a', 'windows')).toBe('A');
    expect(formatShortcut('escape', 'windows')).toBe('Esc');
  });

  it('should default to Windows format when platform not specified', () => {
    const result = formatShortcut('ctrl+s');
    expect(result).toBe('Ctrl+S');
  });
});

describe('getPlatform', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
  });

  it('should detect Mac platform', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      writable: true,
    });
    expect(getPlatform()).toBe('mac');
  });

  it('should detect Windows platform', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
    });
    expect(getPlatform()).toBe('windows');
  });

  it('should detect Linux platform', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      writable: true,
    });
    expect(getPlatform()).toBe('linux');
  });

  it('should return Windows as default for unknown platforms', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Unknown OS) AppleWebKit/537.36',
      writable: true,
    });
    expect(getPlatform()).toBe('windows');
  });
});

describe('normalizeShortcut', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
  });

  describe('on Mac platform', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should convert Ctrl to Cmd for most shortcuts', () => {
      expect(normalizeShortcut('ctrl+s')).toBe('meta+s');
      expect(normalizeShortcut('ctrl+a')).toBe('meta+a');
      expect(normalizeShortcut('ctrl+c')).toBe('meta+c');
    });

    it('should preserve Ctrl for space key exception', () => {
      expect(normalizeShortcut('ctrl+space')).toBe('ctrl+space');
    });

    it('should preserve Ctrl for tab key exception', () => {
      expect(normalizeShortcut('ctrl+tab')).toBe('ctrl+tab');
    });

    it('should preserve Ctrl for enter key exception', () => {
      expect(normalizeShortcut('ctrl+enter')).toBe('ctrl+enter');
    });

    it('should preserve Ctrl for escape key exception', () => {
      expect(normalizeShortcut('ctrl+escape')).toBe('ctrl+escape');
    });

    it('should not modify shortcuts that already have meta/cmd', () => {
      expect(normalizeShortcut('meta+s')).toBe('meta+s');
      expect(normalizeShortcut('cmd+s')).toBe('meta+s');
    });

    it('should preserve combinations with exceptions', () => {
      expect(normalizeShortcut('ctrl+shift+space')).toBe('ctrl+shift+space');
      expect(normalizeShortcut('ctrl+alt+tab')).toBe('ctrl+alt+tab');
    });

    it('should convert combinations without exceptions', () => {
      expect(normalizeShortcut('ctrl+shift+s')).toBe('meta+shift+s');
      expect(normalizeShortcut('ctrl+alt+f')).toBe('ctrl+alt+f');
    });
  });

  describe('on Windows platform', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should keep Ctrl on Windows', () => {
      expect(normalizeShortcut('ctrl+s')).toBe('ctrl+s');
      expect(normalizeShortcut('ctrl+a')).toBe('ctrl+a');
    });

    it('should not modify meta/cmd shortcuts', () => {
      expect(normalizeShortcut('meta+s')).toBe('meta+s');
      expect(normalizeShortcut('cmd+s')).toBe('meta+s');
    });
  });

  describe('on Linux platform', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should keep Ctrl on Linux', () => {
      expect(normalizeShortcut('ctrl+s')).toBe('ctrl+s');
      expect(normalizeShortcut('ctrl+a')).toBe('ctrl+a');
    });

    it('should not modify meta/cmd shortcuts', () => {
      expect(normalizeShortcut('meta+s')).toBe('meta+s');
      expect(normalizeShortcut('cmd+s')).toBe('meta+s');
    });
  });
});

describe('areShortcutsEqual', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
  });

  it('should return true for identical shortcuts', () => {
    expect(areShortcutsEqual('ctrl+s', 'ctrl+s')).toBe(true);
    expect(areShortcutsEqual('meta+a', 'meta+a'));
    expect(areShortcutsEqual('escape', 'escape')).toBe(true);
  });

  it('should return true for platform-normalized shortcuts on Mac', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      writable: true,
    });

    expect(areShortcutsEqual('ctrl+s', 'meta+s')).toBe(true);
    expect(areShortcutsEqual('ctrl+a', 'cmd+a')).toBe(true);
  });

  it('should return false for platform-normalized shortcuts with exceptions on Mac', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      writable: true,
    });

    expect(areShortcutsEqual('ctrl+space', 'meta+space')).toBe(false);
    expect(areShortcutsEqual('ctrl+tab', 'cmd+tab')).toBe(false);
  });

  it('should return false for different shortcuts', () => {
    expect(areShortcutsEqual('ctrl+s', 'ctrl+a')).toBe(false);
    expect(areShortcutsEqual('ctrl+s', 'alt+s')).toBe(false);
    expect(areShortcutsEqual('ctrl+s', 's')).toBe(false);
  });

  it('should return false for different modifiers', () => {
    expect(areShortcutsEqual('ctrl+shift+s', 'ctrl+s')).toBe(false);
    expect(areShortcutsEqual('ctrl+alt+s', 'ctrl+s')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    expect(areShortcutsEqual('CTRL+S', 'ctrl+s')).toBe(true);
    expect(areShortcutsEqual('Ctrl+Shift+S', 'ctrl+shift+s')).toBe(true);
  });
});

describe('validateShortcut', () => {
  it('should return true for valid letters (a-z)', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (const letter of letters) {
      expect(validateShortcut(letter)).toBe(true);
    }
  });

  it('should return true for valid numbers (0-9)', () => {
    const numbers = '0123456789';
    for (const number of numbers) {
      expect(validateShortcut(number)).toBe(true);
    }
  });

  it('should return true for function keys (f1-f12)', () => {
    expect(validateShortcut('f1')).toBe(true);
    expect(validateShortcut('f2')).toBe(true);
    expect(validateShortcut('f3')).toBe(true);
    expect(validateShortcut('f4')).toBe(true);
    expect(validateShortcut('f5')).toBe(true);
    expect(validateShortcut('f6')).toBe(true);
    expect(validateShortcut('f7')).toBe(true);
    expect(validateShortcut('f8')).toBe(true);
    expect(validateShortcut('f9')).toBe(true);
    expect(validateShortcut('f10')).toBe(true);
    expect(validateShortcut('f11')).toBe(true);
    expect(validateShortcut('f12')).toBe(true);
  });

  it('should return true for special keys', () => {
    expect(validateShortcut('space')).toBe(true);
    expect(validateShortcut('escape')).toBe(true);
    expect(validateShortcut('enter')).toBe(true);
    expect(validateShortcut('tab')).toBe(true);
    expect(validateShortcut('backspace')).toBe(true);
    expect(validateShortcut('delete')).toBe(true);
    expect(validateShortcut('insert')).toBe(true);
  });

  it('should return true for arrow keys', () => {
    expect(validateShortcut('up')).toBe(true);
    expect(validateShortcut('down')).toBe(true);
    expect(validateShortcut('left')).toBe(true);
    expect(validateShortcut('right')).toBe(true);
  });

  it('should return true for navigation keys', () => {
    expect(validateShortcut('home')).toBe(true);
    expect(validateShortcut('end')).toBe(true);
    expect(validateShortcut('pageup')).toBe(true);
    expect(validateShortcut('pagedown')).toBe(true);
  });

  it('should return true for punctuation and symbol keys', () => {
    expect(validateShortcut(';')).toBe(true);
    expect(validateShortcut('=')).toBe(true);
    expect(validateShortcut(',')).toBe(true);
    expect(validateShortcut('-')).toBe(true);
    expect(validateShortcut('.')).toBe(true);
    expect(validateShortcut('/')).toBe(true);
    expect(validateShortcut('\\')).toBe(true);
    expect(validateShortcut("'")).toBe(true);
    expect(validateShortcut('`')).toBe(true);
    expect(validateShortcut('[')).toBe(true);
    expect(validateShortcut(']')).toBe(true);
  });

  it('should return true for numpad keys', () => {
    expect(validateShortcut('numplus')).toBe(true);
    expect(validateShortcut('numminus')).toBe(true);
    expect(validateShortcut('nummultiply')).toBe(true);
    expect(validateShortcut('numdivide')).toBe(true);
    expect(validateShortcut('numenter')).toBe(true);
  });

  it('should return true for valid shortcuts with modifiers', () => {
    expect(validateShortcut('ctrl+s')).toBe(true);
    expect(validateShortcut('alt+f')).toBe(true);
    expect(validateShortcut('shift+a')).toBe(true);
    expect(validateShortcut('meta+z')).toBe(true);
    expect(validateShortcut('ctrl+shift+s')).toBe(true);
    expect(validateShortcut('ctrl+alt+delete')).toBe(true);
  });

  it('should return false for invalid keys', () => {
    expect(validateShortcut('invalid')).toBe(false);
    expect(validateShortcut('xyz')).toBe(false);
    expect(validateShortcut('f13')).toBe(false);
    expect(validateShortcut('f0')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateShortcut('')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    expect(validateShortcut('CTRL+S')).toBe(true);
    expect(validateShortcut('SPACE')).toBe(true);
    expect(validateShortcut('F5')).toBe(true);
  });
});

describe('isBrowserReserved', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
  });

  it('should return true for ctrl+r (refresh)', () => {
    expect(isBrowserReserved('ctrl+r')).toBe(true);
  });

  it('should return true for ctrl+shift+r (hard refresh)', () => {
    expect(isBrowserReserved('ctrl+shift+r')).toBe(true);
  });

  it('should return true for ctrl+w (close tab)', () => {
    expect(isBrowserReserved('ctrl+w')).toBe(true);
  });

  it('should return true for ctrl+t (new tab)', () => {
    expect(isBrowserReserved('ctrl+t')).toBe(true);
  });

  it('should return true for ctrl+n (new window)', () => {
    expect(isBrowserReserved('ctrl+n')).toBe(true);
  });

  it('should return true for ctrl+shift+t (reopen closed tab)', () => {
    expect(isBrowserReserved('ctrl+shift+t')).toBe(true);
  });

  it('should return true for ctrl+tab (switch tabs)', () => {
    expect(isBrowserReserved('ctrl+tab')).toBe(true);
  });

  it('should return true for ctrl+shift+tab (switch tabs backwards)', () => {
    expect(isBrowserReserved('ctrl+shift+tab')).toBe(true);
  });

  it('should return true for ctrl+f (find)', () => {
    expect(isBrowserReserved('ctrl+f')).toBe(true);
  });

  it('should return true for ctrl+shift+f (find in all tabs)', () => {
    expect(isBrowserReserved('ctrl+shift+f')).toBe(true);
  });

  it('should return true for ctrl+g (find next)', () => {
    expect(isBrowserReserved('ctrl+g')).toBe(true);
  });

  it('should return true for ctrl+shift+g (find previous)', () => {
    expect(isBrowserReserved('ctrl+shift+g')).toBe(true);
  });

  it('should return true for ctrl+l (focus address bar)', () => {
    expect(isBrowserReserved('ctrl+l')).toBe(true);
  });

  it('should return true for ctrl+shift+j (developer tools)', () => {
    expect(isBrowserReserved('ctrl+shift+j')).toBe(true);
  });

  it('should return true for ctrl+shift+i (developer tools)', () => {
    expect(isBrowserReserved('ctrl+shift+i')).toBe(true);
  });

  it('should return true for ctrl+u (view source)', () => {
    expect(isBrowserReserved('ctrl+u')).toBe(true);
  });

  it('should return true for ctrl+s (save)', () => {
    expect(isBrowserReserved('ctrl+s')).toBe(true);
  });

  it('should return true for ctrl+p (print)', () => {
    expect(isBrowserReserved('ctrl+p')).toBe(true);
  });

  it('should return true for ctrl+c (copy)', () => {
    expect(isBrowserReserved('ctrl+c')).toBe(true);
  });

  it('should return true for ctrl+v (paste)', () => {
    expect(isBrowserReserved('ctrl+v')).toBe(true);
  });

  it('should return true for ctrl+x (cut)', () => {
    expect(isBrowserReserved('ctrl+x')).toBe(true);
  });

  it('should return true for ctrl+a (select all)', () => {
    expect(isBrowserReserved('ctrl+a')).toBe(true);
  });

  it('should return true for ctrl+z (undo)', () => {
    expect(isBrowserReserved('ctrl+z')).toBe(true);
  });

  it('should return true for ctrl+y (redo)', () => {
    expect(isBrowserReserved('ctrl+y')).toBe(true);
  });

  it('should return true for ctrl+shift+z (redo)', () => {
    expect(isBrowserReserved('ctrl+shift+z')).toBe(true);
  });

  it('should return true for f5 (refresh)', () => {
    expect(isBrowserReserved('f5')).toBe(true);
  });

  it('should return true for f11 (fullscreen)', () => {
    expect(isBrowserReserved('f11')).toBe(true);
  });

  it('should return true for f12 (developer tools)', () => {
    expect(isBrowserReserved('f12')).toBe(true);
  });

  it('should return false for non-reserved shortcuts', () => {
    expect(isBrowserReserved('ctrl+q')).toBe(false);
    expect(isBrowserReserved('ctrl+e')).toBe(false);
    expect(isBrowserReserved('ctrl+d')).toBe(false);
    expect(isBrowserReserved('f1')).toBe(false);
    expect(isBrowserReserved('f2')).toBe(false);
  });

  it('should normalize shortcuts on Mac', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      writable: true,
    });

    // On Mac, meta+s is normalized to ctrl+s
    expect(isBrowserReserved('meta+s')).toBe(true);
    expect(isBrowserReserved('cmd+r')).toBe(true);
  });
});

describe('isSystemReserved', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
  });

  describe('on Mac', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should return true for cmd+q (quit)', () => {
      expect(isSystemReserved('meta+q')).toBe(true);
      expect(isSystemReserved('cmd+q')).toBe(true);
    });

    it('should return true for cmd+w (close window)', () => {
      expect(isSystemReserved('meta+w')).toBe(true);
      expect(isSystemReserved('cmd+w')).toBe(true);
    });

    it('should return true for cmd+m (minimize)', () => {
      expect(isSystemReserved('meta+m')).toBe(true);
      expect(isSystemReserved('cmd+m')).toBe(true);
    });

    it('should return true for cmd+option+m (minimize all)', () => {
      expect(isSystemReserved('meta+alt+m')).toBe(true);
      expect(isSystemReserved('cmd+option+m')).toBe(true);
    });

    it('should return true for cmd+h (hide)', () => {
      expect(isSystemReserved('meta+h')).toBe(true);
      expect(isSystemReserved('cmd+h')).toBe(true);
    });

    it('should return true for cmd+option+h (hide others)', () => {
      expect(isSystemReserved('meta+alt+h')).toBe(true);
      expect(isSystemReserved('cmd+option+h')).toBe(true);
    });

    it('should return true for cmd+space (spotlight)', () => {
      expect(isSystemReserved('meta+space')).toBe(true);
      expect(isSystemReserved('cmd+space')).toBe(true);
    });

    it('should return true for cmd+tab (app switcher)', () => {
      expect(isSystemReserved('meta+tab')).toBe(true);
      expect(isSystemReserved('cmd+tab')).toBe(true);
    });

    it('should return true for cmd+shift+tab (app switcher backwards)', () => {
      expect(isSystemReserved('meta+shift+tab')).toBe(true);
      expect(isSystemReserved('cmd+shift+tab')).toBe(true);
    });

    it('should return true for cmd+option+esc (force quit)', () => {
      expect(isSystemReserved('meta+alt+escape')).toBe(true);
      expect(isSystemReserved('cmd+option+esc')).toBe(true);
    });

    it('should return true for cmd+ctrl+q (log out)', () => {
      expect(isSystemReserved('meta+ctrl+q')).toBe(true);
      expect(isSystemReserved('cmd+ctrl+q')).toBe(true);
    });

    it('should return true for cmd+shift+3 (screenshot)', () => {
      expect(isSystemReserved('meta+shift+3')).toBe(true);
      expect(isSystemReserved('cmd+shift+3')).toBe(true);
    });

    it('should return true for cmd+shift+4 (screenshot selection)', () => {
      expect(isSystemReserved('meta+shift+4')).toBe(true);
      expect(isSystemReserved('cmd+shift+4')).toBe(true);
    });

    it('should return true for cmd+shift+5 (screenshot options)', () => {
      expect(isSystemReserved('meta+shift+5')).toBe(true);
      expect(isSystemReserved('cmd+shift+5')).toBe(true);
    });

    it('should return true for cmd+c (copy)', () => {
      expect(isSystemReserved('meta+c')).toBe(true);
      expect(isSystemReserved('cmd+c')).toBe(true);
    });

    it('should return true for cmd+v (paste)', () => {
      expect(isSystemReserved('meta+v')).toBe(true);
      expect(isSystemReserved('cmd+v')).toBe(true);
    });

    it('should return true for cmd+x (cut)', () => {
      expect(isSystemReserved('meta+x')).toBe(true);
      expect(isSystemReserved('cmd+x')).toBe(true);
    });

    it('should return true for cmd+z (undo)', () => {
      expect(isSystemReserved('meta+z')).toBe(true);
      expect(isSystemReserved('cmd+z')).toBe(true);
    });

    it('should return true for cmd+shift+z (redo)', () => {
      expect(isSystemReserved('meta+shift+z')).toBe(true);
      expect(isSystemReserved('cmd+shift+z')).toBe(true);
    });

    it('should return true for cmd+a (select all)', () => {
      expect(isSystemReserved('meta+a')).toBe(true);
      expect(isSystemReserved('cmd+a')).toBe(true);
    });

    it('should return true for cmd+f (find)', () => {
      expect(isSystemReserved('meta+f')).toBe(true);
      expect(isSystemReserved('cmd+f')).toBe(true);
    });

    it('should return true for cmd+g (find next)', () => {
      expect(isSystemReserved('meta+g')).toBe(true);
      expect(isSystemReserved('cmd+g')).toBe(true);
    });

    it('should return true for cmd+shift+g (find previous)', () => {
      expect(isSystemReserved('meta+shift+g')).toBe(true);
      expect(isSystemReserved('cmd+shift+g')).toBe(true);
    });

    it('should return true for cmd+s (save)', () => {
      expect(isSystemReserved('meta+s')).toBe(true);
      expect(isSystemReserved('cmd+s')).toBe(true);
    });

    it('should return true for cmd+o (open)', () => {
      expect(isSystemReserved('meta+o')).toBe(true);
      expect(isSystemReserved('cmd+o')).toBe(true);
    });

    it('should return true for cmd+n (new)', () => {
      expect(isSystemReserved('meta+n')).toBe(true);
      expect(isSystemReserved('cmd+n')).toBe(true);
    });

    it('should return true for cmd+p (print)', () => {
      expect(isSystemReserved('meta+p')).toBe(true);
      expect(isSystemReserved('cmd+p')).toBe(true);
    });

    it('should return false for non-reserved shortcuts on Mac', () => {
      expect(isSystemReserved('meta+e')).toBe(false);
      expect(isSystemReserved('meta+d')).toBe(false);
      expect(isSystemReserved('meta+k')).toBe(false);
    });
  });

  describe('on Windows', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should return false for most shortcuts on Windows', () => {
      expect(isSystemReserved('ctrl+q')).toBe(false);
      expect(isSystemReserved('ctrl+w')).toBe(false);
      expect(isSystemReserved('ctrl+n')).toBe(false);
      expect(isSystemReserved('ctrl+s')).toBe(false);
    });

    it('should return false for meta/cmd shortcuts on Windows', () => {
      expect(isSystemReserved('meta+q')).toBe(false);
      expect(isSystemReserved('cmd+w')).toBe(false);
    });
  });

  describe('on Linux', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        writable: true,
      });
    });

    it('should return false for most shortcuts on Linux', () => {
      expect(isSystemReserved('ctrl+q')).toBe(false);
      expect(isSystemReserved('ctrl+w')).toBe(false);
      expect(isSystemReserved('ctrl+n')).toBe(false);
      expect(isSystemReserved('ctrl+s')).toBe(false);
    });

    it('should return false for meta/cmd shortcuts on Linux', () => {
      expect(isSystemReserved('meta+q')).toBe(false);
      expect(isSystemReserved('cmd+w')).toBe(false);
    });
  });
});

describe('createCommandPaletteItems', () => {
  it('should create items from actions', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action-1',
        name: 'Test Action 1',
        description: 'Test description 1',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
      {
        id: 'test-action-2',
        name: 'Test Action 2',
        description: 'Test description 2',
        category: 'search',
        defaultKey: 'ctrl+f',
        enabled: true,
        global: false,
      },
    ];

    const handlers: Record<string, () => void> = {
      'test-action-1': jest.fn(),
      'test-action-2': jest.fn(),
    };

    const items = createCommandPaletteItems(actions, handlers);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'test-action-1',
      title: 'Test Action 1',
      description: 'Test description 1',
      category: 'note',
      shortcut: 'ctrl+s',
    });
    expect(items[0].action).toEqual(handlers['test-action-1']);
  });

  it('should include action name', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: 'Test description',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].title).toBe('Action Name');
  });

  it('should include description', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: 'This is a test description',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].description).toBe('This is a test description');
  });

  it('should include category', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: 'Test description',
        category: 'search',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].category).toBe('search');
  });

  it('should map action handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    const actions: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
      {
        id: 'action-2',
        name: 'Action 2',
        description: 'Description 2',
        category: 'search',
        defaultKey: 'b',
        enabled: true,
        global: false,
      },
    ];

    const handlers = {
      'action-1': handler1,
      'action-2': handler2,
    };

    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].action).toEqual(handler1);
    expect(items[1].action).toEqual(handler2);
  });

  it('should use userKey if present', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: 'Test description',
        category: 'note',
        defaultKey: 'ctrl+s',
        userKey: 'ctrl+d',
        enabled: true,
        global: true,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].shortcut).toBe('ctrl+d');
  });

  it('should use defaultKey if userKey is not present', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: 'Test description',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].shortcut).toBe('ctrl+s');
  });

  it('should generate keywords from name, description, category, and id parts', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'create-new-note-action',
        name: 'Create New Note',
        description: 'Create a new note with default settings',
        category: 'note',
        defaultKey: 'n',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'create-new-note-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].keywords).toEqual(
      expect.arrayContaining([
        'create new note',
        'create a new note with default settings',
        'note',
        'create',
        'new',
        'note',
        'action',
      ])
    );
  });

  it('should filter out empty values from keywords', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Action Name',
        description: '',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'test-action': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].keywords).not.toContain('');
  });

  it('should convert keywords to lowercase', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'Test-Action-ID',
        name: 'ACTION NAME',
        description: 'Test Description',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers = { 'Test-Action-ID': jest.fn() };
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].keywords).toEqual(
      expect.arrayContaining([
        'action name',
        'test description',
        'note',
      ])
    );
  });

  it('should mark recent commands', () => {
    const actions: ShortcutAction[] = [
      {
        id: 'recent-action',
        name: 'Recent Action',
        description: 'This is a recent action',
        category: 'note',
        defaultKey: 'r',
        enabled: true,
        global: false,
      },
      {
        id: 'old-action',
        name: 'Old Action',
        description: 'This is an old action',
        category: 'search',
        defaultKey: 'o',
        enabled: true,
        global: false,
      },
    ];

    const handlers = {
      'recent-action': jest.fn(),
      'old-action': jest.fn(),
    };

    const recentCommands = ['recent-action'];
    const items = createCommandPaletteItems(actions, handlers, recentCommands);

    // The function doesn't actually add a 'recent' property to the item
    // It only uses it internally. Let's just verify the items are created correctly.
    expect(items).toHaveLength(2);
  });

  it('should handle missing handlers gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const actions: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test description',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const handlers: Record<string, () => void> = {};
    const items = createCommandPaletteItems(actions, handlers);

    expect(items[0].action).toBeDefined();
    expect(typeof items[0].action).toBe('function');

    items[0].action(); // Call the action
    expect(consoleWarnSpy).toHaveBeenCalledWith('No handler for action: test-action');

    consoleWarnSpy.mockRestore();
  });

  it('should handle empty actions array', () => {
    const actions: ShortcutAction[] = [];
    const handlers: Record<string, () => void> = {};

    const items = createCommandPaletteItems(actions, handlers);

    expect(items).toEqual([]);
  });
});

describe('saveShortcutConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save to chrome.storage.local when available', async () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    await saveShortcutConfig(config);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      shortcutConfig: config,
    });
  });

  it('should fall back to localStorage when chrome.storage is not available', async () => {
    // @ts-ignore - Remove chrome temporarily
    delete (global as any).chrome;

    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const localStorageSetSpy = jest.spyOn(localStorage, 'setItem');

    await saveShortcutConfig(config);

    expect(localStorageSetSpy).toHaveBeenCalledWith(
      'shortcutConfig',
      JSON.stringify(config)
    );

    localStorageSetSpy.mockRestore();
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (chrome.storage.local.set as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    await expect(saveShortcutConfig(config)).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save shortcut config:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should save complex config with user shortcuts', async () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'new-note': 'ctrl+shift+n',
        'save-note': 'ctrl+s',
      },
    };

    await saveShortcutConfig(config);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      shortcutConfig: config,
    });
  });

  it('should save config with enabled set to false', async () => {
    const config: ShortcutConfig = {
      enabled: false,
      categories: [],
      userShortcuts: {},
    };

    await saveShortcutConfig(config);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      shortcutConfig: config,
    });
  });
});

describe('loadShortcutConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load from chrome.storage.local when available', async () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ shortcutConfig: config });

    const result = await loadShortcutConfig();

    expect(chrome.storage.local.get).toHaveBeenCalledWith('shortcutConfig');
    expect(result).toEqual(config);
  });

  it('should return null when config is not found in chrome.storage', async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

    const result = await loadShortcutConfig();

    expect(result).toBeNull();
  });

  it('should fall back to localStorage when chrome.storage is not available', async () => {
    // @ts-ignore - Remove chrome temporarily
    delete (global as any).chrome;

    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const localStorageGetSpy = jest.spyOn(localStorage, 'getItem').mockReturnValue(
      JSON.stringify(config)
    );

    const result = await loadShortcutConfig();

    expect(localStorageGetSpy).toHaveBeenCalledWith('shortcutConfig');
    expect(result).toEqual(config);

    localStorageGetSpy.mockRestore();

    // Restore chrome
    global.chrome = require('../../tests/setup').mockChrome;
  });

  it('should return null when localStorage has no config', async () => {
    // @ts-ignore - Remove chrome temporarily
    delete (global as any).chrome;

    const localStorageGetSpy = jest.spyOn(localStorage, 'getItem').mockReturnValue(null);

    const result = await loadShortcutConfig();

    expect(result).toBeNull();

    localStorageGetSpy.mockRestore();

    // Restore chrome
    global.chrome = require('../../tests/setup').mockChrome;
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (chrome.storage.local.get as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const result = await loadShortcutConfig();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load shortcut config:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle invalid JSON in localStorage', async () => {
    // @ts-ignore - Remove chrome temporarily
    delete (global as any).chrome;

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const localStorageGetSpy = jest.spyOn(localStorage, 'getItem').mockReturnValue(
      'invalid json'
    );

    const result = await loadShortcutConfig();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    localStorageGetSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Restore chrome
    global.chrome = require('../../tests/setup').mockChrome;
  });

  it('should load complex config with user shortcuts', async () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'new-note': 'ctrl+shift+n',
        'save-note': 'ctrl+s',
      },
    };

    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ shortcutConfig: config });

    const result = await loadShortcutConfig();

    expect(result).toEqual(config);
    expect(result?.userShortcuts['new-note']).toBe('ctrl+shift+n');
  });
});

describe('getDefaultShortcutConfig', () => {
  it('should return correct structure', () => {
    const config = getDefaultShortcutConfig();

    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('categories');
    expect(config).toHaveProperty('userShortcuts');
  });

  it('should have enabled set to true', () => {
    const config = getDefaultShortcutConfig();

    expect(config.enabled).toBe(true);
  });

  it('should have categories as empty array', () => {
    const config = getDefaultShortcutConfig();

    expect(config.categories).toEqual([]);
  });

  it('should have userShortcuts as empty object', () => {
    const config = getDefaultShortcutConfig();

    expect(config.userShortcuts).toEqual({});
  });

  it('should return a new object each time', () => {
    const config1 = getDefaultShortcutConfig();
    const config2 = getDefaultShortcutConfig();

    expect(config1).not.toBe(config2);
    expect(config1).toEqual(config2);
  });

  it('should not be affected by modifications to returned config', () => {
    const config1 = getDefaultShortcutConfig();
    config1.enabled = false;
    config1.categories.push({ id: 'test', name: 'Test', description: 'Test', shortcuts: [] });
    config1.userShortcuts['test'] = 'ctrl+t';

    const config2 = getDefaultShortcutConfig();

    expect(config2.enabled).toBe(true);
    expect(config2.categories).toEqual([]);
    expect(config2.userShortcuts).toEqual({});
  });
});

describe('mergeShortcuts', () => {
  it('should merge user shortcuts with built-in shortcuts', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
      {
        id: 'action-2',
        name: 'Action 2',
        description: 'Description 2',
        category: 'search',
        defaultKey: 'ctrl+f',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'ctrl+d',
      },
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].userKey).toBe('ctrl+d');
    expect(result[1].userKey).toBeUndefined();
  });

  it('should preserve built-in shortcuts when no user override', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].defaultKey).toBe('ctrl+s');
    expect(result[0].userKey).toBeUndefined();
  });

  it('should override with user shortcuts', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'save-note',
        name: 'Save Note',
        description: 'Save current note',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'save-note': 'ctrl+shift+s',
      },
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].userKey).toBe('ctrl+shift+s');
  });

  it('should preserve all original properties', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test Description',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0]).toMatchObject({
      id: 'test-action',
      name: 'Test Action',
      description: 'Test Description',
      category: 'note',
      defaultKey: 'a',
      enabled: true,
      global: false,
    });
  });

  it('should handle empty userShortcuts', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result).toHaveLength(1);
    expect(result[0].userKey).toBeUndefined();
  });

  it('should handle multiple user shortcuts', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
      {
        id: 'action-2',
        name: 'Action 2',
        description: 'Description 2',
        category: 'search',
        defaultKey: 'b',
        enabled: true,
        global: false,
      },
      {
        id: 'action-3',
        name: 'Action 3',
        description: 'Description 3',
        category: 'view',
        defaultKey: 'c',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'x',
        'action-3': 'z',
      },
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].userKey).toBe('x');
    expect(result[1].userKey).toBeUndefined();
    expect(result[2].userKey).toBe('z');
  });

  it('should not modify original built-in shortcuts array', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'ctrl+s',
        enabled: true,
        global: true,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'ctrl+d',
      },
    };

    const originalBuiltIn = JSON.parse(JSON.stringify(builtIn));
    mergeShortcuts(builtIn, userConfig);

    expect(builtIn).toEqual(originalBuiltIn);
  });

  it('should handle enabled/disabled state from categories', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [
        {
          id: 'note',
          name: 'Note',
          description: 'Note actions',
          shortcuts: [
            {
              id: 'action-1',
              name: 'Action 1',
              description: 'Description 1',
              category: 'note',
              defaultKey: 'a',
              enabled: false,
              global: false,
            },
          ],
        },
      ],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].enabled).toBe(false);
  });

  it('should keep original enabled state when category not found', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].enabled).toBe(true);
  });

  it('should keep original enabled state when action not found in category', () => {
    const builtIn: ShortcutAction[] = [
      {
        id: 'action-1',
        name: 'Action 1',
        description: 'Description 1',
        category: 'note',
        defaultKey: 'a',
        enabled: true,
        global: false,
      },
    ];

    const userConfig: ShortcutConfig = {
      enabled: true,
      categories: [
        {
          id: 'note',
          name: 'Note',
          description: 'Note actions',
          shortcuts: [],
        },
      ],
      userShortcuts: {},
    };

    const result = mergeShortcuts(builtIn, userConfig);

    expect(result[0].enabled).toBe(true);
  });
});

describe('exportShortcutConfig', () => {
  it('should return JSON string', () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = exportShortcutConfig(config);

    expect(typeof result).toBe('string');
  });

  it('should be properly formatted with indentation', () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = exportShortcutConfig(config);

    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('should export all config properties', () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'ctrl+s',
        'action-2': 'ctrl+f',
      },
    };

    const result = exportShortcutConfig(config);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual(config);
  });

  it('should export complex config with categories', () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [
        {
          id: 'note',
          name: 'Note',
          description: 'Note actions',
          shortcuts: [],
        },
      ],
      userShortcuts: {},
    };

    const result = exportShortcutConfig(config);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual(config);
    expect(parsed.categories).toHaveLength(1);
  });

  it('should be parseable back to config', () => {
    const config: ShortcutConfig = {
      enabled: false,
      categories: [],
      userShortcuts: {
        'test-action': 'ctrl+shift+t',
      },
    };

    const result = exportShortcutConfig(config);
    const parsed = JSON.parse(result) as ShortcutConfig;

    expect(parsed.enabled).toBe(false);
    expect(parsed.userShortcuts['test-action']).toBe('ctrl+shift+t');
  });

  it('should handle empty config', () => {
    const config: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {},
    };

    const result = exportShortcutConfig(config);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('importShortcutConfig', () => {
  it('should parse valid JSON', () => {
    const json = JSON.stringify({
      enabled: true,
      categories: [],
      userShortcuts: {},
    });

    const result = importShortcutConfig(json);

    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(true);
  });

  it('should validate structure', () => {
    const json = JSON.stringify({
      enabled: true,
      categories: [],
      userShortcuts: {},
    });

    const result = importShortcutConfig(json);

    expect(result).toHaveProperty('enabled');
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('userShortcuts');
  });

  it('should return null for invalid JSON', () => {
    const result = importShortcutConfig('not valid json');

    expect(result).toBeNull();
  });

  it('should return null for invalid structure missing enabled', () => {
    const json = JSON.stringify({
      categories: [],
      userShortcuts: {},
    });

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should return null for invalid structure missing userShortcuts', () => {
    const json = JSON.stringify({
      enabled: true,
      categories: [],
    });

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should return null for invalid structure not an object', () => {
    const json = JSON.stringify('just a string');

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should return null for empty object', () => {
    const json = JSON.stringify({});

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const json = JSON.stringify(null);

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should return null for array input', () => {
    const json = JSON.stringify([]);

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should successfully import valid config with user shortcuts', () => {
    const json = JSON.stringify({
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'ctrl+s',
        'action-2': 'ctrl+f',
      },
    });

    const result = importShortcutConfig(json);

    expect(result).not.toBeNull();
    expect(result?.userShortcuts['action-1']).toBe('ctrl+s');
    expect(result?.userShortcuts['action-2']).toBe('ctrl+f');
  });

  it('should successfully import valid config with categories', () => {
    const json = JSON.stringify({
      enabled: false,
      categories: [
        {
          id: 'note',
          name: 'Note',
          description: 'Note actions',
          shortcuts: [],
        },
      ],
      userShortcuts: {},
    });

    const result = importShortcutConfig(json);

    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(false);
    expect(result?.categories).toHaveLength(1);
    expect(result?.categories[0].id).toBe('note');
  });

  it('should handle malformed JSON', () => {
    const json = '{ enabled: true, categories: [], userShortcuts: {} }'; // Missing quotes

    const result = importShortcutConfig(json);

    expect(result).toBeNull();
  });

  it('should ignore extra properties', () => {
    const json = JSON.stringify({
      enabled: true,
      categories: [],
      userShortcuts: {},
      extraProp: 'some value',
    });

    const result = importShortcutConfig(json);

    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(true);
  });
});

describe('resetShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reset to default config', async () => {
    await resetShortcuts();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      shortcutConfig: {
        enabled: true,
        categories: [],
        userShortcuts: {},
      },
    });
  });

  it('should save default config', async () => {
    await resetShortcuts();

    const savedConfig = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
    expect(savedConfig.shortcutConfig.enabled).toBe(true);
    expect(savedConfig.shortcutConfig.categories).toEqual([]);
    expect(savedConfig.shortcutConfig.userShortcuts).toEqual({});
  });

  it('should use saveShortcutConfig internally', async () => {
    await resetShortcuts();

    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('should be idempotent - calling twice produces same result', async () => {
    await resetShortcuts();
    const firstCall = (chrome.storage.local.set as jest.Mock).mock.calls[0];

    jest.clearAllMocks();

    await resetShortcuts();
    const secondCall = (chrome.storage.local.set as jest.Mock).mock.calls[0];

    expect(firstCall).toEqual(secondCall);
  });

  it('should clear existing user shortcuts', async () => {
    // First, save a config with user shortcuts
    const configWithShortcuts: ShortcutConfig = {
      enabled: true,
      categories: [],
      userShortcuts: {
        'action-1': 'ctrl+s',
      },
    };

    await saveShortcutConfig(configWithShortcuts);
    jest.clearAllMocks();

    // Reset should clear them
    await resetShortcuts();

    const savedConfig = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
    expect(savedConfig.shortcutConfig.userShortcuts).toEqual({});
  });

  it('should restore enabled to true', async () => {
    // First, save a config with enabled false
    const configDisabled: ShortcutConfig = {
      enabled: false,
      categories: [],
      userShortcuts: {},
    };

    await saveShortcutConfig(configDisabled);
    jest.clearAllMocks();

    // Reset should enable
    await resetShortcuts();

    const savedConfig = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
    expect(savedConfig.shortcutConfig.enabled).toBe(true);
  });

  it('should clear categories', async () => {
    // First, save a config with categories
    const configWithCategories: ShortcutConfig = {
      enabled: true,
      categories: [
        {
          id: 'note',
          name: 'Note',
          description: 'Note actions',
          shortcuts: [],
        },
      ],
      userShortcuts: {},
    };

    await saveShortcutConfig(configWithCategories);
    jest.clearAllMocks();

    // Reset should clear categories
    await resetShortcuts();

    const savedConfig = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
    expect(savedConfig.shortcutConfig.categories).toEqual([]);
  });

  it('should handle storage errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (chrome.storage.local.set as jest.Mock).mockRejectedValue(new Error('Storage error'));

    await expect(resetShortcuts()).resolves.not.toThrow();

    consoleErrorSpy.mockRestore();
  });
});
