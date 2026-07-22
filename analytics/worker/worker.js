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

import { routeLeaderboard } from './leaderboard.js';
import { routeMock } from './mock.js';

function cors(request) {
  const origin = request.headers.get('Origin') || 'https://paddyspeaks.com';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

    if (url.pathname === '/api/export' && request.method === 'GET') {
      return handleExport(request, env, url, ch);
    }

    if (url.pathname === '/api/exclude' && request.method === 'POST') {
      return handleExcludeAdd(request, env, ch);
    }

    if (url.pathname === '/api/exclude' && request.method === 'DELETE') {
      return handleExcludeRemove(request, env, ch);
    }

    if (url.pathname === '/api/exclude' && request.method === 'GET') {
      return handleExcludeList(request, env, ch);
    }

    // Anonymous leaderboard (separate D1 `LB` + HMAC secret; see leaderboard.js)
    const lb = await routeLeaderboard(request, env, url, ch);
    if (lb) return lb;

    // AI Mock Interview (safe-degrades to 503 until ANTHROPIC_API_KEY is set)
    const mk = await routeMock(request, env, url, ch);
    if (mk) return mk;

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
        INSERT INTO page_views (page, referrer, country, city, region, browser, os, device_type, screen, language, session_id, visitor_id, is_new, viewport, utm_source, utm_medium, utm_campaign, dark_mode, timezone, asn, as_org, page_num, search_query, is_404, load_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        cf.timezone || '',
        cf.asn || 0,
        cf.asOrganization || '',
        data.pc || 1,
        sanitize(data.sq || ''),
        data.is404 ? 1 : 0,
        data.lt || 0
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
  const filterOrg = url.searchParams.get('as_org') || '';

  let filterSQL = '';
  const filterBinds = [since];
  if (filterCountry) { filterSQL += ' AND country = ?'; filterBinds.push(filterCountry); }
  if (filterPage) { filterSQL += ' AND page = ?'; filterBinds.push(filterPage); }
  if (filterCity) { filterSQL += ' AND city = ?'; filterBinds.push(filterCity); }
  if (filterBrowser) { filterSQL += ' AND browser = ?'; filterBinds.push(filterBrowser); }
  if (filterOs) { filterSQL += ' AND os = ?'; filterBinds.push(filterOs); }
  if (filterDevice) { filterSQL += ' AND device_type = ?'; filterBinds.push(filterDevice); }
  if (filterReferrer) { filterSQL += ' AND referrer = ?'; filterBinds.push(filterReferrer); }
  if (filterOrg) { filterSQL += ' AND as_org = ?'; filterBinds.push(filterOrg); }

  // Exclude admin visitors
  const excludeMe = url.searchParams.get('exclude_me') !== '0';
  if (excludeMe) {
    filterSQL += ' AND visitor_id NOT IN (SELECT visitor_id FROM excluded_visitors)';
  }

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
    // 14: day of week
    env.DB.prepare(`SELECT CAST(strftime('%w', created_at) AS INTEGER) as dow, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM page_views ${w} GROUP BY dow ORDER BY dow`).bind(...b),
    // 15: recent activity (last 50 visits with full context)
    env.DB.prepare(`SELECT created_at, page, country, city, browser, os, device_type, referrer, duration, scroll_depth, is_new, utm_source, as_org FROM page_views ${w} ORDER BY created_at DESC LIMIT 50`).bind(...b),
    // 16: organizations (company/ISP from ASN)
    env.DB.prepare(`SELECT as_org, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors, COUNT(DISTINCT visitor_id) as people FROM page_views ${w} AND as_org != '' GROUP BY as_org ORDER BY views DESC LIMIT 30`).bind(...b),
    // 17: content groups
    env.DB.prepare(`SELECT CASE WHEN page LIKE '/articles/%' AND page LIKE '%gita%' OR page LIKE '%shankara%' OR page LIKE '%govindam%' OR page LIKE '%vedant%' OR page LIKE '%lotus%' OR page LIKE '%skull%' OR page LIKE '%discipline%' OR page LIKE '%chamakam%' OR page LIKE '%ashtavakra%' OR page LIKE '%narayaneeyam%' OR page LIKE '%frankl%' OR page LIKE '%fear-greed%' OR page LIKE '%death-fear%' OR page LIKE '%frenemies%' OR page LIKE '%prana%' OR page LIKE '%breathing%' OR page LIKE '%dharmakshetre%' THEN 'Philosophy' WHEN page LIKE '/interview%' THEN 'Interview Prep' WHEN page LIKE '/bhagavad-gita/%' OR page LIKE '/vishnu-sahasranama/%' OR page LIKE '/lalitha-sahasranama/%' OR page LIKE '/hanumanchalisa/%' OR page LIKE '/rudramchamakam/%' OR page LIKE '/soundarya-Lahari/%' OR page LIKE '/narayaneeyam/%' OR page LIKE '/bhaja-govindam/%' OR page LIKE '/durga-suktam/%' OR page LIKE '/sri-suktam/%' OR page LIKE '/purusha-suktam/%' OR page LIKE '/medha-suktam/%' OR page LIKE '/aditya-hridayam/%' OR page LIKE '/bajrang-baan/%' OR page LIKE '/sandhyavandanam/%' OR page LIKE '/navagraha/%' OR page LIKE '/abhirami-andhadhi/%' OR page LIKE '/subramanya-bhujangam/%' OR page LIKE '/rama-raksha-stotram/%' OR page LIKE '/ApaduddharakaStotram/%' OR page LIKE '/shashtikavacham/%' OR page LIKE '/mahAnyAsam/%' OR page LIKE '/amavasya-tharpanam/%' THEN 'Sacred Texts' WHEN page LIKE '/articles/%' THEN 'Technology' WHEN page = '/' OR page = '/index.html' THEN 'Homepage' ELSE 'Other' END as content_group, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors, ROUND(AVG(CASE WHEN duration > 0 THEN duration END)) as avg_time FROM page_views ${w} GROUP BY content_group ORDER BY views DESC`).bind(...b),
    // 18: bounce rate (sessions with only 1 page view)
    env.DB.prepare(`SELECT COUNT(*) as total_sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced_sessions FROM (SELECT session_id, COUNT(*) as cnt FROM page_views ${w} GROUP BY session_id)`).bind(...b),
    // 19: previous period overview (for week-over-week comparison)
    env.DB.prepare(`SELECT COUNT(*) as total_views, COUNT(DISTINCT session_id) as unique_visitors FROM page_views WHERE created_at >= ? AND created_at < ?` + (excludeMe ? ' AND visitor_id NOT IN (SELECT visitor_id FROM excluded_visitors)' : '')).bind(new Date(Date.now() - days * 2 * 86400000).toISOString(), since),
    // 20-25: existing queries...
    env.DB.prepare(`SELECT page, COUNT(*) as entries FROM page_views ${w} AND page_num = 1 GROUP BY page ORDER BY entries DESC LIMIT 15`).bind(...b),
    env.DB.prepare(`SELECT page, COUNT(*) as exits FROM (SELECT session_id, page, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn FROM page_views ${w}) WHERE rn = 1 GROUP BY page ORDER BY exits DESC LIMIT 15`).bind(...b),
    env.DB.prepare(`SELECT search_query, COUNT(*) as views FROM page_views ${w} AND search_query != '' GROUP BY search_query ORDER BY views DESC LIMIT 20`).bind(...b),
    env.DB.prepare(`SELECT page, COUNT(*) as hits, MAX(created_at) as last_hit FROM page_views ${w} AND is_404 = 1 GROUP BY page ORDER BY hits DESC LIMIT 15`).bind(...b),
    env.DB.prepare(`SELECT page, COUNT(*) as total, SUM(CASE WHEN scroll_depth >= 75 AND duration >= 60 THEN 1 ELSE 0 END) as completed, ROUND(100.0 * SUM(CASE WHEN scroll_depth >= 75 AND duration >= 60 THEN 1 ELSE 0 END) / COUNT(*)) as completion_rate FROM page_views ${w} AND page LIKE '/articles/%' GROUP BY page HAVING total >= 2 ORDER BY completion_rate DESC LIMIT 20`).bind(...b),
    env.DB.prepare(`SELECT ROUND(AVG(CASE WHEN load_time > 0 AND load_time < 30000 THEN load_time END)) as avg_load, ROUND(MAX(CASE WHEN load_time > 0 THEN load_time END)) as max_load FROM page_views ${w}`).bind(...b),
    // 26: bounce rate by landing page
    env.DB.prepare(`SELECT page, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.page, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views ${w} GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY page HAVING sessions >= 2 ORDER BY sessions DESC LIMIT 20`).bind(...b, since),
    // 27: bounce rate by device type
    env.DB.prepare(`SELECT device_type, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.device_type, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views ${w} GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY device_type ORDER BY sessions DESC`).bind(...b, since),
    // 28: bounce rate by referrer source
    env.DB.prepare(`SELECT CASE WHEN referrer = '' THEN 'Direct' WHEN referrer LIKE '%google%' THEN 'Google Search' WHEN referrer LIKE '%linkedin%' THEN 'LinkedIn' WHEN referrer LIKE '%twitter%' OR referrer LIKE '%t.co%' THEN 'Twitter/X' WHEN referrer LIKE '%facebook%' THEN 'Facebook' WHEN referrer LIKE '%chatgpt%' THEN 'ChatGPT' WHEN referrer LIKE '%paddyspeaks%' THEN 'Internal' ELSE 'Other Referral' END as source, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.referrer, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views ${w} GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY source HAVING sessions >= 2 ORDER BY sessions DESC`).bind(...b, since),
    // 29: bounce rate new vs returning
    env.DB.prepare(`SELECT CASE WHEN is_new = 1 THEN 'New Visitor' ELSE 'Returning' END as visitor_type, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.is_new, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views ${w} GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY visitor_type ORDER BY sessions DESC`).bind(...b, since),
  ]);

  const filters = {};
  if (filterCountry) filters.country = filterCountry;
  if (filterPage) filters.page = filterPage;
  if (filterCity) filters.city = filterCity;
  if (filterBrowser) filters.browser = filterBrowser;
  if (filterOs) filters.os = filterOs;
  if (filterDevice) filters.device = filterDevice;
  if (filterReferrer) filters.referrer = filterReferrer;
  if (filterOrg) filters.as_org = filterOrg;

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
    dayOfWeek: batch[14].results,
    recentActivity: batch[15].results,
    organizations: batch[16].results,
    contentGroups: batch[17].results,
    bounce: batch[18].results[0] || { total_sessions: 0, bounced_sessions: 0 },
    previousPeriod: batch[19].results[0] || { total_views: 0, unique_visitors: 0 },
    entryPages: batch[20].results,
    exitPages: batch[21].results,
    searchKeywords: batch[22].results,
    notFoundPages: batch[23].results,
    readingCompletion: batch[24].results,
    performance: batch[25].results[0] || { avg_load: 0, max_load: 0 },
    bounceByPage: batch[26].results,
    bounceByDevice: batch[27].results,
    bounceBySource: batch[28].results,
    bounceByVisitorType: batch[29].results,
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

