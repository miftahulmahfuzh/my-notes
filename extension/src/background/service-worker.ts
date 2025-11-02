// Service Worker for Silence Notes Extension
// Handles offline functionality, background sync, and caching

const CACHE_NAME = 'silence-notes-v1';
const STATIC_CACHE_NAME = 'silence-notes-static-v1';
const API_CACHE_NAME = 'silence-notes-api-v1';

// URLs to cache for offline functionality
const STATIC_URLS = [
  '/',
  '/popup.html',
  '/options.html',
  // Add other static assets as needed
];

// API endpoints to cache
const API_URLS = [
  '/api/v1/notes',
  '/api/v1/templates',
  '/api/v1/templates/built-in'
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('📦 Service Worker installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_URLS);
      })
      .then(() => {
        console.log('✅ Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('🔄 Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME &&
                cacheName !== API_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static requests
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with cache-first strategy for GET, network-first for others
async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    // Network-first for non-GET requests
    if (request.method !== 'GET') {
      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        // Cache successful responses
        const cache = await caches.open(API_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    }

    // Cache-first for GET requests
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      // Serve from cache, but try to update in background
      updateCacheInBackground(request);
      return cachedResponse;
    }

    // If not in cache, fetch from network
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;

  } catch (error) {
    console.error('❌ API request failed:', error);

    // Try to serve from cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving from cache due to network error');
      return cachedResponse;
    }

    // Return offline fallback
    return new Response(
      JSON.stringify({
        error: 'Offline - no cached data available',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request: Request): Promise<Response> {
  try {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;

  } catch (error) {
    console.error('❌ Static request failed:', error);

    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving static asset from cache');
      return cachedResponse;
    }

    // Return offline page or error
    return new Response(
      'Offline - Content not available',
      { status: 503 }
    );
  }
}

// Update cache in background
async function updateCacheInBackground(request: Request): Promise<void> {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    console.log('⚠️ Background update failed:', error);
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event: SyncEvent) => {
  console.log('🔄 Background sync event:', event.tag);

  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  } else if (event.tag === 'sync-templates') {
    event.waitUntil(syncTemplates());
  }
});

// Sync notes when back online
async function syncNotes(): Promise<void> {
  try {
    console.log('🔄 Syncing notes...');

    // Get queued notes from IndexedDB
    const queuedNotes = await getQueuedNotes();

    for (const note of queuedNotes) {
      try {
        const response = await fetch('/api/v1/notes', {
          method: note.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${note.authToken}`
          },
          body: JSON.stringify(note.data)
        });

        if (response.ok) {
          // Remove from queue
          await removeQueuedNote(note.id);
          console.log('✅ Synced note:', note.id);
        } else {
          console.error('❌ Failed to sync note:', note.id, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error syncing note:', note.id, error);
      }
    }

    console.log('✅ Notes sync completed');
  } catch (error) {
    console.error('❌ Notes sync failed:', error);
  }
}

// Sync templates when back online
async function syncTemplates(): Promise<void> {
  try {
    console.log('🔄 Syncing templates...');

    const queuedTemplates = await getQueuedTemplates();

    for (const template of queuedTemplates) {
      try {
        const response = await fetch('/api/v1/templates', {
          method: template.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${template.authToken}`
          },
          body: JSON.stringify(template.data)
        });

        if (response.ok) {
          await removeQueuedTemplate(template.id);
          console.log('✅ Synced template:', template.id);
        } else {
          console.error('❌ Failed to sync template:', template.id, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error syncing template:', template.id, error);
      }
    }

    console.log('✅ Templates sync completed');
  } catch (error) {
    console.error('❌ Templates sync failed:', error);
  }
}

// IndexedDB operations for offline queue
async function getQueuedNotes(): Promise<any[]> {
  // Implementation would use IndexedDB to store queued actions
  // This is a placeholder - actual implementation would be more complex
  return [];
}

async function removeQueuedNote(id: string): Promise<void> {
  // Remove from IndexedDB queue
}

async function getQueuedTemplates(): Promise<any[]> {
  // Get queued templates from IndexedDB
  return [];
}

async function removeQueuedTemplate(id: string): Promise<void> {
  // Remove from IndexedDB queue
}

// Push notification handling
self.addEventListener('push', (event: PushEvent) => {
  console.log('📬 Push notification received');

  const options = {
    body: 'You have new notes or updates',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'silence-notes',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Notes'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || options.body;
      options.title = data.title || 'Silence Notes';
      options.data = data;
    } catch (error) {
      console.error('❌ Failed to parse push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Silence Notes', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('🔔 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'view') {
    // Open the extension
    event.waitUntil(
      clients.openWindow('/popup.html')
    );
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'periodic-sync') {
      event.waitUntil(periodicSync());
    }
  });
}

async function periodicSync(): Promise<void> {
  console.log('🔄 Periodic background sync');

  try {
    // Refresh caches periodically
    await refreshCaches();

    // Clean up old data
    await cleanupOldData();

    console.log('✅ Periodic sync completed');
  } catch (error) {
    console.error('❌ Periodic sync failed:', error);
  }
}

async function refreshCaches(): Promise<void> {
  // Refresh important caches
  for (const apiUrl of API_URLS) {
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        const cache = await caches.open(API_CACHE_NAME);
        cache.put(apiUrl, response);
      }
    } catch (error) {
      console.log(`⚠️ Failed to refresh ${apiUrl}:`, error);
    }
  }
}

async function cleanupOldData(): Promise<void> {
  // Clean up old cached data
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const date = response.headers.get('date');
        if (date) {
          const responseDate = new Date(date);
          const now = new Date();
          const daysDiff = (now.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24);

          // Remove cached items older than 7 days
          if (daysDiff > 7) {
            await cache.delete(request);
            console.log('🗑️ Removed old cached item:', request.url);
          }
        }
      }
    }
  }
}

// Message handling for cache management
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_UPDATE':
      updateSpecificCache(data.url, data.options);
      break;

    case 'CACHE_CLEAR':
      clearCache(data.pattern);
      break;

    default:
      console.log('📨 Unknown message type:', type);
  }
});

async function updateSpecificCache(url: string, options: any = {}): Promise<void> {
  try {
    const response = await fetch(url, options);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(url, response);
      console.log('✅ Updated cache for:', url);
    }
  } catch (error) {
    console.error('❌ Failed to update cache:', url, error);
  }
}

async function clearCache(pattern: string): Promise<void> {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const requests = await cache.keys();

    for (const request of requests) {
      if (request.url.includes(pattern)) {
        await cache.delete(request);
      }
    }

    console.log('🗑️ Cleared cache pattern:', pattern);
  } catch (error) {
    console.error('❌ Failed to clear cache:', pattern, error);
  }
}

// Export types for TypeScript
declare global {
  interface ServiceWorkerGlobalScope {
    skipWaiting(): void;
    clients: Clients;
    registration: ServiceWorkerRegistration;
  }
}

export {};