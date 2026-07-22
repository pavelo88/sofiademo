const CACHE_NAME = 'energy-engine-v4';
const OFFLINE_URL = '/inspection';
const LOGIN_URL = '/auth/inspection';

// Recursos que la app DEBE tener para arrancar offline
const STATIC_ASSETS = [
  '/',
  '/inspection',
  '/auth/inspection',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Instalando v4 - Pre-cacheando rutas críticas');
      // Intentamos cachear todo, pero si uno falla no bloqueamos el resto
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignorar telemetría y Firebase dinámico
  if (url.origin.includes('firebase') || url.origin.includes('firestore') || url.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardar en caché dinámica lo que se vaya cargando
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // MODO OFFLINE: Fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          // Si es una navegación (abrir la app), forzamos la carga del panel, login o root
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
              .then(res => res || caches.match(LOGIN_URL))
              .then(res => res || caches.match('/'))
              .then(res => {
                if (res) return res;
                // Si absolutamente nada funciona, fabricamos un HTML de emergencia
                return new Response(
                  '<html><body style="background:#062113;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;"><h1>Energy Engine</h1><p>Recargando aplicación en modo seguro offline...</p><script>setTimeout(()=>window.location.reload(), 3000)</script></body></html>',
                  { headers: { 'Content-Type': 'text/html' } }
                );
              });
          }

          return null;
        });
      })
  );
});
