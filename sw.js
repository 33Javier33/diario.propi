// --- CONFIGURACIÓN DE CACHÉ ---
// Paso 1: Nombramos nuestra caché y le damos una versión.
// Si haces cambios importantes en el futuro (como añadir botones), cambia 'v2' a 'v3', y así sucesivamente.
const CACHE_NAME = 'recaudacion-cache-v2';

// Archivos que la aplicación necesita para funcionar sin conexión.
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
  // Si tuvieras un archivo .css o .js separado, lo agregarías aquí.
];

// --- CICLO DE VIDA DEL SERVICE WORKER ---

// Evento 'install': Se dispara cuando el navegador instala el SW por primera vez.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  // Esperamos a que la promesa de abrir la caché y agregar los archivos se complete.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierta. Guardando archivos principales...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'activate': Se dispara después de la instalación. Es el lugar perfecto para limpiar cachés antiguas.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si encontramos una caché con un nombre diferente al actual, la borramos.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Evento 'fetch': Se dispara cada vez que la aplicación pide un recurso (una página, una imagen, etc.).
self.addEventListener('fetch', event => {
  // Estrategia: "Network Falling Back to Cache" (Primero intenta la red, si falla, usa la caché).
  // Esto asegura que los usuarios en línea siempre tengan la última versión,
  // pero los que no tienen conexión aún pueden usar la app.
  event.respondWith(
    fetch(event.request).catch(() => {
      console.log('Service Worker: No se pudo conectar a la red. Sirviendo desde caché.');
      return caches.match(event.request);
    })
  );
});