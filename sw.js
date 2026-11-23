const CACHE = 'polynesian-runner-v37';
const urls = ['./index.html','./offline.js','./style.css?v=36','./scene.js?v=35','./navigator.js','./character-material.js','./assets/ridgeback-hide.webp','./assets/ridgeback-horn.webp','./assets/navigator-mantle.webp','./assets/navigator-sash.webp','./assets/navigator-face.webp','./assets/island-flora.webp','./island-art.js?v=35','./assets/trail-wash.webp','./assets/island-horizon.webp','./courses.js','./motion.js','./viewport.js?v=35','./water.js','./cave.js','./temple.js?v=35','./runner.js','./pursuer.js','./vendor/three.module.min.js',
    './game.js?v=37','./manifest.json','./favicon.png','./assets/temple-mark.svg','./assets/apple-touch-icon.png',
    './assets/icon-192.png','./assets/icon-512.png','./assets/runner-poses.webp','./assets/ridgeback-poses.webp',
    './assets/runner-actions.webp','./assets/runner-zip.webp','./assets/ridgeback-grab.webp'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith('polynesian-runner-') && key !== CACHE)
        .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
const assetURLs = new Set(urls.map(path => new URL(path, self.registration.scope).href));
const home = new URL('./index.html', self.registration.scope);
const root = new URL('./', self.registration.scope);

self.addEventListener('message', event => {
    if (event.data !== 'prepare-offline' || !event.ports[0]) return;
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE);
            const saved = new Set((await cache.keys()).map(request => request.url));
            const missing = [...assetURLs].filter(url => !saved.has(url));
            if (missing.length) await cache.addAll(missing.map(url => new Request(url, {cache:'reload'})));
            event.ports[0].postMessage({ready:true});
        } catch {
            event.ports[0].postMessage({ready:false});
        }
    })());
});

self.addEventListener('fetch', event => {
    const {request} = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== home.origin) return;
    const launching = request.mode === 'navigate' &&
        (url.pathname === root.pathname || url.pathname === home.pathname);
    const key = launching ? home.href : url.href;
    if (!assetURLs.has(key)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const saved = await cache.match(key);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok) {
            // Storage can be cleared while a game is open. Restore missing files online.
            try { await cache.put(key, response.clone()); } catch { /* The online run can continue. */ }
        }
        return response;
    })());
});
