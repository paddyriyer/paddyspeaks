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
import { normalizeReferrer, sourceOf, botScore, contentGroup } from '../lib/classify.js';
import { median, percentile, retention } from '../lib/metrics.js';
import { generateInsights, classifyContent, classifySources } from '../lib/insights.js';
import { THRESHOLDS } from '../lib/config.js';

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

    if (url.pathname === '/api/e' && request.method === 'POST') {
      return handleEvent(request, env, ctx, ch);
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env, url, ch);
    }

    if (url.pathname === '/api/realtime' && request.method === 'GET') {
      return handleRealtime(request, env, ch);
    }

    if (url.pathname === '/api/insights' && request.method === 'GET') {
      return handleInsights(request, env, url, ch);
    }

    if (url.pathname === '/api/journeys' && request.method === 'GET') {
      return handleJourneys(request, env, url, ch);
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

    // Exit event — update duration and scroll depth on the latest matching row.
    // Fix (audit B): SQLite/D1 does NOT support ORDER BY/LIMIT on UPDATE, so the
    // old statement threw and silently lost time+scroll. Target the row by its
    // primary key via a subselect instead — standard SQL, works on D1.
    if (data.t === 'exit') {
      ctx.waitUntil(
        env.DB.prepare(`
          UPDATE page_views SET duration = ?, scroll_depth = ?
          WHERE id = (
            SELECT id FROM page_views
            WHERE session_id = ? AND page = ?
            ORDER BY id DESC LIMIT 1
          )
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

/* ───────── Versioned event ingest (schema v1) ─────────
 * Writes to the `events` table (migrate-v6-events.sql). Fully decoupled from the
 * page_views path above: if the migration has not been applied yet, the insert
 * fails inside its own catch and page-view collection is completely unaffected.
 * Dedupes on event_id (INSERT OR IGNORE). Classifies bots/internal/referrer
 * server-side and keeps suspected bots VISIBLE (bot_class), never dropped.
 */
async function handleEvent(request, env, ctx, ch) {
  try {
    const d = await request.json();
    const cf = request.cf || {};
    const ua = request.headers.get('User-Agent') || '';
    if (!d || !d.event_name || !d.event_id) return new Response('ok', { headers: ch });

    const ref = normalizeReferrer(d.r || '');
    const props = d.props && typeof d.props === 'object' ? d.props : {};
    const bc = botScore({
      ua,
      asOrg: cf.asOrganization || '',
      interactions: props.interactions || 0,
      pageViews: props.page_num || 1,
      sessionSeconds: props.active_ms ? props.active_ms / 1000 : 0,
    });
    const internal = ref.domain && /paddyspeaks\.com$|(^|\.)interview\.app$/.test(ref.domain) ? 1 : 0;

    ctx.waitUntil((async () => {
      try {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO events (
            event_id, event_name, schema_version, anonymous_visitor_id, session_id,
            client_ts, page_path, page_title, content_group, referrer_domain, referrer_path,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            device_category, browser, operating_system, locale, timezone, country, city,
            viewport, properties, collection_status, bot_class, internal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          sanitize(d.event_id), sanitize(d.event_name), d.schema_version || 1,
          sanitize(d.vid || ''), sanitize(d.sid || ''), sanitize(d.ts || ''),
          sanitize(d.p || '/'), sanitize(d.title || ''), contentGroup(d.p || '/'),
          ref.domain, ref.path,
          sanitize(d.ut_s || ''), sanitize(d.ut_m || ''), sanitize(d.ut_c || ''),
          sanitize(d.ut_t || ''), sanitize(d.ut_ct || ''),
          parseDevice(ua), parseBrowser(ua), parseOS(ua),
          sanitize(d.l || ''), cf.timezone || '', cf.country || 'Unknown', cf.city || 'Unknown',
          sanitize(d.v || ''), JSON.stringify(props).slice(0, 4000), 'full', bc.class, internal
        ).run();

        // Visitor roll-up for correct new/returning + cohorts (best-effort).
        if (d.vid) {
          await env.DB.prepare(`
            INSERT INTO visitors (anonymous_visitor_id, first_seen, last_seen, sessions)
            VALUES (?, datetime('now'), datetime('now'), 1)
            ON CONFLICT(anonymous_visitor_id) DO UPDATE SET last_seen = datetime('now')
          `).bind(sanitize(d.vid)).run();
        }
      } catch (e) { /* migration not yet applied, or transient — never blocks collection */ }
    })());

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
    env.DB.prepare(`SELECT page, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.page, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views WHERE created_at >= ? GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY page HAVING sessions >= 2 ORDER BY sessions DESC LIMIT 20`).bind(since, since),
    // 27: bounce rate by device type
    env.DB.prepare(`SELECT device_type, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.device_type, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views WHERE created_at >= ? GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY device_type ORDER BY sessions DESC`).bind(since, since),
    // 28: bounce rate by referrer source
    env.DB.prepare(`SELECT CASE WHEN referrer = '' THEN 'Direct' WHEN referrer LIKE '%google%' THEN 'Google Search' WHEN referrer LIKE '%linkedin%' THEN 'LinkedIn' WHEN referrer LIKE '%twitter%' OR referrer LIKE '%t.co%' THEN 'Twitter/X' WHEN referrer LIKE '%facebook%' THEN 'Facebook' WHEN referrer LIKE '%chatgpt%' THEN 'ChatGPT' WHEN referrer LIKE '%paddyspeaks%' THEN 'Internal' ELSE 'Other Referral' END as source, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.referrer, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views WHERE created_at >= ? GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY source HAVING sessions >= 2 ORDER BY sessions DESC`).bind(since, since),
    // 29: bounce rate new vs returning
    env.DB.prepare(`SELECT CASE WHEN is_new = 1 THEN 'New Visitor' ELSE 'Returning' END as visitor_type, COUNT(*) as sessions, SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) as bounced, ROUND(100.0 * SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END) / COUNT(*)) as bounce_rate FROM (SELECT pv.session_id, pv.is_new, s.cnt FROM page_views pv INNER JOIN (SELECT session_id, COUNT(*) as cnt FROM page_views WHERE created_at >= ? GROUP BY session_id) s ON pv.session_id = s.session_id WHERE pv.page_num = 1 AND pv.created_at >= ?) GROUP BY visitor_type ORDER BY sessions DESC`).bind(since, since),
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

/* ───────── Decision metrics + insights (Phase 2) ─────────
 * Corrected, decision-oriented aggregates. Engaged sessions, medians, correct
 * session-grain new/returning, source value classes, content 2×2, Studio
 * funnels, data quality — computed with the tested pure libs. Reads page_views
 * (has history) for engagement and `events` (best-effort) for goals/Studio.
 */
async function handleInsights(request, env, url, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;

  const period = url.searchParams.get('period') || '7d';
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 }[period] || 7;
  const nowMs = Date.now();
  const since = new Date(nowMs - days * 86400000).toISOString();
  const prevSince = new Date(nowMs - days * 2 * 86400000).toISOString();
  const T = THRESHOLDS;

  const excludeMe = url.searchParams.get('exclude_me') !== '0';
  const excl = excludeMe ? ' AND visitor_id NOT IN (SELECT visitor_id FROM excluded_visitors)' : '';

  // ── Per-session rollup from page_views (works on existing data) ──
  const sessRoll = `
    SELECT session_id, MIN(created_at) AS start_at,
      MAX(duration) AS dur, MAX(scroll_depth) AS scr, COUNT(*) AS pc,
      MAX(device_type) AS device,
      MAX(CASE WHEN page_num=1 THEN referrer END) AS referrer,
      MAX(CASE WHEN page_num=1 THEN utm_source END) AS utm_source,
      MAX(CASE WHEN page_num=1 THEN utm_medium END) AS utm_medium,
      MAX(visitor_id) AS visitor_id
    FROM page_views WHERE created_at >= ?${excl} GROUP BY session_id LIMIT 20000`;

  const batchA = await env.DB.batch([
    env.DB.prepare(sessRoll).bind(since),
    env.DB.prepare(`SELECT session_id, MAX(duration) AS dur, MAX(scroll_depth) AS scr, COUNT(*) AS pc FROM page_views WHERE created_at >= ? AND created_at < ?${excl} GROUP BY session_id LIMIT 20000`).bind(prevSince, since),
    env.DB.prepare(`SELECT visitor_id, MIN(created_at) AS fs FROM page_views WHERE visitor_id IN (SELECT DISTINCT visitor_id FROM page_views WHERE created_at >= ?) GROUP BY visitor_id`).bind(since),
    env.DB.prepare(`SELECT page,
        COUNT(DISTINCT session_id) AS readers,
        SUM(CASE WHEN page_num=1 THEN 1 ELSE 0 END) AS entrances,
        COUNT(DISTINCT CASE WHEN scroll_depth>=? OR duration>=? THEN session_id END) AS engaged_readers,
        ROUND(AVG(CASE WHEN duration>0 THEN duration END)) AS avg_time
      FROM page_views WHERE created_at >= ?${excl} AND page LIKE '/articles/%'
      GROUP BY page HAVING readers >= 3 ORDER BY readers DESC LIMIT 100`).bind(T.engagedScrollPct, T.engagedActiveSeconds, since),
    env.DB.prepare(`SELECT DATE(created_at) AS d, COUNT(DISTINCT session_id) AS sessions FROM page_views WHERE created_at >= ?${excl} GROUP BY d ORDER BY d`).bind(since),
  ]);

  const sessions = batchA[0].results || [];
  const prevSessions = batchA[1].results || [];
  const firstSeen = new Map((batchA[2].results || []).map(r => [r.visitor_id, Date.parse(r.fs)]));
  const pageRows = batchA[3].results || [];
  const dailySeries = (batchA[4].results || []).map(r => ({ date: r.d, sessions: r.sessions }));

  const engaged = s => (s.dur >= T.engagedActiveSeconds) || (s.scr >= T.engagedScrollPct) || (s.pc >= T.engagedMinPageViews);
  const meaningfulRow = s => (s.scr >= T.engagedScrollPct) || (s.dur >= T.engagedActiveSeconds);

  // Overview
  const totalSessions = sessions.length;
  const engagedSessions = sessions.filter(engaged).length;
  const engagementRate = totalSessions ? engagedSessions / totalSessions : null;
  const durations = sessions.filter(s => s.dur > 0).map(s => s.dur);
  const scrolls = sessions.filter(s => s.scr > 0).map(s => s.scr);
  const visitorsSet = new Set(sessions.map(s => s.visitor_id));
  const totalVisitors = visitorsSet.size;

  // Correct new/returning (session grain, first-seen based) — fixes audit A
  const returningVisitors = new Set();
  for (const s of sessions) {
    const fs = firstSeen.get(s.visitor_id);
    if (fs != null && Math.floor(Date.parse(s.start_at) / 86400000) > Math.floor(fs / 86400000)) returningVisitors.add(s.visitor_id);
  }
  const meaningfulVisitors = new Set(sessions.filter(meaningfulRow).map(s => s.visitor_id));

  // Previous period (engagement only, for comparison)
  const prevEngaged = prevSessions.filter(engaged).length;
  const prevEngagementRate = prevSessions.length ? prevEngaged / prevSessions.length : null;

  // Sources (classified)
  const sessionSource = new Map();
  const srcAgg = new Map();
  for (const s of sessions) {
    const src = sourceOf({ referrer: s.referrer || '', utm_source: s.utm_source || '', utm_medium: s.utm_medium || '' });
    sessionSource.set(s.session_id, src);
    if (!srcAgg.has(src)) srcAgg.set(src, { source: src, visitorsSet: new Set(), sessions: 0, engaged: 0, durs: [], pages: 0, returning: new Set() });
    const g = srcAgg.get(src);
    g.visitorsSet.add(s.visitor_id); g.sessions++; g.pages += s.pc;
    if (engaged(s)) g.engaged++;
    if (s.dur > 0) g.durs.push(s.dur);
    if (returningVisitors.has(s.visitor_id)) g.returning.add(s.visitor_id);
  }
  let sources = [...srcAgg.values()].map(g => ({
    source: g.source, visitors: g.visitorsSet.size, sessions: g.sessions,
    engagedSessions: g.engaged, engagementRate: g.sessions ? g.engaged / g.sessions : 0,
    medianActiveS: median(g.durs), pagesPerSession: g.sessions ? +(g.pages / g.sessions).toFixed(1) : 0,
    returningRate: g.visitorsSet.size ? g.returning.size / g.visitorsSet.size : 0,
  }));
  sources = classifySources(sources).sort((a, b) => b.visitors - a.visitors);

  // Content (2×2)
  let content = pageRows.map(r => ({
    path: r.page, readers: r.readers, entrances: r.entrances,
    engagedReaders: r.engaged_readers, engagementRate: r.readers ? r.engaged_readers / r.readers : 0,
    avgTime: r.avg_time || 0,
  }));
  content = classifyContent(content);

  // Data quality (page_views side)
  const durationCoverage = totalSessions ? durations.length / totalSessions : null;
  const scrollCoverage = totalSessions ? scrolls.length / totalSessions : null;

  // Device split for mobile-friction insight
  const dev = { mobile: { e: 0, n: 0 }, desktop: { e: 0, n: 0 } };
  for (const s of sessions) {
    const k = s.device === 'Mobile' ? 'mobile' : (s.device === 'Desktop' ? 'desktop' : null);
    if (k) { dev[k].n++; if (engaged(s)) dev[k].e++; }
  }

  // ── Events side (goals + Studio + bot rate) — best-effort ──
  let goalsCount = 0, conversionVisitors = new Set(), interviewCompletions = 0;
  let studio = { visitors: 0, starts: 0, completions: 0, completionRate: null, prevCompletionRate: null, funnel: {}, tracks: [], abandonStep: '' };
  let dqEvents = { botRate: null, internalRate: null, lastEventAt: null, freshnessMin: null };
  let searchGaps = 0;
  try {
    const batchB = await env.DB.batch([
      env.DB.prepare(`SELECT session_id, anonymous_visitor_id AS vid, event_name, properties FROM events WHERE occurred_at >= ? AND event_name IN ('question_completed','quiz_completed','simulator_completed','related_click','cta_click') LIMIT 20000`).bind(since),
      env.DB.prepare(`SELECT event_name, COUNT(DISTINCT anonymous_visitor_id) AS v FROM events WHERE occurred_at >= ? AND event_name IN ('interview_studio_opened','track_viewed','track_selected','question_viewed','question_started','answer_submitted','question_completed','quiz_started','quiz_completed') GROUP BY event_name`).bind(since),
      env.DB.prepare(`SELECT json_extract(properties,'$.track') AS track,
          COUNT(DISTINCT anonymous_visitor_id) AS visitors,
          SUM(CASE WHEN event_name='question_started' THEN 1 ELSE 0 END) AS starts,
          SUM(CASE WHEN event_name='question_completed' THEN 1 ELSE 0 END) AS completions,
          SUM(CASE WHEN event_name='answer_submitted' THEN 1 ELSE 0 END) AS answers,
          SUM(CASE WHEN event_name='answer_correct' THEN 1 ELSE 0 END) AS correct,
          SUM(CASE WHEN event_name='hint_requested' THEN 1 ELSE 0 END) AS hints
        FROM events WHERE occurred_at >= ? AND json_extract(properties,'$.track') IS NOT NULL GROUP BY track ORDER BY visitors DESC`).bind(since),
      env.DB.prepare(`SELECT bot_class, SUM(internal) AS internal, COUNT(*) AS c FROM events WHERE occurred_at >= ? GROUP BY bot_class`).bind(since),
      env.DB.prepare(`SELECT MAX(occurred_at) AS last FROM events`),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM events WHERE occurred_at >= ? AND event_name='no_search_results'`).bind(since),
      env.DB.prepare(`SELECT SUM(CASE WHEN event_name='question_started' THEN 1 ELSE 0 END) AS starts, SUM(CASE WHEN event_name='question_completed' THEN 1 ELSE 0 END) AS completions, COUNT(DISTINCT anonymous_visitor_id) AS visitors FROM events WHERE occurred_at >= ? AND occurred_at < ?`).bind(prevSince, since),
    ]);

    for (const g of (batchB[0].results || [])) {
      goalsCount++;
      if (g.vid) conversionVisitors.add(g.vid);
      if (['question_completed', 'quiz_completed', 'simulator_completed'].includes(g.event_name)) interviewCompletions++;
    }
    const funnel = {}; for (const r of (batchB[1].results || [])) funnel[r.event_name] = r.v;
    studio.funnel = funnel;
    studio.visitors = funnel.interview_studio_opened || funnel.question_viewed || 0;
    studio.starts = (funnel.question_started || 0) + (funnel.quiz_started || 0);
    studio.completions = (funnel.question_completed || 0) + (funnel.quiz_completed || 0);
    studio.completionRate = studio.starts ? studio.completions / studio.starts : null;
    studio.tracks = (batchB[2].results || []).map(t => ({
      track: t.track, visitors: t.visitors, starts: t.starts, completions: t.completions,
      completionRate: t.starts ? t.completions / t.starts : null,
      correctRate: t.answers ? t.correct / t.answers : null,
      hintRate: t.starts ? t.hints / t.starts : null,
    }));
    let totalEv = 0, botEv = 0, internalEv = 0;
    for (const r of (batchB[3].results || [])) { totalEv += r.c; if (r.bot_class !== 'human') botEv += r.c; internalEv += (r.internal || 0); }
    if (totalEv) { dqEvents.botRate = botEv / totalEv; dqEvents.internalRate = internalEv / totalEv; }
    dqEvents.lastEventAt = (batchB[4].results && batchB[4].results[0] && batchB[4].results[0].last) || null;
    if (dqEvents.lastEventAt) dqEvents.freshnessMin = Math.round((nowMs - Date.parse(dqEvents.lastEventAt)) / 60000);
    searchGaps = (batchB[5].results && batchB[5].results[0] && batchB[5].results[0].c) || 0;
    const pv = batchB[6].results && batchB[6].results[0];
    if (pv && pv.starts) studio.prevCompletionRate = pv.completions / pv.starts;
  } catch (e) { /* events table not migrated yet — Studio/goal sections stay empty */ }

  // Meaningful visitors also counts anyone who completed a goal
  for (const v of conversionVisitors) meaningfulVisitors.add(v);

  const overview = {
    sessions: totalSessions, engagedSessions, engagementRate,
    bounceRate: engagementRate == null ? null : 1 - engagementRate,
    visitors: totalVisitors, returningVisitors: returningVisitors.size,
    returningRate: totalVisitors ? returningVisitors.size / totalVisitors : null,
    newVisitors: totalVisitors - returningVisitors.size,
    meaningfulVisitors: meaningfulVisitors.size,
    medianActiveS: median(durations), p75ActiveS: percentile(durations, 75),
    medianScroll: median(scrolls),
    goals: goalsCount, conversionRate: totalVisitors ? conversionVisitors.size / totalVisitors : null,
    interviewCompletions,
    smallSample: totalSessions < T.smallSampleFloor,
  };

  const dataQuality = { durationCoverage, scrollCoverage, ...dqEvents };

  // Build the aggregate the insight engine consumes
  const agg = {
    current: {
      sessions: totalSessions, engagementRate, visitors: totalVisitors,
      goals: goalsCount, conversionRate: overview.conversionRate, medianActiveS: overview.medianActiveS,
    },
    previous: { sessions: prevSessions.length, engagementRate: prevEngagementRate, studioVisitors: (studio && studio.prevVisitors) || null },
    sources, content, searchGaps, dailySeries,
    byDevice: {
      mobile: { engagementRate: dev.mobile.n ? dev.mobile.e / dev.mobile.n : 0, sessions: dev.mobile.n },
      desktop: { engagementRate: dev.desktop.n ? dev.desktop.e / dev.desktop.n : 0, sessions: dev.desktop.n },
    },
    dataQuality,
    studio: { visitors: studio.visitors, completionRate: studio.completionRate, prevCompletionRate: studio.prevCompletionRate, abandonStep: studio.abandonStep },
  };
  const insights = generateInsights(agg);

  const body = JSON.stringify({
    period, thresholds: T, overview,
    previous: { sessions: prevSessions.length, engagementRate: prevEngagementRate },
    sources, content, studio, dataQuality, searchGaps, insights,
  });
  return new Response(body, { headers: { ...ch, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
}

/* ───────── Journeys & Retention (Phase 4) ─────────
 * Weekly retention cohorts (Day 1/7/30, incomplete windows rendered null — never
 * 0) + anonymous path analysis (landings, transitions, exits, cross-domain).
 * All from page_views (history); no raw IP or PII exposed.
 */
function weekKey(ms) {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // Monday=0
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  return mon.toISOString().slice(0, 10);
}

async function handleJourneys(request, env, url, ch) {
  const authError = authenticate(request, env, ch);
  if (authError) return authError;
  const period = url.searchParams.get('period') || '30d';
  const days = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 }[period] || 30;
  const nowMs = Date.now();
  const since = new Date(nowMs - days * 86400000).toISOString();
  const cohortSince = new Date(nowMs - 63 * 86400000).toISOString(); // 9 weeks of cohorts
  const excludeMe = url.searchParams.get('exclude_me') !== '0';
  const excl = excludeMe ? ' AND visitor_id NOT IN (SELECT visitor_id FROM excluded_visitors)' : '';

  const batch = await env.DB.batch([
    // Cohort visitors: first-seen (all-time) within the last 9 weeks
    env.DB.prepare(`SELECT visitor_id, MIN(created_at) AS fs FROM page_views GROUP BY visitor_id HAVING fs >= ?`).bind(cohortSince),
    // Activity days for the cohort window (bounded)
    env.DB.prepare(`SELECT DISTINCT visitor_id, DATE(created_at) AS d FROM page_views WHERE created_at >= ? LIMIT 100000`).bind(cohortSince),
    // Session page sequences for the selected period
    env.DB.prepare(`SELECT session_id, page, id FROM page_views WHERE created_at >= ?${excl} ORDER BY session_id, id LIMIT 50000`).bind(since),
  ]);

  const cohortRows = batch[0].results || [];
  const activityRows = batch[1].results || [];
  const seqRows = batch[2].results || [];
  const DAY = 86400000;

  // ── Retention cohorts by ISO week ──
  const activeByVisitorDay = new Set();
  for (const r of activityRows) activeByVisitorDay.add(`${r.visitor_id}:${Math.floor(Date.parse(r.d + 'T00:00:00Z') / DAY)}`);
  const weeks = new Map();
  for (const r of cohortRows) {
    const fs = Date.parse(r.fs);
    const wk = weekKey(fs);
    if (!weeks.has(wk)) weeks.set(wk, new Map());
    weeks.get(wk).set(r.visitor_id, fs);
  }
  const retentionDays = [1, 7, 30];
  const cohorts = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([wk, cohortMap]) => {
    const r = retention(cohortMap, activeByVisitorDay, nowMs, retentionDays);
    return { week: wk, size: r.size, d1: r.windows[1], d7: r.windows[7], d30: r.windows[30] };
  });

  // ── Path analysis ──
  const bySession = new Map();
  for (const r of seqRows) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    bySession.get(r.session_id).push(r.page);
  }
  const landings = new Map(), exits = new Map(), transitions = new Map(), paths = new Map();
  let crossDomain = 0;
  const isStudio = p => /^\/interview/.test(p || '');
  for (const seq of bySession.values()) {
    if (!seq.length) continue;
    landings.set(seq[0], (landings.get(seq[0]) || 0) + 1);
    exits.set(seq[seq.length - 1], (exits.get(seq[seq.length - 1]) || 0) + 1);
    for (let i = 0; i < seq.length - 1; i++) {
      const key = seq[i] + ' → ' + seq[i + 1];
      transitions.set(key, (transitions.get(key) || 0) + 1);
      if (isStudio(seq[i]) !== isStudio(seq[i + 1])) crossDomain++;
    }
    const pk = seq.slice(0, 3).join(' → ');
    paths.set(pk, (paths.get(pk) || 0) + 1);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

  const body = JSON.stringify({
    period,
    retention: { days: retentionDays, cohorts },
    landings: top(landings, 15),
    transitions: top(transitions, 20),
    exits: top(exits, 15),
    paths: top(paths, 15),
    crossDomainTransitions: crossDomain,
    sessions: bySession.size,
  });
  return new Response(body, { headers: { ...ch, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
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
