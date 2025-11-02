/**
 * Background Script Entry Point
 * Entry point for the Chrome extension background service worker
 */

// Import and initialize background services
import('./background').catch(error => {
  console.error('Failed to initialize background script:', error);
});

// Service worker install event
self.addEventListener('install', (event) => {
  console.log('Background service worker installing...');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('Background service worker activating...');
  event.waitUntil(
    clients.claim().then(() => {
      console.log('Background service worker activated and claimed all clients');
    })
  );
});

// Service worker message event (fallback for chrome.runtime.onMessage)
self.addEventListener('message', (event) => {
  console.log('Background service worker received message:', event.data);
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome extension started up');
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Chrome extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('First time installation');
  } else if (details.reason === 'update') {
    console.log('Extension updated from version', details.previousVersion);
  }
});

export {};