const CACHE_NAME = 'polynesian-runner-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './manifest.json',
    './favicon.png',
    './assets/player.webp',
    './assets/obstacle.webp',
    './assets/gem.webp',
    './assets/player_spritesheet.png',
    'https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap',
    'https://fonts.gstatic.com/s/fredokaone/v14/k3kUo8otPhCDhs7RN-nE_w.woff2'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache v3');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch Assets from Cache (Cache-First reaching to network)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(event.request);
        })
    );
});
