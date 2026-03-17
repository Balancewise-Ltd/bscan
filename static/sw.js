/// <reference lib="webworker" />

const CACHE_NAME = 'bscan-v1';
const OFFLINE_URL = '/offline.html';

// App shell to pre-cache
const PRECACHE_URLS = [
	'/',
	'/offline.html',
	'/manifest.json',
	'/icons/icon-192.png'
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
	);
	self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
		)
	);
	self.clients.claim();
});

// Fetch — network first, fallback to cache, then offline page
self.addEventListener('fetch', (event) => {
	// Skip non-GET and API requests
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api')) return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Cache successful navigations
				if (response.ok && event.request.mode === 'navigate') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => {
				// Offline — try cache
				return caches.match(event.request).then((cached) => {
					if (cached) return cached;
					// For navigations, show offline page
					if (event.request.mode === 'navigate') {
						return caches.match(OFFLINE_URL);
					}
					return new Response('', { status: 503 });
				});
			})
	);
});
