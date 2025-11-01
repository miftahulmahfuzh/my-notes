/**
 * TypeScript test - Step 3: Interfaces and Objects
 */

interface User {
  id: string;
  name: string;
  email: string;
  age?: number; // Optional property
}

test('interface types work', () => {
  const user: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };

  expect(user.id).toBe('user-1');
  expect(user.name).toBe('Test User');
  expect(user.age).toBeUndefined();
});

test('interface with optional properties', () => {
  const user: User = {
    id: 'user-2',
    name: 'Another User',
    email: 'another@example.com',
    age: 25,
  };

  expect(user.age).toBe(25);
});

test('type inference works', () => {
  const message = 'Hello TypeScript';
  const numbers = [1, 2, 3];

  // TypeScript should infer these types correctly
  expect(typeof message).toBe('string');
  expect(Array.isArray(numbers)).toBe(true);
});