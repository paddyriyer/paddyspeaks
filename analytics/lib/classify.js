/**
 * PaddySpeaks Analytics — pure classification & normalization helpers.
 * No I/O, no globals — safe to import in the Worker and unit-test in node.
 * Fixes audit findings E (referrer), F (bots), I (paths/content group).
 */

const PS_DOMAINS = ['paddyspeaks.com', 'ps.paddyspeaks.com', 'www.paddyspeaks.com', 'interview.app'];

const AI_ASSISTANTS = ['chatgpt.com', 'chat.openai.com', 'openai.com', 'perplexity.ai', 'gemini.google.com', 'bard.google.com', 'claude.ai', 'copilot.microsoft.com', 'you.com'];
const SEARCH_ENGINES = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'yandex.', 'ecosia.org', 'baidu.com', 'startpage.com', 'brave.com'];
const SOCIAL = ['twitter.com', 'x.com', 't.co', 'facebook.com', 'fb.com', 'lnkd.in', 'reddit.com', 'youtube.com', 'youtu.be', 'instagram.com', 'threads.net', 'pinterest.', 'mastodon.', 'bsky.app', 'news.ycombinator.com'];
const LINKEDIN = ['linkedin.com', 'lnkd.in'];

/** eTLD+1-ish host extractor. Strips leading www.; keeps the last 2–3 labels. */
export function domainOf(urlOrHost) {
  if (!urlOrHost) return '';
  let host = String(urlOrHost);
  try {
    if (host.includes('://')) host = new URL(host).hostname;
  } catch { /* not a URL, treat as host */ }
  host = host.replace(/^www\./i, '').toLowerCase();
  return host;
}

/** Split a referrer URL into { domain, path } with query/hash stripped (privacy). */
export function normalizeReferrer(ref) {
  if (!ref) return { domain: '', path: '' };
  try {
    const u = new URL(ref);
    return { domain: domainOf(u.hostname), path: canonicalPath(u.pathname) };
  } catch {
    return { domain: domainOf(ref), path: '' };
  }
}

/** Canonicalize a path: lower-case, drop index.html, drop trailing slash (keep root). */
export function canonicalPath(path) {
  if (!path) return '/';
  let p = String(path).split('?')[0].split('#')[0].toLowerCase();
  p = p.replace(/\/index\.html?$/i, '/');
  if (p.length > 1) p = p.replace(/\/+$/,'');
  return p || '/';
}

/**
 * Deterministic acquisition source. Ordered so the most specific wins.
 * @returns one of: internal, email, ai_assistant, linkedin, organic_search,
 *          social, referral, direct, unknown
 */
export function sourceOf({ referrer = '', utm_source = '', utm_medium = '', internal = false } = {}) {
  const d = normalizeReferrer(referrer).domain;
  const us = (utm_source || '').toLowerCase();
  const um = (utm_medium || '').toLowerCase();

  if (internal || PS_DOMAINS.includes(d)) return 'internal';
  if (['email', 'newsletter'].includes(um)) return 'email';
  if (AI_ASSISTANTS.some(x => d === x || d.endsWith('.' + x)) || AI_ASSISTANTS.includes(us) || us === 'chatgpt') return 'ai_assistant';
  if (LINKEDIN.includes(d) || us === 'linkedin') return 'linkedin';
  if (!us && SEARCH_ENGINES.some(s => d.includes(s))) return 'organic_search';
  if (SOCIAL.some(x => d === x || d.endsWith('.' + x)) || ['facebook','twitter','reddit','youtube','instagram'].includes(us)) return 'social';
  if (d) return 'referral';
  if (!d && !us) return 'direct';
  return 'unknown';
}

/**
 * Multi-signal bot classification. Flags — never used to drop rows silently.
 * @returns { class: 'human'|'suspected'|'bot', score, reasons[] }
 */
export function botScore({ ua = '', asOrg = '', interactions = 0, pageViews = 1, sessionSeconds = 0, headless = false } = {}) {
  const reasons = [];
  let score = 0;
  const u = ua.toLowerCase();

  if (/bot|crawl|spider|slurp|scrap|curl|wget|python-requests|headless|phantom|puppeteer|playwright|lighthouse|pingdom|gtmetrix|ahrefs|semrush|bytespider/i.test(u)) {
    score += 100; reasons.push('crawler_ua');
  }
  if (headless || /headless/i.test(u)) { score += 60; reasons.push('headless'); }

  const org = (asOrg || '').toLowerCase();
  if (/amazon|aws|google cloud|gcp|microsoft azure|azure|digitalocean|linode|ovh|hetzner|leaseweb|contabo|scaleway|oracle cloud|alibaba|tencent|datacenter|hosting/i.test(org)) {
    score += 40; reasons.push('datacenter_asn');
  }
  // Impossibly fast navigation: many pages in near-zero time
  if (pageViews >= 5 && sessionSeconds > 0 && (sessionSeconds / pageViews) < 1) {
    score += 40; reasons.push('impossibly_fast');
  }
  // Multi-page session with zero interaction signals
  if (pageViews >= 3 && interactions === 0) { score += 25; reasons.push('zero_interaction'); }

  let cls = 'human';
  if (score >= 100) cls = 'bot';
  else if (score >= 40) cls = 'suspected';
  return { class: cls, score, reasons };
}

/** Explicit content grouping (replaces the buggy AND/OR CASE in worker.js). */
export function contentGroup(path) {
  const p = canonicalPath(path);
  if (p === '/' || p === '/index.html' || p === '/about' || p === '/resume') return 'homepage_navigation';

  const SACRED = ['/bhagavad-gita', '/vishnu-sahasranama', '/lalitha-sahasranama', '/hanumanchalisa', '/rudramchamakam', '/soundarya-lahari', '/narayaneeyam', '/bhaja-govindam', '/durga-suktam', '/sri-suktam', '/purusha-suktam', '/medha-suktam', '/aditya-hridayam', '/bajrang-baan', '/sandhyavandanam', '/navagraha', '/abhirami-andhadhi', '/subramanya-bhujangam', '/rama-raksha-stotram', '/apaduddharakastotram', '/shashtikavacham', '/mahanyasam', '/amavasya-tharpanam'];
  if (SACRED.some(s => p.startsWith(s))) return 'spirituality_sacred_texts';

  if (p.startsWith('/interview') || p.startsWith('/interview.app')) return 'interview_prep';

  if (p.startsWith('/articles/') || p.endsWith('-paddyspeaks.html') || p.includes('/the-')) {
    if (/gita|shankara|govindam|vedant|ashtavakra|narayaneeyam|prana|breathing|dharma|frankl/i.test(p)) return 'spirituality_sacred_texts';
    if (/fear|greed|death|frenem|psycholog|mind|ego|anxiet/i.test(p)) return 'psychology';
    if (/career|workplace|resume|job|interview|salary|manager/i.test(p)) return 'career_workplace';
    if (/\bai\b|llm|token|prompt|model|agent|claude|gpt|skill/i.test(p)) return 'ai_technology';
    if (/data|lakehouse|snowflake|sql|pipeline|warehouse|connector/i.test(p)) return 'data_engineering';
    return 'other_articles';
  }
  return 'other_articles';
}

export const _internal = { PS_DOMAINS, AI_ASSISTANTS, SEARCH_ENGINES, SOCIAL };
