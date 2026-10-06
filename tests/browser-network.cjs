// Loaded only by the isolated browser fixture. Never allow its server to contact
// a real mail provider or other external service, even if a UI mock is missing.
const originalFetch = globalThis.fetch;
globalThis.fetch = function fixtureFetch(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('External service requests are disabled in the browser fixture.');
  }
  return originalFetch(input, options);
};
