/**
 * Search providers.
 *
 * Discovery needs a way to ask "who on the internet mentions this phone
 * number", and there is no honest way to do that without a search backend. So
 * the provider is pluggable and the user brings their own key.
 *
 * Two things this module deliberately does *not* do:
 *
 *   - Scrape Google/Bing result pages. It violates their terms, it breaks
 *     constantly, and it gets the user's IP blocked mid-run. A tool that
 *     silently does this on a user's home connection is not doing them a
 *     favour.
 *   - Ship a hardcoded broker list as a "fallback". That is the shortcut spec
 *     item 4 rules out, and a fallback that quietly changes the product into
 *     something worse is the wrong kind of graceful degradation.
 *
 * If no provider is configured the agent says so plainly and offers the manual
 * provider, where the user pastes result URLs in. Everything downstream —
 * matching, removal, verification — works identically either way.
 */

import { registrableDomain } from '../core/text.js';

/** Providers in preference order, chosen by whichever key is present. */
export const PROVIDERS = {
  brave: {
    label: 'Brave Search API',
    envKey: 'BRAVE_SEARCH_API_KEY',
    docs: 'https://api-dashboard.search.brave.com/',
    note: 'Independent index, generous free tier, no result-page scraping.',
  },
  serper: {
    label: 'Serper.dev (Google results)',
    envKey: 'SERPER_API_KEY',
    docs: 'https://serper.dev/',
    note: 'Google coverage via a licensed API.',
  },
  serpapi: {
    label: 'SerpAPI',
    envKey: 'SERPAPI_KEY',
    docs: 'https://serpapi.com/',
    note: 'Multi-engine, including Bing and DuckDuckGo.',
  },
  bing: {
    label: 'Bing Web Search',
    envKey: 'BING_SEARCH_KEY',
    docs: 'https://www.microsoft.com/en-us/bing/apis/bing-web-search-api',
    note: 'Azure-hosted Bing index.',
  },
  manual: {
    label: 'Manual paste',
    envKey: null,
    docs: null,
    note: 'No API key. You run the searches and paste the URLs; the agent does everything else.',
  },
};

export function detectProvider(env = process.env) {
  for (const [name, p] of Object.entries(PROVIDERS)) {
    if (p.envKey && env[p.envKey]) return name;
  }
  return 'manual';
}

/**
 * A normalized result. Every provider maps into this shape so the crawler
 * never learns which backend it is talking to.
 */
function result(url, title, snippet, extra = {}) {
  return {
    url: String(url || ''),
    domain: registrableDomain(url || ''),
    title: String(title || ''),
    snippet: String(snippet || ''),
    ...extra,
  };
}

/**
 * Run one query. Returns [] rather than throwing on a provider error — one bad
 * query should not end a run that has fifty more to make. Errors surface via
 * the returned `error` field so the orchestrator can back off.
 */
export async function search(query, options = {}) {
  const provider = options.provider || detectProvider();
  const count = options.count ?? 20;
  const text = typeof query === 'string' ? query : query.text;

  try {
    switch (provider) {
      case 'brave': return await braveSearch(text, count, options);
      case 'serper': return await serperSearch(text, count, options);
      case 'serpapi': return await serpapiSearch(text, count, options);
      case 'bing': return await bingSearch(text, count, options);
      case 'manual': return { results: [], provider, manual: true };
      default: return { results: [], provider, error: `unknown provider: ${provider}` };
    }
  } catch (err) {
    return { results: [], provider, error: err.message };
  }
}

async function braveSearch(text, count, options) {
  const key = options.apiKey || process.env[PROVIDERS.brave.envKey];
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', text);
  url.searchParams.set('count', String(Math.min(count, 20)));
  // Brave applies its own safe-search; leaving it off avoids filtering out
  // legitimate records that happen to sit next to adult-flagged content.
  url.searchParams.set('safesearch', 'off');

  const res = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
  }, options);
  if (!res.ok) throw new Error(`Brave search returned ${res.status}`);
  const json = await res.json();

  return {
    provider: 'brave',
    results: (json?.web?.results || []).map((r) => result(r.url, r.title, r.description, {
      age: r.age || null,
    })),
  };
}

