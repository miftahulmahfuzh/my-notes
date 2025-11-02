/**
 * Content script for Silence Notes Chrome Extension
 */

console.log('Silence Notes: Content script loaded on', window.location.href);

// Basic content script functionality
document.addEventListener('DOMContentLoaded', () => {
  console.log('Silence Notes: Content script DOM loaded');
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  switch (message.type) {
    case 'HIGHLIGHT_TEXT':
      // TODO: Implement text highlighting
      console.log('Would highlight text:', message.text);
      sendResponse({ success: true });
      break;

    case 'GET_PAGE_INFO':
      sendResponse({
        title: document.title,
        url: window.location.href,
        selection: window.getSelection()?.toString() || ''
      });
      break;

    default:
      console.log('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

console.log('Silence Notes: Content script initialized');