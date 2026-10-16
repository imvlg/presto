import { readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await filesAt(path))
    else if (entry.name !== 'sw.js') found.push('./' + relative(root, path).split(sep).join('/'))
  }
  return found
}
const assets = await filesAt(root)
const version = 'presto-' + Date.now().toString(36)
const source = `const CACHE = ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(['./', ...assets])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put('./', response.clone()));
      return response;
    }).catch(() => caches.match('./')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
`
await writeFile(join(root, 'sw.js'), source)
