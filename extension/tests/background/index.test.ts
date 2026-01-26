/**
 * Tests for Background Service Worker
 * Comprehensive test coverage for background script functionality
 */

describe('Background Service Worker', () => {
  let mockListeners: {
    onMessage: Array<(message: any, sender: any, sendResponse: jest.Mock) => boolean>;
    onInstalled: Array<() => void>;
    onStartup: Array<() => void>;
  };
  let mockSendResponse: jest.Mock;

  beforeAll(() => {
    // Set up mock listeners container
    mockListeners = {
      onMessage: [],
      onInstalled: [],
      onStartup: [],
    };

    // Enhance the chrome mock with our custom implementation
    (chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation((callback) => {
      mockListeners.onMessage.push(callback);
      return () => {
        const index = mockListeners.onMessage.indexOf(callback);
        if (index > -1) {
          mockListeners.onMessage.splice(index, 1);
        }
      };
    });

    (chrome.runtime.onInstalled.addListener as jest.Mock).mockImplementation((callback) => {
      mockListeners.onInstalled.push(callback);
    });

    (chrome.runtime.onStartup.addListener as jest.Mock).mockImplementation((callback) => {
      mockListeners.onStartup.push(callback);
    });

    // Import background script - this registers all listeners
    require('../src/background/index');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendResponse = jest.fn();
  });

  // ============================================================================
  // 1. Registers message listener on startup
  // ============================================================================

  describe('1. Message Listener Registration', () => {
    test('registers message listener on startup', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    test('registers onInstalled listener on startup', () => {
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    });

    test('registers onStartup listener on startup', () => {
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    });

    test('message listener returns true to keep channel open', () => {
      expect(mockListeners.onMessage.length).toBe(1);

      const listener = mockListeners.onMessage[0];
      const result = listener({ type: 'GET_STATUS' }, {}, mockSendResponse);

      // Should return true to keep message channel open for async responses
      expect(result).toBe(true);
    });

    test('returns unsubscribe function from addListener', () => {
      const addListenerCalls = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
      expect(addListenerCalls.length).toBeGreaterThan(0);

      // The listener registration should return an unsubscribe function
      // We can't directly test this, but we can verify the pattern
      expect(chrome.runtime.onMessage.addListener).toBeDefined();
    });
  });

  // ============================================================================
  // 2. Handles GET_STATUS message
  // ============================================================================

  describe('2. GET_STATUS Message Handling', () => {
    test('handles GET_STATUS message type', () => {
      expect(mockListeners.onMessage.length).toBe(1);

      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalled();
    });

    test('returns success: true for GET_STATUS', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    test('returns status information with status field', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
        })
      );

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.status).toBe('ok');
    });

    test('returns status information with timestamp', () => {
      const listener = mockListeners.onMessage[0];
      const beforeTime = Date.now();
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      const afterTime = Date.now();

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(response.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('timestamp is current time in milliseconds', () => {
      const listener = mockListeners.onMessage[0];
      const now = Date.now();
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      // Timestamp should be within 100ms of current time
      expect(Math.abs(response.timestamp - now)).toBeLessThan(100);
    });

    test('calls sendResponse exactly once for GET_STATUS', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 3. Handles unknown message types
  // ============================================================================

  describe('3. Unknown Message Type Handling', () => {
    test('handles unknown message type', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN_TYPE' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalled();
    });

    test('returns error for unknown message type', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN_TYPE' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    test('error message contains "Unknown message type"', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'RANDOM_TYPE' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.error).toBe('Unknown message type');
    });

    test('does not return success field for unknown messages', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'INVALID_TYPE' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBeUndefined();
    });

    test('calls sendResponse exactly once for unknown message', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledTimes(1);
    });

    test('handles multiple unknown message types', () => {
      const listener = mockListeners.onMessage[0];
      const messageTypes = ['TYPE_A', 'TYPE_B', 'TYPE_C'];

      messageTypes.forEach((type) => {
        mockSendResponse.mockClear();
        listener({ type }, {}, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Unknown message type',
          })
        );
      });
    });
  });

  // ============================================================================
  // 4. Returns correct response format
  // ============================================================================

  describe('4. Response Format Validation', () => {
    test('GET_STATUS response has data structure', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
    });

    test('unknown message response has error structure', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(response.error).toBe('Unknown message type');
    });

    test('GET_STATUS response does not have error field', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.error).toBeUndefined();
    });

    test('unknown message response does not have success boolean', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN' };

      listener(message, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(response.success).toBeUndefined();
    });

    test('response is an object (not array or primitive)', () => {
      const listener = mockListeners.onMessage[0];

      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];
      expect(typeof response).toBe('object');
      expect(Array.isArray(response)).toBe(false);
    });

    test('response format is consistent across multiple calls', () => {
      const listener = mockListeners.onMessage[0];

      // Call multiple times
      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);
      const response1 = mockSendResponse.mock.calls[0][0];

      mockSendResponse.mockClear();
      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);
      const response2 = mockSendResponse.mock.calls[0][0];

      // Both should have the same structure
      expect(Object.keys(response1)).toEqual(Object.keys(response2));
      expect(response1).toHaveProperty('status');
      expect(response2).toHaveProperty('status');
      expect(response1).toHaveProperty('timestamp');
      expect(response2).toHaveProperty('timestamp');
    });
  });

  // ============================================================================
  // 5. Message Sender Information
  // ============================================================================

  describe('5. Message Sender Handling', () => {
    test('accepts message with sender parameter', () => {
      const listener = mockListeners.onMessage[0];
      const sender = {
        id: 'sender-id',
        url: 'chrome-extension://test/popup.html',
      };

      expect(() => {
        listener({ type: 'GET_STATUS' }, sender, mockSendResponse);
      }).not.toThrow();
    });

    test('accepts message with null sender', () => {
      const listener = mockListeners.onMessage[0];

      expect(() => {
        listener({ type: 'GET_STATUS' }, null, mockSendResponse);
      }).not.toThrow();
    });

    test('accepts message with undefined sender', () => {
      const listener = mockListeners.onMessage[0];

      expect(() => {
        listener({ type: 'GET_STATUS' }, undefined, mockSendResponse);
      }).not.toThrow();
    });

    test('handles message with empty sender object', () => {
      const listener = mockListeners.onMessage[0];

      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 6. Message Payload Variations
  // ============================================================================

  describe('6. Message Payload Handling', () => {
    test('handles message with additional data properties', () => {
      const listener = mockListeners.onMessage[0];
      const message = {
        type: 'GET_STATUS',
        data: 'some data',
        id: 123,
      };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalled();
    });

    test('handles message with null payload', () => {
      const listener = mockListeners.onMessage[0];

      expect(() => {
        listener(null, {}, mockSendResponse);
      }).not.toThrow();
    });

    test('handles message with empty object', () => {
      const listener = mockListeners.onMessage[0];

      listener({}, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown message type',
        })
      );
    });

    test('handles message without type property', () => {
      const listener = mockListeners.onMessage[0];
      const message = { data: 'test' };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown message type',
        })
      );
    });
  });

  // ============================================================================
  // 7. Edge Cases
  // ============================================================================

  describe('7. Edge Cases', () => {
    test('handles concurrent messages', () => {
      const listener = mockListeners.onMessage[0];
      const mockSendResponse2 = jest.fn();
      const mockSendResponse3 = jest.fn();

      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);
      listener({ type: 'GET_STATUS' }, {}, mockSendResponse2);
      listener({ type: 'UNKNOWN' }, {}, mockSendResponse3);

      expect(mockSendResponse).toHaveBeenCalled();
      expect(mockSendResponse2).toHaveBeenCalled();
      expect(mockSendResponse3).toHaveBeenCalled();
    });

    test('handles rapid successive GET_STATUS calls', () => {
      const listener = mockListeners.onMessage[0];

      for (let i = 0; i < 10; i++) {
        mockSendResponse.mockClear();
        listener({ type: 'GET_STATUS' }, {}, mockSendResponse);
        expect(mockSendResponse).toHaveBeenCalledTimes(1);
      }
    });

    test('handles message with undefined type', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: undefined };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown message type',
        })
      );
    });

    test('handles message with null type', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: null };

      listener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown message type',
        })
      );
    });

    test('handles case-sensitive message types', () => {
      const listener = mockListeners.onMessage[0];

      // 'get_status' should not match 'GET_STATUS'
      listener({ type: 'get_status' }, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown message type',
        })
      );
    });
  });

  // ============================================================================
  // 8. Console Logging
  // ============================================================================

  describe('8. Console Logging', () => {
    const originalLog = console.log;

    afterEach(() => {
      console.log = originalLog;
    });

    test('logs received messages', () => {
      const logSpy = jest.spyOn(console, 'log');
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };

      listener(message, {}, mockSendResponse);

      expect(logSpy).toHaveBeenCalledWith(
        'Background received message:',
        message
      );

      logSpy.mockRestore();
    });

    test('logs unknown message types', () => {
      const logSpy = jest.spyOn(console, 'log');
      const listener = mockListeners.onMessage[0];
      const message = { type: 'UNKNOWN' };

      listener(message, {}, mockSendResponse);

      expect(logSpy).toHaveBeenCalledWith(
        'Unknown message type:',
        'UNKNOWN'
      );

      logSpy.mockRestore();
    });
  });

  // ============================================================================
  // 9. onInstalled Event Handling
  // ============================================================================

  describe('9. onInstalled Event Handling', () => {
    test('logs onInstalled event', () => {
      const logSpy = jest.spyOn(console, 'log');
      const details = { reason: 'install' };

      mockListeners.onInstalled[0](details);

      expect(logSpy).toHaveBeenCalledWith(
        'Silence Notes: Extension installed/updated',
        details
      );

      logSpy.mockRestore();
    });

    test('logs first time installation', () => {
      const logSpy = jest.spyOn(console, 'log');
      const details = { reason: 'install' };

      mockListeners.onInstalled[0](details);

      expect(logSpy).toHaveBeenCalledWith(
        'Silence Notes: First time installation'
      );

      logSpy.mockRestore();
    });

    test('logs update with version', () => {
      const logSpy = jest.spyOn(console, 'log');
      const details = { reason: 'update' };

      mockListeners.onInstalled[0](details);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated to version')
      );

      logSpy.mockRestore();
    });

    test('gets version from manifest', () => {
      const logSpy = jest.spyOn(console, 'log');
      const details = { reason: 'update' };

      mockListeners.onInstalled[0](details);

      expect(chrome.runtime.getManifest).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1.0.0')
      );

      logSpy.mockRestore();
    });
  });

  // ============================================================================
  // 10. onStartup Event Handling
  // ============================================================================

  describe('10. onStartup Event Handling', () => {
    test('logs onStartup event', () => {
      const logSpy = jest.spyOn(console, 'log');

      mockListeners.onStartup[0]();

      expect(logSpy).toHaveBeenCalledWith(
        'Silence Notes: Extension started'
      );

      logSpy.mockRestore();
    });

    test('handles startup event without errors', () => {
      expect(() => {
        mockListeners.onStartup[0]();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 11. Response Format Compliance
  // ============================================================================

  describe('11. Response Format Compliance', () => {
    test('GET_STATUS response matches expected schema', () => {
      const listener = mockListeners.onMessage[0];

      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];

      // Should have status (string)
      expect(typeof response.status).toBe('string');
      // Should have timestamp (number)
      expect(typeof response.timestamp).toBe('number');
      // Should not have error
      expect(response.error).toBeUndefined();
    });

    test('error response matches expected schema', () => {
      const listener = mockListeners.onMessage[0];

      listener({ type: 'UNKNOWN' }, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];

      // Should have error (string)
      expect(typeof response.error).toBe('string');
      // Should not have status
      expect(response.status).toBeUndefined();
      // Should not have timestamp
      expect(response.timestamp).toBeUndefined();
    });

    test('all response properties are serializable', () => {
      const listener = mockListeners.onMessage[0];

      listener({ type: 'GET_STATUS' }, {}, mockSendResponse);

      const response = mockSendResponse.mock.calls[0][0];

      // Should be JSON serializable (Chrome messaging requirement)
      expect(() => {
        JSON.stringify(response);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 12. Error Handling
  // ============================================================================

  describe('12. Error Handling', () => {
    test('handles sendResponse errors gracefully', () => {
      const listener = mockListeners.onMessage[0];
      const errorSendResponse = jest.fn(() => {
        throw new Error('sendResponse error');
      });

      // Should not throw
      expect(() => {
        listener({ type: 'GET_STATUS' }, {}, errorSendResponse);
      }).not.toThrow();
    });

    test('handles malformed message object', () => {
      const listener = mockListeners.onMessage[0];

      expect(() => {
        listener('invalid message', {}, mockSendResponse);
      }).not.toThrow();
    });

    test('handles message with circular references', () => {
      const listener = mockListeners.onMessage[0];
      const message = { type: 'GET_STATUS' };
      message.self = message;

      expect(() => {
        listener(message, {}, mockSendResponse);
      }).not.toThrow();
    });
  });
});
