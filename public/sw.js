// Cache only versioned Next.js assets and app icons; operational data and auth
// always go to the network so another user's data cannot be served offline.
const CACHE = 'mg-oper-static-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(
  Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE && key.startsWith('mg-oper-')).map(key => caches.delete(key))
  ))])
))
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/_next/static/') && !/^\/icon-(192|512)\.png$/.test(url.pathname)) return
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  }))
})
