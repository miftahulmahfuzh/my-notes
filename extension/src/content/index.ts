// Content script for Silence Notes
console.log('Silence Notes content script loaded');

// TODO: Implement content script functionality
// This could include:
// - Selecting text on the page and creating notes from it
// - Highlighting content that has been noted
// - Quick note creation shortcuts

// Example: Add context menu item for selected text
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CREATE_NOTE_FROM_SELECTION') {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString();

      // Send selected text to popup for note creation
      chrome.runtime.sendMessage({
        type: 'CREATE_NOTE',
        content: selectedText,
        source: {
          url: window.location.href,
          title: document.title
        }
      });
    }
  }
});