async function serperSearch(text, count, options) {
  const key = options.apiKey || process.env[PROVIDERS.serper.envKey];
  const res = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, num: Math.min(count, 100) }),
  }, options);
  if (!res.ok) throw new Error(`Serper returned ${res.status}`);
  const json = await res.json();

  return {
    provider: 'serper',
    results: (json?.organic || []).map((r) => result(r.link, r.title, r.snippet, {
      position: r.position,
    })),
  };
}

async function serpapiSearch(text, count, options) {
  const key = options.apiKey || process.env[PROVIDERS.serpapi.envKey];
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', text);
  url.searchParams.set('num', String(Math.min(count, 100)));
  url.searchParams.set('api_key', key);

  const res = await fetchWithTimeout(url, {}, options);
  if (!res.ok) throw new Error(`SerpAPI returned ${res.status}`);
  const json = await res.json();

  return {
    provider: 'serpapi',
    results: (json?.organic_results || []).map((r) => result(r.link, r.title, r.snippet)),
  };
}

async function bingSearch(text, count, options) {
  const key = options.apiKey || process.env[PROVIDERS.bing.envKey];
  const url = new URL('https://api.bing.microsoft.com/v7.0/search');
  url.searchParams.set('q', text);
  url.searchParams.set('count', String(Math.min(count, 50)));

  const res = await fetchWithTimeout(url, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
  }, options);
  if (!res.ok) throw new Error(`Bing returned ${res.status}`);
  const json = await res.json();

  return {
    provider: 'bing',
    results: (json?.webPages?.value || []).map((r) => result(r.url, r.name, r.snippet)),
  };
}

async function fetchWithTimeout(url, init, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Politeness / rate limiting.
 *
 * The agent makes a lot of requests. Running them flat out gets the user rate-
 * limited at best and IP-blocked at worst, and it is rude to the sites being
 * searched. This is a simple token-bucket the crawler awaits between calls.
 */
export class RateLimiter {
  constructor({ perMinute = 30, minGapMs = 400 } = {}) {
    this.perMinute = perMinute;
    this.minGapMs = minGapMs;
    this.times = [];
    this.last = 0;
  }

  async take() {
    const now = Date.now();
    this.times = this.times.filter((t) => now - t < 60_000);

    if (this.times.length >= this.perMinute) {
      const waitFor = 60_000 - (now - this.times[0]) + 50;
      await sleep(waitFor);
      return this.take();
    }

    const gap = now - this.last;
    if (gap < this.minGapMs) await sleep(this.minGapMs - gap);

    this.last = Date.now();
    this.times.push(this.last);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The message shown when nothing is configured. Honest about the trade-off. */
export function providerGuidance() {
  const configured = detectProvider();
  if (configured !== 'manual') {
    return { provider: configured, ready: true, message: `Using ${PROVIDERS[configured].label}.` };
  }
  return {
    provider: 'manual',
    ready: false,
    message: [
      'No search API key found, so broad discovery is limited.',
      '',
      'The agent needs a search backend to find where your information is published.',
      'It will not scrape Google or Bing result pages directly — that breaks their terms',
      'and tends to get your home IP blocked partway through a run.',
      '',
      'Set one of these and re-run:',
      ...Object.entries(PROVIDERS)
        .filter(([, p]) => p.envKey)
        .map(([, p]) => `  ${p.envKey.padEnd(22)} ${p.label} — ${p.docs}`),
      '',
      'Or continue in manual mode: run the searches yourself and paste the URLs.',
      'Matching, removal, verification and follow-up all work exactly the same.',
    ].join('\n'),
  };
}
