/**
 * PaddySpeaks Worker — security helpers (P0.6).
 *
 * Kept pure (no bindings) where possible so analytics/tests/run.mjs can prove
 * each rule without a Worker runtime.
 *
 * Why each exists (docs/PADDYSPEAKS-PLATFORM-AUDIT.md §14):
 *   corsHeaders   The Worker used to echo ANY Origin back with
 *                 Allow-Credentials:true, so any website could drive the scan
 *                 proxy and the admin API from a visitor's browser.
 *   safeEqual     Admin auth compared the bearer token with ===, which leaks
 *                 timing. Constant-time compare, and never "equal" to an unset
 *                 secret.
 *   gpcOptOut     lib/ps.js honours Global Privacy Control in the browser, but
 *                 the <img> pixel cannot run JS. The Sec-GPC request header lets
 *                 the Worker honour the same signal for every collection route.
 *   adminGate     No throttle on wrong admin passwords. Failed attempts are now
 *                 counted per IP and locked out after ADMIN_MAX_FAILS per window.
 */

export const ALLOWED_ORIGINS = [
  'https://paddyspeaks.com',
  'https://www.paddyspeaks.com',
];

// Local development: `python3 -m http.server` and friends.
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin);
}

/**
 * CORS headers for a request. An allowed Origin is echoed; anything else gets
 * no Access-Control-Allow-Origin at all, so the browser blocks the response.
 *
 * Allowed origins also get Access-Control-Allow-Credentials: true. That is not
 * optional: navigator.sendBeacon ALWAYS sends in credentials mode "include",
 * and lib/ps.js beacons are application/json, so every page view is
 * preflighted — and a credentialed preflight without this header is refused.
 * The browser then drops the beacon silently while sendBeacon() still returns
 * true. Removing it on 2026-09-24 stopped all JS page views for a day.
 * It is safe because the origin is allowlisted (the old hole was echoing ANY
 * origin with credentials), and nothing here reads cookies.
 */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Credentials'] = 'true';
  }
  return h;
}

/** Constant-time string equality. False whenever either side is empty. */
export function safeEqual(a, b) {
  a = typeof a === 'string' ? a : '';
  b = typeof b === 'string' ? b : '';
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length));
  }
  return diff === 0;
}

/** The bearer token on a request, or ''. */
export function bearer(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

export function isAdmin(request, env) {
  return safeEqual(bearer(request), env.ADMIN_PASSWORD_HASH || '');
}

/** True when the browser sent the Global Privacy Control signal. */
export function gpcOptOut(request) {
  return (request.headers.get('Sec-GPC') || '').trim() === '1';
}

/** Routes that require the admin bearer token. */
export function isAdminRoute(pathname) {
  return pathname === '/api/stats' || pathname === '/api/insights' ||
    pathname === '/api/journeys' || pathname === '/api/realtime' ||
    pathname === '/api/export' || pathname === '/api/exclude' ||
    pathname === '/api/testimonials/admin';
}

export const ADMIN_MAX_FAILS = 10;
export const ADMIN_FAIL_WINDOW_SEC = 900;

/**
 * Throttle wrong admin passwords. Returns a 429 Response when this IP has
 * failed too often in the window, else null. Only FAILED attempts count, so a
 * signed-in dashboard polling /api/realtime never locks itself out.
 * Fails CLOSED for a request that is already failing auth (it would get a 401
 * anyway), and never blocks a request carrying the right token.
 */
export async function adminGate(request, env, ch, rateLimit) {
  if (isAdmin(request, env)) return null;
  if (!env.FORMS) return null;           // no limiter store: plain 401 follows
  const r = await rateLimit(env, request, 'admin-auth-fail', ADMIN_MAX_FAILS, ADMIN_FAIL_WINDOW_SEC, { failClosed: true });
  if (r.ok) return null;
  return new Response(JSON.stringify({ error: 'Too many failed sign-in attempts. Try again later.' }), {
    status: 429,
    headers: { ...ch, 'Content-Type': 'application/json', 'Retry-After': String(r.retryAfter || ADMIN_FAIL_WINDOW_SEC) },
  });
}
