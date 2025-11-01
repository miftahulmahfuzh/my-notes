// Background service worker for Silence Notes
console.log('Silence Notes background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Silence Notes extension installed');

  // Initialize storage with empty notes array if it doesn't exist
  chrome.storage.local.get(['notes'], (result) => {
    if (!result.notes) {
      chrome.storage.local.set({ notes: [] });
    }
  });
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.type) {
    case 'SYNC_NOTES':
      // TODO: Implement sync with backend
      sendResponse({ success: true, message: 'Sync not implemented yet' });
      break;

    default:
      sendResponse({ success: false, message: 'Unknown message type' });
  }

  return true; // Keep the message channel open for async responses
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.notes) {
    console.log('Notes changed:', changes.notes.newValue);
    // TODO: Trigger sync with backend
  }
});