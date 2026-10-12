// Chafé PWA Service Worker
const CACHE_NAME = 'chafe-pwa-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass-through network requests with safe fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
