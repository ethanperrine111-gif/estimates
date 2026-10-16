/* QuickQuote service worker — offline cache.
   The deploy workflow stamps VERSION with the commit on every deploy: the browser
   sees sw.js changed, installs the new worker, and the app shows
   "Update available — tap to reload". */
'use strict';

const VERSION = 'qq-v1';
const CACHE = 'quickquote-' + VERSION;
const ASSETS = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

// All paths are relative to the worker's scope, so it works from a subpath (e.g. /estimates/).
const url = p => new URL(p, self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    // cache:'reload' skips the HTTP cache so a new version never precaches stale files.
    c.addAll(ASSETS.map(p => new Request(url(p), { cache: 'reload' })))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('quickquote-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Every page navigation inside the scope is the single-page app: key it as index.html.
  const key = req.mode === 'navigate' ? url('index.html') : req;

  // Cache-first, revalidate in the background (stale-while-revalidate).
  e.respondWith(caches.open(CACHE).then(cache =>
    cache.match(key, { ignoreSearch: true }).then(hit => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })
  ));
});