/* ───────── CSV Export ───────── */

async function handleExport(request, env, url, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;

  const period = url.searchParams.get('period') || '30d';
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 }[period] || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const result = await env.DB.prepare(`
    SELECT created_at, page, referrer, country, city, region, browser, os, device_type, screen, language, duration, scroll_depth, is_new, utm_source, utm_medium, utm_campaign, as_org, timezone
    FROM page_views WHERE created_at >= ?
    ORDER BY created_at DESC LIMIT 10000
  `).bind(since).all();

  const headers = ['date','page','referrer','country','city','region','browser','os','device','screen','language','duration_sec','scroll_pct','is_new','utm_source','utm_medium','utm_campaign','organization','timezone'];
  let csv = headers.join(',') + '\n';
  for (const r of result.results) {
    csv += [r.created_at, '"'+r.page+'"', '"'+r.referrer+'"', r.country, '"'+r.city+'"', '"'+r.region+'"', r.browser, r.os, r.device_type, r.screen, r.language, r.duration, r.scroll_depth, r.is_new, r.utm_source, r.utm_medium, r.utm_campaign, '"'+r.as_org+'"', r.timezone].join(',') + '\n';
  }

  return new Response(csv, {
    headers: {
      ...ch,
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="paddyspeaks-analytics-' + period + '.csv"',
    },
  });
}

/* ───────── Exclude Visitors ───────── */

async function handleExcludeAdd(request, env, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;
  try {
    const data = await request.json();
    const vid = data.visitor_id;
    const label = data.label || '';
    if (!vid) return new Response(JSON.stringify({ error: 'Missing visitor_id' }), { status: 400, headers: { ...ch, 'Content-Type': 'application/json' } });
    await env.DB.prepare('INSERT OR IGNORE INTO excluded_visitors (visitor_id, label) VALUES (?, ?)').bind(vid, label).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...ch, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...ch, 'Content-Type': 'application/json' } });
  }
}

async function handleExcludeRemove(request, env, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;
  try {
    const data = await request.json();
    await env.DB.prepare('DELETE FROM excluded_visitors WHERE visitor_id = ?').bind(data.visitor_id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...ch, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...ch, 'Content-Type': 'application/json' } });
  }
}

async function handleExcludeList(request, env, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;
  const result = await env.DB.prepare('SELECT visitor_id, label, created_at FROM excluded_visitors ORDER BY created_at DESC').all();
  return new Response(JSON.stringify(result.results), { headers: { ...ch, 'Content-Type': 'application/json' } });
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
