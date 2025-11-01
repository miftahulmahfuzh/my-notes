/**
 * Simple TypeScript test to verify compilation works
 */

describe('TypeScript Compilation', () => {
  it('should handle basic TypeScript syntax', () => {
    const message: string = 'Hello TypeScript';
    const number: number = 42;
    const array: string[] = ['a', 'b', 'c'];

    expect(message).toBe('Hello TypeScript');
    expect(number).toBe(42);
    expect(array).toHaveLength(3);
  });

  it('should handle interface definitions', () => {
    interface TestInterface {
      id: string;
      name: string;
      value?: number;
    }

    const testObj: TestInterface = {
      id: 'test-1',
      name: 'Test',
      value: 100,
    };

    expect(testObj.id).toBe('test-1');
    expect(testObj.name).toBe('Test');
    expect(testObj.value).toBe(100);
  });

  it('should handle async/await', async () => {
    const asyncFunction = async (): Promise<string> => {
      return new Promise(resolve => {
        setTimeout(() => resolve('async result'), 10);
      });
    };

    const result = await asyncFunction();
    expect(result).toBe('async result');
  });
});