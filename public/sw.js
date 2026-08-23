// Service worker for fully offline operation.
//
// Strategy: on install, fetch sw-precache-manifest.json (written by
// scripts/generate-sw-manifest.mjs during `npm run build`) and cache every
// file the build produced — including the content-hashed JS/CSS chunks.
// After that first successful install (which requires being online once,
// or having run the app locally), every asset is served from the cache and
// no network request is ever required again.
//
// This deliberately does NOT do any background sync or push messaging —
// per the hard requirement, nothing should happen automatically that could
// interfere with the competition. Sync, if used at all, is a manual action
// the user takes from the Import/Export page.

const CACHE_NAME = "slalom-comp-app-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // Relative to this script's own URL — resolves correctly whether
        // the app is served from the domain root or a GitHub Pages
        // project subpath (e.g. /repo-name/sw.js -> /repo-name/sw-precache-manifest.json).
        const res = await fetch("./sw-precache-manifest.json");
        const files = await res.json();
        await cache.addAll(files);
      } catch (err) {
        // If we can't reach the manifest (e.g. very first load with a flaky
        // connection), fall back to caching just the shell. Subsequent
        // navigations will still populate the cache opportunistically below.
        console.warn("Precache manifest fetch failed, falling back to shell-only cache", err);
        await cache.addAll(["./", "./manifest.json"]);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        // Opportunistically cache anything new we fetch successfully
        // (e.g. an asset that wasn't in the precache manifest for some reason).
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // Fully offline and not cached — for navigations, fall back to the
        // cached app shell rather than showing the browser's default error.
        if (event.request.mode === "navigate") {
          // Resolve relative to this script's own location so it matches the
          // base-path-prefixed URL we actually cached at install time.
          const shellUrl = new URL(".", self.location).href;
          const shell = await caches.match(shellUrl);
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
