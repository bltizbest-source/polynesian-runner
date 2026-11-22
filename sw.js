const CACHE = 'polynesian-runner-v32';
const urls = ['./','./index.html','./style.css?v=31','./scene.js','./navigator.js','./character-material.js','./assets/ridgeback-hide.webp','./assets/ridgeback-horn.webp','./assets/navigator-mantle.webp','./assets/navigator-sash.webp','./assets/navigator-face.webp','./assets/island-flora.webp','./island-art.js','./assets/trail-wash.webp','./assets/island-horizon.webp','./courses.js','./motion.js','./viewport.js','./cave.js','./temple.js','./runner.js','./pursuer.js','./vendor/three.module.min.js',
    './game.js','./manifest.json','./favicon.png','./assets/temple-mark.svg','./assets/apple-touch-icon.png',
    './assets/icon-192.png','./assets/icon-512.png','./assets/runner-poses.webp','./assets/ridgeback-poses.webp',
    './assets/runner-actions.webp','./assets/runner-zip.webp','./assets/ridgeback-grab.webp'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith('polynesian-runner-') && key !== CACHE)
        .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(event.request)) ||
            (event.request.mode === 'navigate' && await cache.match('./index.html')) || Response.error();
    }));
});
