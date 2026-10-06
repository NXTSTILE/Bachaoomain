import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { ClientApiError, displayError, requestJson } from '../src/lib/client-api';

afterEach(() => mock.restoreAll());

test('client treats malformed success and non-JSON outages as failed requests', async () => {
  for (const [status, body] of [[200, '<html>Proxy error</html>'], [200, 'null'], [503, '<html>Internal provider details</html>']] as const) {
    mock.method(globalThis, 'fetch', async () => new Response(body, { status }));
    await assert.rejects(requestJson('/api/notice-board'), (error: unknown) => error instanceof ClientApiError && error.status === (status === 200 ? 502 : status) && error.message === 'The server is temporarily unavailable. Please try again.');
    mock.restoreAll();
  }
  assert.equal(displayError(new TypeError('fetch failed')), 'We couldn’t reach the server. Check your connection and try again.');
});

test('client preserves rate-limit recovery details and uses server-owned error messages', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Use your delivered code.', useExistingCode: true }), { status: 429, headers: { 'Retry-After': '45' } }));
  await assert.rejects(requestJson('/api/auth/register'), (error: unknown) => error instanceof ClientApiError && error.status === 429 && error.retryAfter === 45 && error.details?.useExistingCode === true && error.message === 'Use your delivered code.');
});
