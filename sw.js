// Define un nombre para el caché actual.
// Si cambias este nombre, el service worker se actualizará y el caché antiguo se limpiará.
const CACHE_NAME = 'recaudacion-cache-v1';

// Lista de archivos y recursos que se guardarán en el caché para que la app funcione offline.
const urlsToCache = [
  './', // La raíz de la app
  './index.html', // El archivo principal
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css' // La librería de íconos
];

// Evento 'install': Se dispara cuando el service worker se instala por primera vez.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  // Espera hasta que el caché se abra y todos los archivos se hayan guardado.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caché abierto, guardando archivos...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'activate': Se dispara después de la instalación y cuando una nueva versión del SW se activa.
// Se usa para limpiar cachés viejos que ya no se necesitan.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre del caché no es el actual, se borra.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento 'fetch': Se dispara cada vez que la página hace una petición de red (ej. pedir una imagen, un script, etc.).
self.addEventListener('fetch', event => {
  // Ignora las peticiones al script de Google Sheets para que siempre vayan a la red.
  if (event.request.url.includes('script.google.com')) {
    return;
  }
  
  // Estrategia "Cache First":
  // Intenta responder con el recurso desde el caché. Si no está, va a la red.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si encontramos una respuesta en el caché, la retornamos.
        if (response) {
          console.log('Service Worker: Sirviendo desde caché:', event.request.url);
          return response;
        }
        // Si no, vamos a la red a buscar el recurso.
        console.log('Service Worker: Buscando en la red:', event.request.url);
        return fetch(event.request);
      }
    )
  );
});
