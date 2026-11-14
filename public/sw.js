const STATIC_CACHE = 'trocado-static-v1';
const SHARE_CACHE = 'trocado-share-target-v1';
const SHARED_RECEIPT_KEY = '/__shared_receipt__';

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== SHARE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    let sharedFile = formData.get('receipt');

    if (!(sharedFile instanceof File) || sharedFile.size === 0) {
      for (const value of formData.values()) {
        if (value instanceof File && value.size > 0 && value.type.startsWith('image/')) {
          sharedFile = value;
          break;
        }
      }
    }

    if (sharedFile instanceof File && sharedFile.size > 0) {
      const shareCache = await caches.open(SHARE_CACHE);
      const headers = new Headers({
        'Content-Type': sharedFile.type || 'image/jpeg',
        'X-Shared-Filename': encodeURIComponent(sharedFile.name || 'comprovante.jpg'),
      });
      await shareCache.put(SHARED_RECEIPT_KEY, new Response(sharedFile, { headers }));
    }
  } catch {
    // Ignore malformed share payloads and still redirect safely to app
  }

  return Response.redirect('/?shared=1', 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Web Share Target POST for mobile receipt images
  if (url.origin === self.location.origin && url.pathname === '/share-target' && request.method === 'POST') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // NEVER intercept or cache /api/* or non-GET requests or cross-origin requests
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Navigation requests: network-first, falling back to cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && url.pathname === '/') {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets only: cache-first with background refresh
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|webmanifest)$/i.test(url.pathname);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return networkResponse;
      });
    })
  );
});
