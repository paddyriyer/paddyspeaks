/**
 * PaddySpeaks Analytics — Cloudflare Worker
 *
 * Endpoints:
 *   POST /collect         — Record a page view (called by tracker.js)
 *   GET  /api/stats       — Return dashboard data (requires auth)
 *   GET  /api/realtime    — Visitors in last 5 minutes
 *
 * Geo data (country, city, region) comes free from request.cf
 * Browser/OS/device parsed from User-Agent server-side
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/collect' && request.method === 'POST') {
      return handleCollect(request, env);
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env, url);
    }

    if (url.pathname === '/api/realtime' && request.method === 'GET') {
      return handleRealtime(request, env);
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};

/* ───────── Collect Page View ───────── */

async function handleCollect(request, env) {
  try {
    const data = await request.json();
    const cf = request.cf || {};
    const ua = request.headers.get('User-Agent') || '';

    await env.DB.prepare(`
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
    ).run();

    return new Response('ok', { headers: CORS_HEADERS });
  } catch (e) {
    console.error('Collect error:', e.message);
    return new Response('error', { status: 500, headers: CORS_HEADERS });
  }
}

/* ───────── Dashboard Stats ───────── */

async function handleStats(request, env, url) {
  const authError = authenticate(request, env);
  if (authError) return authError;

  const period = url.searchParams.get('period') || '7d';
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 }[period] || 7;

  const since = new Date(Date.now() - days * 86400000).toISOString();

  const queries = [
    // 0: overview
    env.DB.prepare(`
      SELECT COUNT(*) as total_views,
             COUNT(DISTINCT session_id) as unique_visitors
      FROM page_views WHERE created_at >= ?`).bind(since).first(),

    // 1: daily
    env.DB.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as views,
             COUNT(DISTINCT session_id) as visitors
      FROM page_views WHERE created_at >= ?
      GROUP BY DATE(created_at) ORDER BY date`).bind(since).all(),

    // 2: top pages
    env.DB.prepare(`
      SELECT page, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors
      FROM page_views WHERE created_at >= ?
      GROUP BY page ORDER BY views DESC LIMIT 25`).bind(since).all(),

    // 3: countries
    env.DB.prepare(`
      SELECT country, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors
      FROM page_views WHERE created_at >= ?
      GROUP BY country ORDER BY views DESC LIMIT 30`).bind(since).all(),

    // 4: cities
    env.DB.prepare(`
      SELECT city, country, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY city, country ORDER BY views DESC LIMIT 25`).bind(since).all(),

    // 5: browsers
    env.DB.prepare(`
      SELECT browser, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY browser ORDER BY views DESC`).bind(since).all(),

    // 6: OS
    env.DB.prepare(`
      SELECT os, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY os ORDER BY views DESC`).bind(since).all(),

    // 7: devices
    env.DB.prepare(`
      SELECT device_type, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY device_type ORDER BY views DESC`).bind(since).all(),

    // 8: referrers
    env.DB.prepare(`
      SELECT referrer, COUNT(*) as views
      FROM page_views WHERE created_at >= ? AND referrer != ''
      GROUP BY referrer ORDER BY views DESC LIMIT 20`).bind(since).all(),

    // 9: screens
    env.DB.prepare(`
      SELECT screen, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY screen ORDER BY views DESC LIMIT 15`).bind(since).all(),

    // 10: languages
    env.DB.prepare(`
      SELECT language, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY language ORDER BY views DESC LIMIT 15`).bind(since).all(),
  ];

  const results = await Promise.all(queries);

  return jsonResponse({
    period,
    overview: results[0],
    daily: results[1].results,
    topPages: results[2].results,
    countries: results[3].results,
    cities: results[4].results,
    browsers: results[5].results,
    oses: results[6].results,
    devices: results[7].results,
    referrers: results[8].results,
    screens: results[9].results,
    languages: results[10].results,
  });
}

/* ───────── Realtime ───────── */

async function handleRealtime(request, env) {
  const authError = authenticate(request, env);
  if (authError) return authError;

  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
  const result = await env.DB.prepare(`
    SELECT COUNT(DISTINCT session_id) as active_visitors,
           COUNT(*) as recent_views
    FROM page_views WHERE created_at >= ?
  `).bind(fiveMinAgo).first();

  return jsonResponse(result);
}

/* ───────── Helpers ───────── */

function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  return null;
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
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
