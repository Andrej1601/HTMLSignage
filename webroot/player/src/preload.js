export function createImagePreloader({ maxParallel = 3 } = {}) {
  const processed = new Set();
  const queued = new Set();
  const queue = [];
  const limit = Number.isFinite(maxParallel) && maxParallel > 0
    ? Math.max(1, Math.floor(maxParallel))
    : 1;
  const supportsImage = typeof Image !== 'undefined';
  let active = 0;

  const cleanup = (img) => {
    if (!img) return;
    img.onload = null;
    img.onerror = null;
    try { img.src = ''; } catch (err) { /* ignore */ }
  };

  const dequeue = (url, resolve, img) => {
    cleanup(img);
    queued.delete(url);
    processed.add(url);
    active = Math.max(0, active - 1);
    resolve();
    run();
  };

  const run = () => {
    if (!supportsImage) {
      while (queue.length) {
        const { url, resolve } = queue.shift();
        queued.delete(url);
        processed.add(url);
        resolve();
      }
      return;
    }
    while (active < limit && queue.length) {
      const { url, resolve } = queue.shift();
      active++;
      const img = new Image();
      const done = () => dequeue(url, resolve, img);
      img.onload = done;
      img.onerror = done;
      img.src = url;
    }
  };

  const enqueue = (rawUrl) => {
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!url || processed.has(url) || queued.has(url)) return Promise.resolve();
    queued.add(url);
    return new Promise((resolve) => {
      queue.push({ url, resolve });
      run();
    });
  };

  return {
    preload: enqueue,
    preloadMany(urls) {
      if (!Array.isArray(urls) || !urls.length) return Promise.resolve();
      return Promise.all(urls.map(enqueue));
    },
    has(url) {
      const normalized = typeof url === 'string' ? url.trim() : '';
      return processed.has(normalized);
    }
  };
}
