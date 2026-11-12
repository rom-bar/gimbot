import { createHash } from 'node:crypto';
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
const configuredBase = process.env.BASE_PATH ?? (repositoryName ? `/${repositoryName}/` : '/gimbot/');
const basePath = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

const precacheFiles = (await collectFiles(dist)).filter((file) => !['sw.js', '404.html'].includes(file));
const digest = createHash('sha256').update(precacheFiles.join('\n')).digest('hex').slice(0, 12);
const urls = precacheFiles.map((file) => `${basePath}${file}`);
const serviceWorker = `const CACHE_NAME = 'retro-arcade-${digest}';
const BASE_PATH = ${JSON.stringify(basePath)};
const PRECACHE_URLS = ${JSON.stringify(urls)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('retro-arcade-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(BASE_PATH + 'index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
`;
await writeFile(path.join(dist, 'sw.js'), serviceWorker);
await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'));
console.log(`Prepared ${precacheFiles.length} offline assets under ${basePath}.`);
