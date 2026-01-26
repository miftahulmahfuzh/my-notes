/**
 * Background script for Silence Notes Chrome Extension
 */

console.log('Silence Notes: Background script loading...');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Silence Notes: Extension installed/updated', details);

  if (details.reason === 'install') {
    console.log('Silence Notes: First time installation');
  } else if (details.reason === 'update') {
    console.log(`Silence Notes: Updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Silence Notes: Extension started');
});

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  // Helper to safely send response
  const safeSendResponse = (response: any) => {
    try {
      sendResponse(response);
    } catch (error) {
      console.error('Error sending response:', error);
    }
  };

  // Handle null or undefined message
  if (!message || typeof message.type !== 'string') {
    console.log('Unknown message type:', message?.type);
    safeSendResponse({ error: 'Unknown message type' });
    return true;
  }

  // Basic message handling
  switch (message.type) {
    case 'GET_STATUS':
      safeSendResponse({ status: 'ok', timestamp: Date.now() });
      break;

    default:
      console.log('Unknown message type:', message.type);
      safeSendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep the message channel open for async responses
});

console.log('Silence Notes: Background script loaded successfully');