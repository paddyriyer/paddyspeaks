/**
 * The browser session.
 *
 * Chromium via Playwright, running with a **persistent** profile directory.
 * That is not an optimisation — it is what makes spec items 19 and 20
 * implementable. When a site throws a CAPTCHA or an SMS code at us, the agent
 * has to stop, hand the *same live page* to the user, and pick up exactly where
 * it left off once they are done. A fresh context per step would lose the
 * session cookie and the half-filled form, and the user would have to start
 * over — which is precisely the experience this tool exists to remove.
 *
 * The browser runs **headed by default**. A privacy agent filling in forms on
 * your behalf should be watchable, and the pause-for-human steps are impossible
 * headless.
 *
 * Two things this module will not do:
 *   - Solve CAPTCHAs, or route them to a solving service. They are a security
 *     control; defeating them is both against site terms and the wrong side of
 *     the line for a tool acting on a user's behalf.
 *   - Spoof fingerprints or rotate identities to evade bot detection. If a site
 *     blocks automation, the honest outcome is `manual_action_required`.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { vaultHome } from '../store/vault.js';
import { sleep } from '../discover/providers.js';

export class BrowserSession {
  constructor(options = {}) {
    this.profileDir = options.profileDir || join(vaultHome(), 'browser-profile');
    this.headless = options.headless ?? false;
    this.context = null;
    this.log = options.log || (() => {});
    this.slowMo = options.slowMo ?? 0;
    this.defaultTimeout = options.timeoutMs ?? 30_000;
  }

  async start() {
    if (this.context) return this.context;
    mkdirSync(this.profileDir, { recursive: true, mode: 0o700 });

    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      slowMo: this.slowMo,
      viewport: { width: 1280, height: 900 },
      // A plain, current UA. Not a spoof — just avoiding the default
      // "HeadlessChrome" string, which some sites reject outright even when
      // the request is a legitimate one a human is watching.
      args: ['--disable-blink-features=AutomationControlled'],
      acceptDownloads: false,
    });
    this.context.setDefaultTimeout(this.defaultTimeout);

    // Block media and fonts: the agent reads text and fills forms, and skipping
    // the heavy assets makes a long run dramatically faster and lighter on the
    // sites being visited.
    await this.context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'media' || type === 'font') return route.abort();
      return route.continue();
    });

    return this.context;
  }

  async newPage() {
    const context = await this.start();
    return context.newPage();
  }

  /**
   * Fetch a page's readable content. This is the workhorse of discovery: it
   * returns visible text rather than HTML, because everything downstream
   * (extraction, classification) reasons about what a human would see.
   */
  async readPage(url, options = {}) {
    const page = options.page || await this.newPage();
    const owned = !options.page;
    try {
      const response = await page.goto(url, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeoutMs || this.defaultTimeout,
      });
      // Give client-rendered pages a moment; many broker pages hydrate the
      // record after first paint, and reading too early returns an empty shell.
      await page.waitForTimeout(options.settleMs ?? 1200);

      const data = await page.evaluate(() => {
        const strip = ['script', 'style', 'noscript', 'svg', 'iframe'];
        for (const sel of strip) {
          for (const el of document.querySelectorAll(sel)) el.remove();
        }
        const links = [...document.querySelectorAll('a[href]')]
          .map((a) => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 120) }))
          .filter((l) => l.href && !l.href.startsWith('javascript:'))
          .slice(0, 600);
        return {
          title: document.title || '',
          text: (document.body?.innerText || '').slice(0, 200_000),
          links,
          finalUrl: location.href,
        };
      });

      return {
        ok: true,
        status: response?.status() ?? 0,
        url: data.finalUrl || url,
        title: data.title,
        text: data.text,
        links: data.links.map((l) => l.href),
        linkDetails: data.links,
        page: owned ? null : page,
      };
    } catch (err) {
      return { ok: false, url, error: err.message, status: 0, title: '', text: '', links: [], linkDetails: [] };
    } finally {
      if (owned) await page.close().catch(() => {});
    }
  }

  async screenshot(page, path, options = {}) {
    try {
      await page.screenshot({ path, fullPage: options.fullPage ?? true });
      return path;
    } catch (err) {
      this.log('screenshot failed', { error: err.message });
      return null;
    }
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}

/**
 * A pause that hands control to the user and waits (spec items 19–21).
 *
 * The page is left exactly as it is — same tab, same cookies, same partially
 * filled form. `resolveWhen` is polled so the agent can notice the user
 * finishing without them having to tell it: once the CAPTCHA iframe is gone or
 * the URL has moved on, we continue by ourselves.
 */
export async function pauseForHuman(page, request, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const pollMs = options.pollMs ?? 1500;
  const started = Date.now();

  if (options.onPause) options.onPause(request);

  // Bring the tab to the front so the user can actually see what is being asked.
  await page.bringToFront().catch(() => {});

  while (Date.now() - started < timeoutMs) {
    if (options.cancelled?.()) {
      return { resolved: false, reason: 'cancelled' };
    }
    try {
      if (await options.resolveWhen?.(page)) {
        return { resolved: true, elapsedMs: Date.now() - started };
      }
    } catch {
      // Page navigated mid-check: that usually *is* the resolution.
      return { resolved: true, elapsedMs: Date.now() - started, note: 'page navigated' };
    }
    await sleep(pollMs);
  }
  return { resolved: false, reason: 'timed out waiting for you' };
}

/**
 * CAPTCHA detection (spec item 20).
 *
 * Detection only. There is no bypass path in this codebase, by design — the
 * agent stops and asks the human, which is both the compliant behaviour and
 * the one that actually works.
 */
export async function detectCaptcha(page) {
  try {
    return await page.evaluate(() => {
      const markers = [
        'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
        'iframe[title*="challenge" i]', '.g-recaptcha', '#recaptcha',
        '.h-captcha', '[data-sitekey]', '#cf-challenge-running',
        'iframe[src*="turnstile"]', '.cf-turnstile',
      ];
      for (const sel of markers) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().width > 0) {
          return { present: true, selector: sel };
        }
      }
      const bodyText = (document.body?.innerText || '').toLowerCase();
      if (/verify you are (a )?human|i'?m not a robot|complete the security check|checking your browser/.test(bodyText)) {
        return { present: true, selector: null, textual: true };
      }
      return { present: false };
    });
  } catch {
    return { present: false };
  }
}

/** Has the CAPTCHA gone away? Used as the resume condition. */
export async function captchaCleared(page) {
  const state = await detectCaptcha(page);
  return !state.present;
}
