/**
 * PaddySpeaks Analytics — Cloudflare Worker v2
 *
 * Endpoints:
 *   POST /api/v             — Record page view or exit event
 *   GET  /api/stats         — Dashboard data (60s edge cache)
 *   GET  /api/realtime      — Visitors in last 5 minutes
 *
 * v2 additions: time-on-page, scroll depth, new vs returning,
 *               UTM campaigns, dark mode, timezone, visitor ID
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

/* ───────── Collect (page view + exit events) ───────── */

async function handleCollect(request, env, ctx, ch) {
  try {
    const data = await request.json();
    const cf = request.cf || {};
    const ua = request.headers.get('User-Agent') || '';

    // Filter bots
    if (/bot|crawl|spider|slurp|facebook|twitter|whatsapp|telegram|preview/i.test(ua)) {
      return new Response('ok', { headers: ch });
    }

    // Exit event — update duration and scroll depth on existing row
    if (data.t === 'exit') {
      ctx.waitUntil(
        env.DB.prepare(`
          UPDATE page_views SET duration = ?, scroll_depth = ?
          WHERE session_id = ? AND page = ?
          ORDER BY id DESC LIMIT 1
        `).bind(
          Math.min(data.dur || 0, 3600),
          Math.min(data.scroll || 0, 100),
          sanitize(data.sid || ''),
          sanitize(data.p || '/')
        ).run().catch(e => console.error('Exit update error:', e.message))
      );
      return new Response('ok', { headers: ch });
    }

    // Page view event — insert new row with all dimensions
    ctx.waitUntil(
      env.DB.prepare(`
        INSERT INTO page_views (page, referrer, country, city, region, browser, os, device_type, screen, language, session_id, visitor_id, is_new, viewport, utm_source, utm_medium, utm_campaign, dark_mode, timezone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        sanitize(data.sid || ''),
        sanitize(data.vid || ''),
        data.new ? 1 : 0,
        sanitize(data.v || ''),
        sanitize(data.ut_s || ''),
        sanitize(data.ut_m || ''),
        sanitize(data.ut_c || ''),
        data.dark ? 1 : 0,
        cf.timezone || ''
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

  // Drill-down filters
  const filterCountry = url.searchParams.get('country') || '';
  const filterPage = url.searchParams.get('page') || '';
  const filterCity = url.searchParams.get('city') || '';
  const filterBrowser = url.searchParams.get('browser') || '';
  const filterOs = url.searchParams.get('os') || '';
  const filterDevice = url.searchParams.get('device') || '';
  const filterReferrer = url.searchParams.get('referrer') || '';

  let filterSQL = '';
  const filterBinds = [since];
  if (filterCountry) { filterSQL += ' AND country = ?'; filterBinds.push(filterCountry); }
  if (filterPage) { filterSQL += ' AND page = ?'; filterBinds.push(filterPage); }
  if (filterCity) { filterSQL += ' AND city = ?'; filterBinds.push(filterCity); }
  if (filterBrowser) { filterSQL += ' AND browser = ?'; filterBinds.push(filterBrowser); }
  if (filterOs) { filterSQL += ' AND os = ?'; filterBinds.push(filterOs); }
  if (filterDevice) { filterSQL += ' AND device_type = ?'; filterBinds.push(filterDevice); }
  if (filterReferrer) { filterSQL += ' AND referrer = ?'; filterBinds.push(filterReferrer); }

  const w = 'WHERE created_at >= ?' + filterSQL;
  const b = filterBinds;

  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) as total_views, COUNT(DISTINCT session_id) as unique_visitors, COUNT(DISTINCT visitor_id) as unique_people, ROUND(AVG(CASE WHEN duration > 0 THEN duration END)) as avg_duration, ROUND(AVG(CASE WHEN scroll_depth > 0 THEN scroll_depth END)) as avg_scroll, SUM(CASE WHEN is_new = 1 THEN 1 ELSE 0 END) as new_visitors, SUM(CASE WHEN is_new = 0 THEN 1 ELSE 0 END) as returning_visitors FROM page_views ${w}`).bind(...b),
    env.DB.prepare(`SELECT DATE(created_at) as date, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views ${w} GROUP BY DATE(created_at) ORDER BY date`).bind(...b),
    env.DB.prepare(`SELECT page, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors, ROUND(AVG(CASE WHEN duration > 0 THEN duration END)) as avg_time, ROUND(AVG(CASE WHEN scroll_depth > 0 THEN scroll_depth END)) as avg_scroll FROM page_views ${w} GROUP BY page ORDER BY views DESC LIMIT 25`).bind(...b),
    env.DB.prepare(`SELECT country, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views ${w} GROUP BY country ORDER BY views DESC LIMIT 30`).bind(...b),
    env.DB.prepare(`SELECT city, country, COUNT(*) as views FROM page_views ${w} GROUP BY city, country ORDER BY views DESC LIMIT 25`).bind(...b),
    env.DB.prepare(`SELECT browser, COUNT(*) as views FROM page_views ${w} GROUP BY browser ORDER BY views DESC`).bind(...b),
    env.DB.prepare(`SELECT os, COUNT(*) as views FROM page_views ${w} GROUP BY os ORDER BY views DESC`).bind(...b),
    env.DB.prepare(`SELECT device_type, COUNT(*) as views FROM page_views ${w} GROUP BY device_type ORDER BY views DESC`).bind(...b),
    env.DB.prepare(`SELECT referrer, COUNT(*) as views FROM page_views ${w} AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 20`).bind(...b),
    env.DB.prepare(`SELECT screen, COUNT(*) as views FROM page_views ${w} GROUP BY screen ORDER BY views DESC LIMIT 15`).bind(...b),
    env.DB.prepare(`SELECT language, COUNT(*) as views FROM page_views ${w} GROUP BY language ORDER BY views DESC LIMIT 15`).bind(...b),
    env.DB.prepare(`SELECT utm_source, utm_medium, utm_campaign, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views ${w} AND utm_source != '' GROUP BY utm_source, utm_medium, utm_campaign ORDER BY views DESC LIMIT 20`).bind(...b),
    env.DB.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as views FROM page_views ${w} GROUP BY hour ORDER BY hour`).bind(...b),
    // 13: timezones
    env.DB.prepare(`SELECT timezone, COUNT(*) as views FROM page_views WHERE created_at >= ? AND timezone != '' GROUP BY timezone ORDER BY views DESC LIMIT 15`).bind(since),
  ]);

  const filters = {};
  if (filterCountry) filters.country = filterCountry;
  if (filterPage) filters.page = filterPage;
  if (filterCity) filters.city = filterCity;
  if (filterBrowser) filters.browser = filterBrowser;
  if (filterOs) filters.os = filterOs;
  if (filterDevice) filters.device = filterDevice;
  if (filterReferrer) filters.referrer = filterReferrer;

  const data = {
    period,
    filters,
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
    campaigns: batch[11].results,
    hourly: batch[12].results,
    timezones: batch[13].results,
  };

  const response = new Response(JSON.stringify(data), {
    headers: { ...ch, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'X-Cache': 'MISS' },
  });

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

function sanitize(str) { return String(str).slice(0, 500); }

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
