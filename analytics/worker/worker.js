/**
 * PaddySpeaks Analytics — Cloudflare Worker (Optimized)
 *
 * Endpoints:
 *   POST /api/v             — Record a page view (non-blocking DB write)
 *   GET  /api/stats         — Dashboard data (60s edge cache)
 *   GET  /api/realtime      — Visitors in last 5 minutes
 *
 * Performance:
 *   - /api/v returns instantly, DB write happens via waitUntil
 *   - /api/stats cached at edge for 60s (no D1 hit on repeat loads)
 *   - D1 queries batched into single batch() call
 *   - Bot traffic filtered out
 */

function cors(request) {
  const origin = request.headers.get('Origin') || 'https://paddyspeaks.com';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ch = cors(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: ch });
    }

    if ((url.pathname === '/collect' || url.pathname === '/api/v') && request.method === 'POST') {
      return handleCollect(request, env, ctx, ch);
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env, url, ch);
    }

    if (url.pathname === '/api/realtime' && request.method === 'GET') {
      return handleRealtime(request, env, ch);
    }

    return new Response('Not found', { status: 404, headers: ch });
  },
};

/* ───────── Collect Page View (non-blocking) ───────── */

async function handleCollect(request, env, ctx, ch) {
  try {
    const data = await request.json();
    const cf = request.cf || {};
    const ua = request.headers.get('User-Agent') || '';

    // Filter bots
    if (/bot|crawl|spider|slurp|facebook|twitter|whatsapp|telegram|preview/i.test(ua)) {
      return new Response('ok', { headers: ch });
    }

    // Return immediately — write to D1 in background
    ctx.waitUntil(
      env.DB.prepare(`
        INSERT INTO page_views (page, referrer, country, city, region, browser, os, device_type, screen, language, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sanitize(data.p || '/'),
        sanitize(data.r || ''),
        cf.country || 'Unknown',
        cf.city || 'Unknown',
        cf.region || 'Unknown',
        parseBrowser(ua),
        parseOS(ua),
        parseDevice(ua),
        sanitize(data.s || ''),
        sanitize(data.l || ''),
        sanitize(data.sid || '')
      ).run().catch(e => console.error('DB write error:', e.message))
    );

    return new Response('ok', { headers: ch });
  } catch (e) {
    return new Response('ok', { headers: ch });
  }
}

/* ───────── Dashboard Stats (cached) ───────── */

async function handleStats(request, env, url, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;

  // Edge cache: serve cached response for 60 seconds
  const cacheKey = new Request(request.url, { headers: { 'Authorization': '' } });
  const cache = caches.default;
  let cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, {
      headers: { ...ch, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const period = url.searchParams.get('period') || '7d';
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 }[period] || 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Batch all queries into a single D1 round-trip
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) as total_views, COUNT(DISTINCT session_id) as unique_visitors FROM page_views WHERE created_at >= ?`).bind(since),
    env.DB.prepare(`SELECT DATE(created_at) as date, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`).bind(since),
    env.DB.prepare(`SELECT page, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views WHERE created_at >= ? GROUP BY page ORDER BY views DESC LIMIT 25`).bind(since),
    env.DB.prepare(`SELECT country, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views WHERE created_at >= ? GROUP BY country ORDER BY views DESC LIMIT 30`).bind(since),
    env.DB.prepare(`SELECT city, country, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY city, country ORDER BY views DESC LIMIT 25`).bind(since),
    env.DB.prepare(`SELECT browser, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY browser ORDER BY views DESC`).bind(since),
    env.DB.prepare(`SELECT os, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY os ORDER BY views DESC`).bind(since),
    env.DB.prepare(`SELECT device_type, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY device_type ORDER BY views DESC`).bind(since),
    env.DB.prepare(`SELECT referrer, COUNT(*) as views FROM page_views WHERE created_at >= ? AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 20`).bind(since),
    env.DB.prepare(`SELECT screen, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY screen ORDER BY views DESC LIMIT 15`).bind(since),
    env.DB.prepare(`SELECT language, COUNT(*) as views FROM page_views WHERE created_at >= ? GROUP BY language ORDER BY views DESC LIMIT 15`).bind(since),
  ]);

  const data = {
    period,
    overview: batch[0].results[0] || { total_views: 0, unique_visitors: 0 },
    daily: batch[1].results,
    topPages: batch[2].results,
    countries: batch[3].results,
    cities: batch[4].results,
    browsers: batch[5].results,
    oses: batch[6].results,
    devices: batch[7].results,
    referrers: batch[8].results,
    screens: batch[9].results,
    languages: batch[10].results,
  };

  const response = new Response(JSON.stringify(data), {
    headers: { ...ch, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'X-Cache': 'MISS' },
  });

  // Store in edge cache (non-blocking)
  const cacheResponse = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
  cache.put(cacheKey, cacheResponse).catch(() => {});

  return response;
}

/* ───────── Realtime ───────── */

async function handleRealtime(request, env, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;

  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
  const result = await env.DB.prepare(`
    SELECT COUNT(DISTINCT session_id) as active_visitors, COUNT(*) as recent_views
    FROM page_views WHERE created_at >= ?
  `).bind(fiveMinAgo).first();

  return new Response(JSON.stringify(result), {
    headers: { ...ch, 'Content-Type': 'application/json' },
  });
}

/* ───────── Helpers ───────── */

function authenticate(request, env, ch) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...ch, 'Content-Type': 'application/json' },
    });
  }
  return null;
}

function sanitize(str) {
  return String(str).slice(0, 500);
}

function parseBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/MSIE|Trident/.test(ua)) return 'IE';
  if (/bot|crawl|spider/i.test(ua)) return 'Bot';
  return 'Other';
}

function parseOS(ua) {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return 'Other';
}

function parseDevice(ua) {
  if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile';
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet';
  return 'Desktop';
}
