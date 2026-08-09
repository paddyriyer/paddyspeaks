/**
 * PaddySpeaks — Privacy Console scan proxy.
 *
 * The console runs entirely in the browser, which means it cannot fetch other
 * sites: CORS forbids it, and that is the same rule stopping any page from
 * reading your other tabs. This Worker is the one piece that can, so it does
 * exactly two things and nothing else:
 *
 *   POST /api/scan       run search queries, return results
 *   POST /api/scan/read  fetch one page, return its visible text
 *
 * All judgement — is this me, how bad is it, can it be removed — stays in the
 * browser. This route is deliberately dumb: it fetches and returns. It does not
 * score, does not decide, and does not know who the user is.
 *
 * ── Privacy ──────────────────────────────────────────────────────────────────
 * The queries contain the user's name, address and phone number. That is
 * unavoidable — searching for someone means transmitting who they are. So:
 *
 *   · Nothing is logged. No console.log of any request body, query or URL.
 *   · Nothing is stored. This module touches no D1 binding and holds no state.
 *   · Nothing is cached. Responses are no-store, so an edge cache cannot end up
 *     holding one visitor's identity where another request could reach it.
 *
 * The page's own copy must say this plainly. A tool that quietly starts
 * transmitting a home address while still promising "nothing leaves your
 * browser" would be doing precisely what the data brokers do.
 *
 * ── SSRF ─────────────────────────────────────────────────────────────────────
 * /api/scan/read takes a URL from the client, which makes it a fetch proxy on
 * paddyspeaks.com. Unguarded, that is an open relay someone could point at
 * internal addresses or use to launder traffic. isFetchable() below is the
 * guard, and it is an allowlist of schemes plus a denylist of address shapes —
 * not a convenience check.
 */

const MAX_QUERIES = 12;      // per request; the client paces itself across calls
const MAX_RESULTS = 10;      // CSE's per-page maximum
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGE_BYTES = 900_000;

export async function routeScan(request, env, url, ch) {
  if (url.pathname === '/api/scan' && request.method === 'POST') {
    return handleScan(request, env, ch);
  }
  if (url.pathname === '/api/scan/read' && request.method === 'POST') {
    return handleRead(request, env, ch);
  }
  if (url.pathname === '/api/scan/status' && request.method === 'GET') {
    return json({ configured: isConfigured(env), provider: isConfigured(env) ? 'google_cse' : null }, 200, ch);
  }
  return null;
}

function isConfigured(env) {
  return Boolean(env.GOOGLE_CSE_KEY && env.GOOGLE_CSE_ID);
}

/* ------------------------------------------------------------------ search */

async function handleScan(request, env, ch) {
  if (!isConfigured(env)) {
    return json({
      error: 'not_configured',
      message: 'Search is not set up on this site yet. The console still works — paste a search results page instead.',
    }, 503, ch);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400, ch);
  }

  const queries = (Array.isArray(body?.queries) ? body.queries : [])
    .map((q) => String(q || '').trim())
    .filter((q) => q.length >= 3 && q.length <= 300)
    .slice(0, MAX_QUERIES);

  if (!queries.length) return json({ error: 'no_queries' }, 400, ch);

  const out = [];
  for (const q of queries) {
    // Sequential on purpose. The free CSE tier is 100 queries/day and rate
    // limits per second; firing a dozen in parallel is the reliable way to
    // spend the whole allowance on 429s.
    out.push(await searchOne(q, env));
  }

  return json({
    provider: 'google_cse',
    results: out,
    // So the UI can warn before the user hits a wall rather than after.
    quotaNote: 'Google\'s free tier allows 100 searches per day across the whole site.',
  }, 200, ch);
}

async function searchOne(query, env) {
  const endpoint = new URL('https://www.googleapis.com/customsearch/v1');
  endpoint.searchParams.set('key', env.GOOGLE_CSE_KEY);
  endpoint.searchParams.set('cx', env.GOOGLE_CSE_ID);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('num', String(MAX_RESULTS));
  endpoint.searchParams.set('safe', 'off');

  try {
    const res = await withTimeout(fetch(endpoint.toString(), {
      headers: { Accept: 'application/json' },
    }));

    if (res.status === 429) {
      return { query, items: [], error: 'quota_exceeded' };
    }
    if (!res.ok) {
      // Deliberately not echoing Google's body — it can contain the key.
      return { query, items: [], error: `search_failed_${res.status}` };
    }

    const data = await res.json();
    return {
      query,
      items: (data.items || []).map((i) => ({
        url: String(i.link || ''),
        title: String(i.title || '').slice(0, 300),
        snippet: String(i.snippet || '').slice(0, 800),
      })).filter((i) => i.url),
    };
  } catch (err) {
    return { query, items: [], error: err.name === 'TimeoutError' ? 'timeout' : 'network_error' };
  }
}

/* ------------------------------------------------------------------- read */

async function handleRead(request, env, ch) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400, ch);
  }

  const target = String(body?.url || '').trim();
  if (!isFetchable(target)) return json({ error: 'url_not_allowed' }, 400, ch);

  try {
    const res = await withTimeout(fetch(target, {
      headers: {
        // Identify honestly. A tool acting for a person exercising their own
        // privacy rights has no business pretending to be a random browser,
        // and sites that wish to block it should be able to.
        'User-Agent': 'PaddySpeaksPrivacyConsole/1.0 (+https://paddyspeaks.com/privacy/)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    }));

    const type = res.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return json({ error: 'not_a_page', status: res.status }, 200, ch);
    }

    const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
    return json({
      url: res.url || target,
      status: res.status,
      title: titleOf(html),
      text: toText(html),
    }, 200, ch);
  } catch (err) {
    return json({ error: err.name === 'TimeoutError' ? 'timeout' : 'fetch_failed' }, 200, ch);
  }
}

/**
 * Is this URL safe for the Worker to fetch on a stranger's behalf?
 *
 * Allowlist the scheme, then reject anything that resolves to somewhere a
 * public web page has no business being. Hostname checks cannot catch every
 * DNS-rebinding trick, but they close the obvious holes — and the route
 * returns text rather than status codes, which limits its value as a scanner.
 */
export function isFetchable(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.internal') || host.endsWith('.local')) return false;

  // Cloud metadata endpoints — the classic SSRF prize.
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return false;

  // IPv4 literals in private / loopback / link-local space.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
    if (a >= 224) return false;
  }

  // IPv6 literals: loopback, link-local and unique-local.
  if (host.startsWith('[')) {
    const v6 = host.replace(/^\[|\]$/g, '');
    if (v6 === '::1' || v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return false;
  }

  return true;
}

/* ------------------------------------------------------------------ utils */

function titleOf(html) {
  const m = String(html).match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  return m ? decode(m[1]).replace(/\s+/g, ' ').trim() : '';
}

/** Strip to visible text. Not a parser — enough for the extractor to read. */
function toText(html) {
  return decode(
    String(html)
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, 200_000);
}

function decode(s) {
  return String(s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => {
      const e = new Error('timeout');
      e.name = 'TimeoutError';
      reject(e);
    }, ms)),
  ]);
}

function json(body, status, ch) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...ch,
      'Content-Type': 'application/json',
      // Never cached: the response is shaped by one person's identity.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}
