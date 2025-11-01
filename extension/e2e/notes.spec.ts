/**
 * End-to-End Tests for Notes Feature
 *
 * These tests cover the complete user journey from creating a note
 * to syncing with the backend, including all interactions and states.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test data
const testNote = {
  title: 'E2E Test Note',
  content: 'This is an end-to-end test note with #work and #personal tags',
};

const updatedNote = {
  title: 'Updated E2E Test Note',
  content: 'This note has been updated with new content #urgent',
};

// Helper functions
async function setupMockBackend(page: Page) {
  // Mock API responses for offline testing
  await page.route('/api/v1/notes', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notes: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });
    } else if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-test-note-1',
          title: testNote.title,
          content: testNote.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 'e2e-test-user',
          version: 1,
        }),
      });
    }
  });

  await page.route('/api/v1/notes/*', (route) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-test-note-1',
          title: updatedNote.title,
          content: updatedNote.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 'e2e-test-user',
          version: 2,
        }),
      });
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({
        status: 204,
      });
    }
  });
}

async function setupChromeExtension(page: Page) {
  // Mock Chrome APIs for testing
  await page.addInitScript(() => {
    global.chrome = {
      storage: {
        local: {
          get: (keys: any, callback: any) => {
            // Return empty data for initial load
            callback({ 'silence_notes_data': { notes: [], tags: [], user: null, settings: {}, sync: {}, metadata: {} } });
          },
          set: (items: any, callback?: any) => {
            if (callback) callback();
            return Promise.resolve();
          },
          remove: (keys: any, callback?: any) => {
            if (callback) callback();
            return Promise.resolve();
          },
        },
        sync: {
          get: (keys: any, callback: any) => {
            callback({});
          },
          set: (items: any, callback?: any) => {
            if (callback) callback();
            return Promise.resolve();
          },
        },
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`,
        id: 'test-extension-id',
      },
      identity: {
        getAuthToken: (callback: any) => {
          callback({ token: 'mock-auth-token' });
        },
      },
    } as any;
  });
}

test.describe('Notes E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await setupChromeExtension(page);
  });

  test.beforeEach(async () => {
    await setupMockBackend(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Note Creation Flow', () => {
    test('creates a new note successfully', async () => {
      // Navigate to the extension popup
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Wait for the page to load
      await expect(page.locator('[data-testid="notes-container"]')).toBeVisible();

      // Click on new note button
      await page.click('[data-testid="new-note-button"]');

      // Wait for editor to appear
      await expect(page.locator('[data-testid="note-editor"]')).toBeVisible();

      // Fill in the note title
      await page.fill('[data-testid="note-title-input"]', testNote.title);

      // Fill in the note content
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);

      // Check that hashtags are detected
      await expect(page.locator('[data-testid="detected-hashtags"]')).toContainText('#work');
      await expect(page.locator('[data-testid="detected-hashtags"]')).toContainText('#personal');

      // Save the note
      await page.click('[data-testid="save-note-button"]');

      // Wait for save to complete
      await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();

      // Verify note appears in the list
      await expect(page.locator(`text="${testNote.title}"`)).toBeVisible();
      await expect(page.locator(`text="${testNote.content}"`)).toBeVisible();

      // Verify character count
      await expect(page.locator('[data-testid="character-count"]')).toContainText('characters');
      await expect(page.locator('[data-testid="word-count"]')).toContainText('words');
    });

    test('auto-saves note during typing', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');

      // Type content slowly to trigger auto-save
      await page.fill('[data-testid="note-content-textarea"]', 'Auto save test content', { delay: 100 });

      // Wait for auto-save indicator
      await expect(page.locator('[data-testid="auto-save-indicator"]')).toBeVisible();

      // Verify content is preserved
      await expect(page.locator('[data-testid="note-content-textarea"]')).toHaveValue('Auto save test content');
    });

    test('validates note before saving', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');

      // Try to save without content
      await page.click('[data-testid="save-note-button"]');

      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toContainText('Content is required');
    });
  });

  test.describe('Note Editing Flow', () => {
    test('edits an existing note', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // First create a note
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');
      await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();

      // Click on the note to edit
      await page.click(`text="${testNote.content}"`);

      // Wait for editor to appear with existing content
      await expect(page.locator('[data-testid="note-editor"]')).toBeVisible();
      await expect(page.locator('[data-testid="note-content-textarea"]')).toHaveValue(testNote.content);

      // Update the content
      await page.fill('[data-testid="note-content-textarea"]', updatedNote.content);

      // Save the changes
      await page.click('[data-testid="save-note-button"]');

      // Verify changes are saved
      await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();
      await expect(page.locator(`text="${updatedNote.content}"`)).toBeVisible();
    });

    test('shows version information when editing', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Create and then edit a note
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');
      await page.click(`text="${testNote.content}"`);

      // Should show version information
      await expect(page.locator('[data-testid="note-version"]')).toContainText('Version 1');
    });
  });

  test.describe('Note Deletion Flow', () => {
    test('deletes a note successfully', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Create a note first
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');
      await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();

      // Hover over the note to show delete button
      await page.hover(`text="${testNote.content}"`);

      // Click delete button
      await page.click('[data-testid="delete-note-button"]');

      // Confirm deletion in dialog
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify note is removed
      await expect(page.locator(`text="${testNote.content}"`)).not.toBeVisible();
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    });

    test('cancels deletion when cancelled in dialog', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Create a note first
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');

      // Try to delete but cancel
      await page.hover(`text="${testNote.content}"`);
      await page.click('[data-testid="delete-note-button"]');
      await page.click('[data-testid="cancel-delete-button"]');

      // Note should still be present
      await expect(page.locator(`text="${testNote.content}"`)).toBeVisible();
    });
  });

  test.describe('Search and Filtering', () => {
    test.beforeEach(async () => {
      // Create multiple notes for testing search
      await page.goto('chrome-extension://test-extension-id/popup.html');

      const notes = [
        { title: 'Work Note', content: 'This is about work #work' },
        { title: 'Personal Note', content: 'This is personal #personal' },
        { title: 'Mixed Note', content: 'This has both #work #personal' },
      ];

      for (const note of notes) {
        await page.click('[data-testid="new-note-button"]');
        await page.fill('[data-testid="note-content-textarea"]', note.content);
        await page.click('[data-testid="save-note-button"]');
        await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();
      }
    });

    test('searches notes by text', async () => {
      // Search for "work"
      await page.fill('[data-testid="search-input"]', 'work');

      // Should show work-related notes
      await expect(page.locator('text="Work Note"')).toBeVisible();
      await expect(page.locator('text="Mixed Note"')).toBeVisible();
      await expect(page.locator('text="Personal Note"')).not.toBeVisible();
    });

    test('filters notes by hashtags', async () => {
      // Click on #work hashtag
      await page.click('[data-testid="hashtag-filter"]:has-text("#work")');

      // Should show only notes with #work tag
      await expect(page.locator('text="Work Note"')).toBeVisible();
      await expect(page.locator('text="Mixed Note"')).toBeVisible();
      await expect(page.locator('text="Personal Note"')).not.toBeVisible();
    });

    test('combines search and hashtag filtering', async () => {
      // Search for "both" and filter by #work
      await page.fill('[data-testid="search-input"]', 'both');
      await page.click('[data-testid="hashtag-filter"]:has-text("#work")');

      // Should only show the mixed note
      await expect(page.locator('text="Mixed Note"')).toBeVisible();
      await expect(page.locator('text="Work Note"')).not.toBeVisible();
      await expect(page.locator('text="Personal Note"')).not.toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('creates new note with Ctrl+N', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Use keyboard shortcut
      await page.keyboard.press('Control+n');

      // Should open new note editor
      await expect(page.locator('[data-testid="note-editor"]')).toBeVisible();
    });

    test('saves note with Ctrl+S', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);

      // Use keyboard shortcut to save
      await page.keyboard.press('Control+s');

      // Should save successfully
      await expect(page.locator('[data-testid="save-success-indicator"]')).toBeVisible();
      await expect(page.locator(`text="${testNote.content}"`)).toBeVisible();
    });

    test('cancels editing with Escape', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', 'Unsaved content');

      // Use escape to cancel
      await page.keyboard.press('Escape');

      // Should return to list view
      await expect(page.locator('[data-testid="note-editor"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="notes-list"]')).toBeVisible();
    });
  });

  test.describe('Sync and Offline Support', () => {
    test('syncs notes when online', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Create a note
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');

      // Wait for sync to complete
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Synced');

      // Check sync status
      await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible();
    });

    test('handles offline mode gracefully', async () => {
      // Mock offline state
      await page.context().setOffline(true);

      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

      // Create note while offline
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', 'Offline note');
      await page.click('[data-testid="save-note-button"]');

      // Should save locally and show pending sync
      await expect(page.locator('[data-testid="pending-sync-indicator"]')).toBeVisible();

      // Go back online
      await page.context().setOffline(false);

      // Should sync automatically
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Syncing...');
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Synced');
    });
  });

  test.describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      // Mock network error
      await page.route('/api/v1/notes', (route) => {
        route.abort('failed');
      });

      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Try to create note
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to save note');

      // Should offer retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('handles storage quota exceeded', async () => {
      // Mock storage quota error
      await page.addInitScript(() => {
        const originalSet = global.chrome?.storage?.local?.set;
        if (originalSet) {
          global.chrome.storage.local.set = (items: any, callback?: any) => {
            const error = new Error('QUOTA_EXCEEDED');
            if (callback) callback(error);
            return Promise.reject(error);
          };
        }
      });

      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Try to create large note
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', 'A'.repeat(1000000));
      await page.click('[data-testid="save-note-button"]');

      // Should show quota error
      await expect(page.locator('[data-testid="quota-error"]')).toContainText('Storage quota exceeded');
    });
  });

  test.describe('Performance', () => {
    test('loads quickly with many notes', async () => {
      // Mock many notes
      const manyNotes = Array.from({ length: 1000 }, (_, i) => ({
        id: `note-${i}`,
        title: `Note ${i}`,
        content: `Content for note ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'test-user',
        version: 1,
      }));

      await page.route('/api/v1/notes', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notes: manyNotes,
            pagination: { page: 1, limit: 50, total: 1000, totalPages: 20 },
          }),
        });
      });

      const startTime = Date.now();
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Should load within 2 seconds
      await expect(page.locator('[data-testid="notes-container"]')).toBeVisible({ timeout: 2000 });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);
    });

    test('handles rapid typing without lag', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');

      const startTime = Date.now();

      // Type rapidly
      const content = 'This is a performance test for rapid typing and input handling.';
      await page.fill('[data-testid="note-content-textarea"]', content, { delay: 10 });

      const responseTime = Date.now() - startTime;

      // Should respond within 500ms
      expect(responseTime).toBeLessThan(500);

      // Content should be correctly entered
      await expect(page.locator('[data-testid="note-content-textarea"]')).toHaveValue(content);
    });
  });

  test.describe('Accessibility', () => {
    test('is keyboard navigable', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Tab through elements
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="new-note-button"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="note-editor"]')).toBeVisible();
    });

    test('announces changes to screen readers', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');
      await page.click('[data-testid="new-note-button"]');
      await page.fill('[data-testid="note-content-textarea"]', testNote.content);
      await page.click('[data-testid="save-note-button"]');

      // Should announce save success
      await expect(page.locator('[data-testid="sr-announcement"]')).toContainText('Note saved successfully');
    });

    test('has proper ARIA labels', async () => {
      await page.goto('chrome-extension://test-extension-id/popup.html');

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="note-content-textarea"]')).toHaveAttribute('aria-label');
    });
  });
});