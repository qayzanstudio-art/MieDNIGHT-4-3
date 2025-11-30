
const CACHE_NAME = 'miednight-pos-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://aistudiocdn.com/@google/genai@^1.20.0',
    'https://aistudiocdn.com/react-dom@^19.1.1/',
    'https://aistudiocdn.com/react@^19.1.1/'
];

// Install Event - Caching files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // We use addAll but wrap it to not fail completely if one external CDN fails
                return Promise.all(
                    ASSETS_TO_CACHE.map(url => {
                        return cache.add(url).catch(err => console.log('Failed to cache:', url, err));
                    })
                );
            })
    );
});

// Activate Event - Cleaning old caches
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
});

// Fetch Event - Serving from cache if offline
self.addEventListener('fetch', (event) => {
    // Skip caching for Gemini API calls or other dynamic API calls
    if (event.request.url.includes('generativelanguage.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(() => {
                    // If both cache and network fail (offline), user stays on page.
                    // For a SPA, we might want to return index.html for navigation routes,
                    // but for this single page app, simplest fallback is sufficient.
                    console.log('Offline and not in cache:', event.request.url);
                });
            })
    );
});
