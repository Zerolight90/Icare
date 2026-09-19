// Imported only by the server route. Never move credentials to NEXT_PUBLIC_*.
const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_COOKIE = 'icare_image_session';
const COOKIE_PATH = '/api/upload';
type Environment = Record<string, string | undefined>;

function reply(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readBounded(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new RangeError('Payload too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function imageCookie(token: string, production: boolean) {
  return `${IMAGE_COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${token ? 7200 : 0}${production ? '; Secure' : ''}`;
}

export async function forwardApi(request: Request, path: string[], env: Environment = process.env, send: typeof fetch = fetch): Promise<Response> {
  const incoming = new URL(request.url);
  const production = env.NODE_ENV === 'production';
  const method = request.method;
  // Next.js may reconstruct an internal localhost URL behind a proxy. Pin the public origin explicitly.
  let frontendOrigin = incoming.origin;
  if (env.ICARE_FRONTEND_ORIGIN) {
    try {
      const configured = new URL(env.ICARE_FRONTEND_ORIGIN);
      const local = !production && ['localhost', '127.0.0.1'].includes(configured.hostname);
      if ((!local && configured.protocol !== 'https:') || !['http:', 'https:'].includes(configured.protocol) ||
          configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) throw new Error();
      frontendOrigin = configured.origin;
    } catch { return reply(503, '프론트 주소 설정을 확인해 주세요.'); }
  }
  // Reject browser cross-site use, including login CSRF. Bearer API clients may omit Origin.
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.headers.has('origin') && request.headers.get('origin') !== frontendOrigin))
    return reply(403, '요청 출처가 허용되지 않습니다.');
  if (!path.length || path.some(p => !/^[A-Za-z0-9_.-]+$/.test(p) || p === '.' || p === '..'))
    return reply(400, '잘못된 API 경로입니다.');
  const endpoint = path.join('/');
  if (endpoint === 'session/logout' && method === 'POST') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': imageCookie('', production) } });
  }

  let upstream: URL;
  try {
    upstream = new URL(env.BACKEND_URL || '');
    const local = !production && ['localhost', '127.0.0.1'].includes(upstream.hostname);
    if ((!local && upstream.protocol !== 'https:') || upstream.username || upstream.password ||
        upstream.pathname !== '/' || upstream.search || upstream.hash) throw new Error();
    if (!env.ICARE_PROXY_SECRET || env.ICARE_PROXY_SECRET.length < 32) throw new Error();
    if (!local && (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET)) throw new Error();
    upstream.pathname = '/api/' + endpoint;
    upstream.search = incoming.search;
  } catch { return reply(503, '서버 연결 설정이 필요합니다.'); }

  const headers = new Headers();
  // Rebuild the outgoing headers. Client-supplied Access/service/forwarded headers never pass through.
  for (const name of ['authorization', 'content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Images cannot carry localStorage bearer headers. This cookie grants only authenticated image reads.
  if (!headers.has('authorization') && method === 'GET' && path[0] === 'upload' && path.length === 2) {
    const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(IMAGE_COOKIE + '='))?.slice(IMAGE_COOKIE.length + 1);
    if (token && /^[A-Za-z0-9_.-]+$/.test(token)) headers.set('authorization', 'Bearer ' + token);
  }
  headers.set('X-Icare-Proxy-Secret', env.ICARE_PROXY_SECRET!);
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', env.CF_ACCESS_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', env.CF_ACCESS_CLIENT_SECRET);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return reply(413, '요청 크기는 최대 4MB입니다.');
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBounded(request.body);
    const response = await send(upstream, { method, headers, body, cache: 'no-store', redirect: 'manual', signal: controller.signal });
    // Never follow an Access login redirect with service credentials or reflect upstream cookies/errors.
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return reply(502, '백엔드 인증 연결을 확인해 주세요.'); }
    const bytes = await readBounded(response.body);
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = response.headers.get(name); if (value) outgoing.set(name, value);
    }
    if (response.ok && method === 'POST' && ['users/login', 'admin/auth/login'].includes(endpoint)) {
      const raw = new TextDecoder().decode(bytes);
      const token = endpoint === 'users/login' ? raw : JSON.parse(raw).token;
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return reply(502, '로그인 응답을 확인할 수 없습니다.');
      outgoing.set('Set-Cookie', imageCookie(token, production));
    }
    if (response.status === 401) outgoing.set('Set-Cookie', imageCookie('', production));
    if (response.status >= 500) return reply(502, '백엔드 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return new Response(method === 'HEAD' || [204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, headers: outgoing });
  } catch (error) {
    if (error instanceof RangeError) return reply(413, '전달 가능한 크기를 초과했습니다. 파일이나 조회 기간을 줄여 주세요.');
    return reply(controller.signal.aborted ? 504 : 502, '서버 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally { clearTimeout(timer); }
}
