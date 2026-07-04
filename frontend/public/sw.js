const CACHE_NAME = 'livemap-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install service worker and cache basic shell assets
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Cache-first strategies for shell assets, fallback to network
self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback for document navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return Promise.reject('Offline and asset not cached');
      });
    })
  );
});

// Active worker and cleanup old cache versions
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});
