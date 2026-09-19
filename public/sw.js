// Offline shell for the smartphone PWA. On Cloud Phone the browser runs in CloudMosa's data
// centre, so this never matters there — it is for the buyer posting demand from a smartphone.
const CACHE = "mizani-v2";
// The recogniser (23 MB model + 14 MB WASM runtime) never changes under the same URL — the model
// URL carries ?v=N — so serve it from the cache and never download it twice.
const HEAVY = /\/(models\/.*\.onnx|ort\/)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("./")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Network first (prices must be fresh), cache as the fallback when the network is gone.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (HEAVY.test(request.url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./"))),
  );
});
