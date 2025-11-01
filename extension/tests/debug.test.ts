/**
 * Simple debug test to check if Jest is working at all
 */

describe('Jest Debug Test', () => {
  test('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  test('should handle basic mocking', () => {
    const mockFn = jest.fn().mockReturnValue('test');
    expect(mockFn()).toBe('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});