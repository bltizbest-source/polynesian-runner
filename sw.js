const CACHE_NAME = 'polynesian-runner-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './favicon.png',
    './assets/player.webp',
    './assets/obstacle.webp',
    './assets/gem.webp',
    './assets/player_spritesheet.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});
