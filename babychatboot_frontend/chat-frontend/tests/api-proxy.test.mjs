import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardApi } from '../app/lib/server/api-proxy.ts';

const env = { NODE_ENV: 'production', BACKEND_URL: 'https://backend.example.test',
  ICARE_PROXY_SECRET: 'test-private-proxy-secret-at-least-32-characters',
  CF_ACCESS_CLIENT_ID: 'test-service-id', CF_ACCESS_CLIENT_SECRET: 'test-service-secret' };
const request = (path, init) => new Request('https://frontend.example.test/api/' + path, init);
const token = 'test.payload.signature';

test('forged service headers are replaced and only bearer + safe headers are forwarded', async () => {
  let calls = 0;
  const result = await forwardApi(request('users/profile?mode=view', { headers: {
    Authorization: 'Bearer ' + token, 'CF-Access-Client-Secret': 'forged', 'X-Icare-Proxy-Secret': 'forged',
    'X-Forwarded-Host': 'evil.test', cookie: 'other=secret'
  } }), ['users', 'profile'], env, async (url, init) => {
    calls++;
    assert.equal(url.href, 'https://backend.example.test/api/users/profile?mode=view');
    assert.equal(init.headers.get('CF-Access-Client-Secret'), env.CF_ACCESS_CLIENT_SECRET);
    assert.equal(init.headers.get('X-Icare-Proxy-Secret'), env.ICARE_PROXY_SECRET);
    assert.equal(init.headers.get('authorization'), 'Bearer ' + token);
    assert.equal(init.headers.get('x-forwarded-host'), null);
    assert.equal(init.headers.get('cookie'), null);
    assert.equal(init.redirect, 'manual');
    return Response.json({ ok: true }, { headers: { 'set-cookie': 'upstream=secret', 'CF-Access-Client-Secret': 'must-not-reflect' } });
  });
  assert.equal(calls, 1); assert.equal(result.status, 200);
  assert.equal(result.headers.get('set-cookie'), null);
  assert.equal(result.headers.get('CF-Access-Client-Secret'), null);
  assert.match(result.headers.get('cache-control'), /no-store/);
});

test('unset config, production HTTP, path traversal and cross-site requests fail before fetch', async () => {
  const never = async () => { throw new Error('fetch must not be called'); };
  assert.equal((await forwardApi(request('x'), ['x'], {}, never)).status, 503);
  assert.equal((await forwardApi(request('x'), ['x'], { ...env, BACKEND_URL: 'http://localhost:8080' }, never)).status, 503);
  for (const segment of ['..', '%2e%2e', 'a/b', 'a\\b', 'https:'])
    assert.equal((await forwardApi(request('x'), [segment], env, never)).status, 400);
  assert.equal((await forwardApi(request('x', { headers: { origin: 'https://evil.test' } }), ['x'], env, never)).status, 403);
});

test('redirects are blocked and service errors do not expose upstream bodies', async () => {
  const redirect = await forwardApi(request('x'), ['x'], env, async () => new Response('secret', { status: 302, headers: { location: 'https://evil.test' } }));
  assert.equal(redirect.status, 502); assert.equal(redirect.headers.get('location'), null);
  const error = await forwardApi(request('x'), ['x'], env, async () => new Response('secret', { status: 500 }));
  assert.equal(error.status, 502); assert.doesNotMatch(await error.text(), /secret/);
});

test('body size bounds apply with and without content-length', async () => {
  let calls = 0;
  const send = async () => { calls++; return new Response('ok'); };
  const large = 'x'.repeat(4 * 1024 * 1024 + 1);
  assert.equal((await forwardApi(request('x', { method: 'POST', body: large }), ['x'], env, send)).status, 413);
  assert.equal(calls, 0);
  assert.equal((await forwardApi(request('x'), ['x'], env, async () => new Response(large))).status, 413);
});

test('login image cookie is HttpOnly and limited to image reads; logout clears it', async () => {
  const login = await forwardApi(request('users/login', { method: 'POST', body: '{}' }), ['users', 'login'], env, async () => new Response(token));
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/); assert.match(cookie, /Path=\/api\/upload/);
  for (const [path, expected] of [[['upload', 'photo.png'], 'Bearer ' + token], [['users', 'profile'], null]]) {
    await forwardApi(request(path.join('/'), { headers: { cookie: 'icare_image_session=' + token } }), path, env,
      async (_url, init) => { assert.equal(init.headers.get('authorization'), expected); return new Response('ok'); });
  }
  const logout = await forwardApi(request('session/logout', { method: 'POST' }), ['session', 'logout'], env);
  assert.equal(logout.status, 204); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
