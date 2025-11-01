import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 *
 * This setup prepares the browser environment for Chrome extension testing,
 * including installing the extension and configuring necessary permissions.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  // Build the extension if not already built
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Extension built successfully');
  } catch (error) {
    console.error('❌ Failed to build extension:', error);
    process.exit(1);
  }

  // Launch browser with extension
  const browser = await chromium.launch({
    headless: false, // Required for extension testing
    args: [
      '--disable-extensions-except=./dist',
      '--load-extension=./dist',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
    ],
  });

  // Get the extension context
  const context = await browser.newContext();
  const page = await context.newPage();

  // Wait for extension to load
  await page.waitForTimeout(2000);

  // Get extension ID
  const extensionId = await page.evaluate(async () => {
    return new Promise((resolve) => {
      chrome.management.getAll((extensions) => {
        const extension = extensions.find((ext) => ext.name === 'Silence Notes');
        resolve(extension?.id);
      });
    });
  });

  if (!extensionId) {
    throw new Error('Extension not found after installation');
  }

  console.log(`✅ Extension loaded with ID: ${extensionId}`);

  // Store extension ID for tests to use
  process.env.EXTENSION_ID = extensionId as string;

  await browser.close();
  console.log('✅ E2E test environment ready');
}

export default globalSetup;