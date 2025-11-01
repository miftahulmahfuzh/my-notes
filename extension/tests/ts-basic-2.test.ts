/**
 * TypeScript test - Step 2: Basic Types
 */

test('basic TypeScript types work', () => {
  const message: string = 'Hello TypeScript';
  const number: number = 42;
  const isActive: boolean = true;

  expect(message).toBe('Hello TypeScript');
  expect(number).toBe(42);
  expect(isActive).toBe(true);
});

test('array types work', () => {
  const numbers: number[] = [1, 2, 3];
  const strings: Array<string> = ['a', 'b', 'c'];

  expect(numbers).toHaveLength(3);
  expect(strings).toContain('b');
});