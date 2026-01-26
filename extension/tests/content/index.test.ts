/**
 * Tests for Content Script
 * Comprehensive test coverage for content script functionality
 */

// Mock Chrome API before importing the module
const mockAddListener = jest.fn();
const mockSendResponse = jest.fn();

const mockChrome = {
  runtime: {
    onMessage: {
      addListener: mockAddListener,
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
};

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;

beforeAll(() => {
  console.log = jest.fn();

  // Extend the global chrome object
  // @ts-ignore
  global.chrome = mockChrome;

  // Mock window.location
  // @ts-ignore
  window.location = {
    href: 'https://example.com',
  };

  // @ts-ignore
  global.window = global.window || {};
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Content Script', () => {
  let messageHandler: (message: any, sender: any, sendResponse: jest.Mock) => boolean;
  let mockSender: { tab: { id: number }; url: string };
  let mockGetSelection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock getSelection
    mockGetSelection = jest.fn();
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: mockGetSelection,
    });

    // Setup document.title
    Object.defineProperty(document, 'title', {
      writable: true,
      value: '',
    });

    // Reset document.title and window.location.href
    document.title = 'Test Page Title';
    // @ts-ignore
    window.location.href = 'https://example.com/test-page';

    // Reset getSelection mock
    mockGetSelection.mockReturnValue({
      toString: () => 'selected text',
    });

    // Initialize mock sender
    mockSender = {
      tab: { id: 1 },
      url: 'https://example.com/test-page',
    };

    // Capture the registered message handler
    // @ts-ignore
    mockAddListener.mockImplementation((callback) => {
      messageHandler = callback;
    });

    // Import the module to register the listener
    jest.isolateModules(() => {
      require('../../src/content/index');
    });

    // Verify the listener was registered
    expect(mockAddListener).toHaveBeenCalled();
    expect(messageHandler).toBeDefined();
  });

  // ============================================================================
  // Message Listener Registration Tests
  // ============================================================================

  describe('Message Listener Registration', () => {
    test('registers message listener on startup', () => {
      expect(mockAddListener).toHaveBeenCalledTimes(1);
      expect(typeof messageHandler).toBe('function');
    });

    test('returns true to indicate async response', () => {
      const result = messageHandler({ type: 'HIGHLIGHT_TEXT', text: 'test' }, mockSender, mockSendResponse);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // HIGHLIGHT_TEXT Message Handler Tests
  // ============================================================================

  describe('HIGHLIGHT_TEXT Message Handler', () => {
    test('handles HIGHLIGHT_TEXT message with text', () => {
      const message = {
        type: 'HIGHLIGHT_TEXT',
        text: 'example text',
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('handles HIGHLIGHT_TEXT message with empty text', () => {
      const message = {
        type: 'HIGHLIGHT_TEXT',
        text: '',
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('handles HIGHLIGHT_TEXT message without text property', () => {
      const message = {
        type: 'HIGHLIGHT_TEXT',
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('returns success response for HIGHLIGHT_TEXT', () => {
      const message = {
        type: 'HIGHLIGHT_TEXT',
        text: 'highlight me',
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledTimes(1);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  // ============================================================================
  // GET_PAGE_INFO Message Handler Tests
  // ============================================================================

  describe('GET_PAGE_INFO Message Handler', () => {
    beforeEach(() => {
      document.title = 'Test Page Title';
      // @ts-ignore
    window.location.href = 'https://example.com/test-page';
      mockGetSelection.mockReturnValue({
        toString: () => 'selected text',
      });
    });

    test('extracts page title', () => {
      const message = { type: 'GET_PAGE_INFO' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Page Title',
        })
      );
    });

    test('extracts page URL', () => {
      const message = { type: 'GET_PAGE_INFO' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/test-page',
        })
      );
    });

    test('extracts text selection', () => {
      const message = { type: 'GET_PAGE_INFO' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          selection: 'selected text',
        })
      );
    });

    test('returns complete page info with all fields', () => {
      const message = { type: 'GET_PAGE_INFO' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles page info with different title', () => {
      document.title = 'Different Page Title';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Different Page Title',
        })
      );
    });

    test('handles page info with different URL', () => {
      // @ts-ignore
      window.location.href = 'https://different.com/page';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://different.com/page',
        })
      );
    });

    test('handles page info with different selection', () => {
      mockGetSelection.mockReturnValue({
        toString: () => 'different selection',
      });

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          selection: 'different selection',
        })
      );
    });
  });

  // ============================================================================
  // Unknown Message Type Tests
  // ============================================================================

  describe('Unknown Message Type Handler', () => {
    test('handles unknown message type', () => {
      const message = { type: 'UNKNOWN_TYPE' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Unknown message type' });
    });

    test('handles message with no type', () => {
      const message = {};

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Unknown message type' });
    });

    test('handles message with null type', () => {
      const message = { type: null };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Unknown message type' });
    });

    test('handles message with undefined type', () => {
      const message = { type: undefined };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Unknown message type' });
    });

    test('returns error response for unknown message', () => {
      const message = { type: 'INVALID_MESSAGE_TYPE' };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledTimes(1);
      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Unknown message type' });
    });
  });

  // ============================================================================
  // Edge Cases - Empty Selection Tests
  // ============================================================================

  describe('Edge Cases - Empty Selection', () => {
    test('handles empty selection gracefully', () => {
      mockGetSelection.mockReturnValue({
        toString: () => '',
      });

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: '',
      });
    });

    test('handles null selection', () => {
      mockGetSelection.mockReturnValue(null);

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: '',
      });
    });

    test('handles undefined selection', () => {
      mockGetSelection.mockReturnValue(undefined);

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: '',
      });
    });

    test('handles selection object with null toString', () => {
      mockGetSelection.mockReturnValue({
        toString: () => null,
      });

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: '',
      });
    });
  });

  // ============================================================================
  // Edge Cases - Pages Without Titles Tests
  // ============================================================================

  describe('Edge Cases - Pages Without Titles', () => {
    test('handles pages with empty title', () => {
      document.title = '';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: '',
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles pages with undefined title', () => {
      // @ts-ignore
      document.title = undefined;

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: undefined,
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles pages with null title', () => {
      // @ts-ignore
      document.title = null;

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: null,
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles pages with very long title', () => {
      const longTitle = 'A'.repeat(1000);
      document.title = longTitle;

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: longTitle,
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles pages with special characters in title', () => {
      const specialTitle = 'Test <Title> & "Quotes" \'Apostrophes\'';
      document.title = specialTitle;

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: specialTitle,
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });
  });

  // ============================================================================
  // Edge Cases - URL Variations Tests
  // ============================================================================

  describe('Edge Cases - URL Variations', () => {
    test('handles pages with complex URL with query params', () => {
      // @ts-ignore
      window.location.href = 'https://example.com/page?param1=value1&param2=value2';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/page?param1=value1&param2=value2',
        })
      );
    });

    test('handles pages with URL fragment', () => {
      // @ts-ignore
      window.location.href = 'https://example.com/page#section';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/page#section',
        })
      );
    });

    test('handles pages with localhost URL', () => {
      // @ts-ignore
      window.location.href = 'http://localhost:3000/page';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/page',
        })
      );
    });

    test('handles pages with file:// URL', () => {
      // @ts-ignore
      window.location.href = 'file:///path/to/file.html';

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'file:///path/to/file.html',
        })
      );
    });
  });

  // ============================================================================
  // Message Handler Behavior Tests
  // ============================================================================

  describe('Message Handler Behavior', () => {
    test('handles multiple sequential messages', () => {
      // First message
      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);
      expect(mockSendResponse).toHaveBeenCalledTimes(1);

      // Second message
      messageHandler({ type: 'HIGHLIGHT_TEXT', text: 'test' }, mockSender, mockSendResponse);
      expect(mockSendResponse).toHaveBeenCalledTimes(2);

      // Third message
      messageHandler({ type: 'UNKNOWN' }, mockSender, mockSendResponse);
      expect(mockSendResponse).toHaveBeenCalledTimes(3);
    });

    test('always returns true for async response', () => {
      expect(messageHandler({ type: 'HIGHLIGHT_TEXT' }, mockSender, mockSendResponse)).toBe(true);
      expect(messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse)).toBe(true);
      expect(messageHandler({ type: 'UNKNOWN' }, mockSender, mockSendResponse)).toBe(true);
    });

    test('handles messages with additional properties', () => {
      const message = {
        type: 'HIGHLIGHT_TEXT',
        text: 'test',
        extraProp: 'value',
        anotherProp: 123,
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  // ============================================================================
  // Console Logging Tests
  // ============================================================================

  describe('Console Logging', () => {
    test('logs content script loaded message', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Re-import to trigger the log
      jest.isolateModules(() => {
        require('../../src/content/index');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Silence Notes: Content script loaded on',
        'https://example.com/test-page'
      );

      consoleSpy.mockRestore();
    });

    test('logs content script initialized message', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      jest.isolateModules(() => {
        require('../../src/content/index');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Silence Notes: Content script initialized');

      consoleSpy.mockRestore();
    });

    test('logs received message', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      messageHandler({ type: 'TEST_MESSAGE' }, mockSender, mockSendResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Content script received message:',
        { type: 'TEST_MESSAGE' }
      );

      consoleSpy.mockRestore();
    });

    test('logs HIGHLIGHT_TEXT message handling', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      messageHandler({ type: 'HIGHLIGHT_TEXT', text: 'test text' }, mockSender, mockSendResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Would highlight text:', 'test text');

      consoleSpy.mockRestore();
    });

    test('logs unknown message type', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      messageHandler({ type: 'UNKNOWN_TYPE' }, mockSender, mockSendResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown message type:', 'UNKNOWN_TYPE');

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // DOM Event Listener Tests
  // ============================================================================

  describe('DOM Event Listeners', () => {
    test('registers DOMContentLoaded event listener', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      jest.isolateModules(() => {
        require('../../src/content/index');
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    test('logs message when DOM is loaded', () => {
      // Note: DOMContentLoaded event is not manually triggered in tests
      // but the listener should be registered
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const consoleSpy = jest.spyOn(console, 'log');

      jest.isolateModules(() => {
        require('../../src/content/index');
      });

      const callback = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )?.[1];

      expect(callback).toBeDefined();
      expect(typeof callback).toBe('function');

      // The callback logs when executed
      if (callback) {
        (callback as EventListener)();
        expect(consoleSpy).toHaveBeenCalledWith('Silence Notes: Content script DOM loaded');
      }

      addEventListenerSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    test('complete workflow: get page info with all components', () => {
      document.title = 'Integration Test Page';
      // @ts-ignore
      window.location.href = 'https://example.com/integration-test';
      mockGetSelection.mockReturnValue({
        toString: () => 'integration test selection',
      });

      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Integration Test Page',
        url: 'https://example.com/integration-test',
        selection: 'integration test selection',
      });
    });

    test('complete workflow: highlight text then get page info', () => {
      // Highlight text first
      messageHandler(
        { type: 'HIGHLIGHT_TEXT', text: 'important text' },
        mockSender,
        mockSendResponse
      );
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });

      // Then get page info
      messageHandler({ type: 'GET_PAGE_INFO' }, mockSender, mockSendResponse);
      expect(mockSendResponse).toHaveBeenCalledWith({
        title: 'Test Page Title',
        url: 'https://example.com/test-page',
        selection: 'selected text',
      });
    });

    test('handles rapid sequential message processing', () => {
      const messages = [
        { type: 'GET_PAGE_INFO' },
        { type: 'HIGHLIGHT_TEXT', text: 'test1' },
        { type: 'GET_PAGE_INFO' },
        { type: 'HIGHLIGHT_TEXT', text: 'test2' },
        { type: 'GET_PAGE_INFO' },
      ];

      messages.forEach(msg => {
        messageHandler(msg, mockSender, mockSendResponse);
      });

      expect(mockSendResponse).toHaveBeenCalledTimes(5);
    });
  });
});
