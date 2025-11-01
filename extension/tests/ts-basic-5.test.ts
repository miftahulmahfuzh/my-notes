/**
 * TypeScript test - Step 5: Chrome API Mocking
 */

test('Chrome storage API is mocked', () => {
  expect(global.chrome).toBeDefined();
  expect(global.chrome.storage).toBeDefined();
  expect(global.chrome.storage.local).toBeDefined();
  expect(global.chrome.runtime).toBeDefined();
});

test('Chrome storage methods work', async () => {
  const testData = { key: 'value' };

  // Mock the get method to return our test data
  (chrome.storage.local.get as jest.Mock).mockResolvedValue(testData);

  const result = await chrome.storage.local.get('key');
  expect(result).toBe(testData);
  expect(chrome.storage.local.get).toHaveBeenCalledWith('key');
});

test('Chrome runtime methods work', () => {
  const testUrl = 'chrome-extension://test/popup.html';

  // Mock the getURL method
  (chrome.runtime.getURL as jest.Mock).mockReturnValue(testUrl);

  const url = chrome.runtime.getURL('popup.html');
  expect(url).toBe(testUrl);
  expect(chrome.runtime.getURL).toHaveBeenCalledWith('popup.html');
});

test('Can mock Chrome identity API', () => {
  const redirectUrl = 'https://accounts.google.com/oauth/authorize';

  (chrome.identity.getRedirectURL as jest.Mock).mockReturnValue(redirectUrl);

  const url = chrome.identity.getRedirectURL();
  expect(url).toBe(redirectUrl);
});

test('Chrome API methods are properly typed', () => {
  // TypeScript should infer the correct types for Chrome APIs
  expect(typeof chrome.storage.local.get).toBe('function');
  expect(typeof chrome.storage.local.set).toBe('function');
  expect(typeof chrome.runtime.sendMessage).toBe('function');
  expect(typeof chrome.runtime.getURL).toBe('function');
});