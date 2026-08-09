/**
 * Drive a removal workflow in the browser (spec items 13–22).
 *
 * The executor is the part that touches the outside world, so it is written to
 * be conservative in a very specific way: it stops rather than guesses.
 *
 *   - CAPTCHA         -> pause, hand the live page to the user, resume (20)
 *   - SMS / MFA       -> pause at exactly that step, same browser state (19)
 *   - Government ID   -> never auto-fill, explain what is wanted, ask (21)
 *   - Payment         -> never pay, record it, look elsewhere (22)
 *   - Ambiguous record-> ask "is this you", never pick blindly (15)
 *
 * Everything else it does by itself, because interrupting for every routine
 * click is the failure mode that makes people abandon this kind of tool
 * (spec item 30).
 */

import { classifyField, planFill, sensitiveExplanation } from '../browser/fields.js';
import { detectCaptcha, captchaCleared, pauseForHuman } from '../browser/session.js';
import { scoreMatch, CLASSIFICATION } from '../core/match.js';
import { detectPaywall } from '../discover/extract.js';
import { WORKFLOW_TYPE } from './discover-method.js';
import { parseConfirmation, parseVerificationNeed } from './parse.js';
import { sleep } from '../discover/providers.js';

export const OUTCOME = {
  SUBMITTED: 'submitted',
  VERIFICATION_REQUIRED: 'verification_required',
  NEEDS_HUMAN: 'needs_human',
  PAYMENT_DEMANDED: 'payment_demanded',
  FAILED: 'failed',
  NO_FORM: 'no_form',
};

/**
 * Read every fillable control on the page, with enough context to classify it.
 *
 * Label resolution walks the four ways HTML associates a label with a control,
 * in the order of reliability, because broker forms use all of them and a
 * `for`-only implementation misses roughly half of them in practice.
 */
export async function readFormFields(page) {
  return page.evaluate(() => {
    function labelFor(el) {
      if (el.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (explicit) return explicit.innerText.trim();
      }
      const wrapping = el.closest('label');
      if (wrapping) return wrapping.innerText.trim();
      if (el.getAttribute('aria-labelledby')) {
        const ref = document.getElementById(el.getAttribute('aria-labelledby'));
        if (ref) return ref.innerText.trim();
      }
      // Last resort: the nearest preceding text node in the same container.
      const parent = el.parentElement;
      if (parent) {
        const text = [...parent.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.trim())
          .filter(Boolean)
          .join(' ');
        if (text) return text.slice(0, 120);
      }
      return '';
    }

    function selectorFor(el, index) {
      if (el.id) return `#${CSS.escape(el.id)}`;
      if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
      return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
    }

    const controls = [...document.querySelectorAll('input, select, textarea')];
    return controls
      .filter((el) => {
        const t = (el.type || '').toLowerCase();
        if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !el.disabled && !el.readOnly;
      })
      .map((el, i) => ({
        tag: el.tagName.toLowerCase(),
        type: (el.type || '').toLowerCase(),
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        autocomplete: el.getAttribute('autocomplete') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        label: labelFor(el),
        required: el.required || false,
        selector: selectorFor(el, i),
        options: el.tagName.toLowerCase() === 'select'
          ? [...el.options].map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
          : null,
      }));
  });
}

/** Find the button that submits this thing. */
async function findSubmitButton(page) {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll(
      'button, input[type="submit"], [role="button"], a.button, .btn',
    )];
    const scored = candidates
      .map((el, i) => {
        const text = (el.innerText || el.value || '').trim().toLowerCase();
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || el.disabled) return null;
        let score = 0;
        if (/\b(submit|send|continue|next|confirm|request removal|remove|opt out|delete|proceed)\b/.test(text)) score += 1;
        if (/\b(cancel|back|reset|clear|close|no thanks|decline)\b/.test(text)) score -= 2;
        if (el.type === 'submit') score += 0.5;
        if (score <= 0) return null;
        return {
          score,
          text: text.slice(0, 60),
          selector: el.id ? `#${CSS.escape(el.id)}` : null,
          index: i,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    return scored[0] || null;
  });
}

/**
 * Run one removal workflow end to end.
 *
 * @param session BrowserSession
 * @param method  the output of discoverRemovalMethod
 * @param context { profile, values, exposure, mode, approvals, hooks, vault }
 */
export async function executeRemoval(session, method, context = {}) {
  const hooks = context.hooks || {};
  const log = context.log || (() => {});
  const evidence = [];

  if (!method?.entryUrl || method.workflowType === WORKFLOW_TYPE.NONE) {
    return { outcome: OUTCOME.NO_FORM, evidence, note: method?.note || 'No removal mechanism.' };
  }

  // Email and postal routes are not browser workflows. They are handed back for
  // the caller to draft, because sending mail on someone's behalf is a
  // different consent conversation than clicking a form they can watch.
  if (method.workflowType === WORKFLOW_TYPE.EMAIL_REQUEST
    || method.workflowType === WORKFLOW_TYPE.POSTAL) {
    return {
      outcome: OUTCOME.NEEDS_HUMAN,
      evidence,
      needs: method.workflowType === WORKFLOW_TYPE.POSTAL ? 'postal_request' : 'email_request',
      contact: method.contact,
      note: method.workflowType === WORKFLOW_TYPE.POSTAL
        ? 'This site only accepts removal requests by post. We have drafted the letter; you will need to send it.'
        : 'This site takes removal requests by email. We have drafted it for you to review and send.',
    };
  }

  const page = await session.newPage();

  try {
    await page.goto(method.entryUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const before = await captureEvidence(session, page, context, 'before-removal');
    if (before) evidence.push(before);

    /* --- payment gate: check before doing any work (spec item 22) --- */

    const bodyText = await page.innerText('body').catch(() => '');
    const paywall = detectPaywall(bodyText);
    if (paywall) {
      log('site demands payment', { domain: method.domain, price: paywall.price });
      return {
        outcome: OUTCOME.PAYMENT_DEMANDED,
        evidence,
        paywall,
        note: `${method.domain} asks for payment (${paywall.price || 'amount unclear'}) to remove your record. We never pay for removals. Looking for a free route instead — often the same company runs a separate no-cost opt-out required by law.`,
      };
    }

    /* --- search-and-select workflows: find the right record first (15) --- */

    if (method.workflowType === WORKFLOW_TYPE.SEARCH_SELECT) {
      const selection = await searchAndSelectRecord(page, context, log);
      if (selection.outcome !== 'selected') {
        return { ...selection, evidence };
      }
      evidence.push(...(selection.evidence || []));
      await page.waitForTimeout(1000);
    }

    /* --- fill the form --- */

    const result = await fillAndSubmit(page, session, method, context, evidence, log);
    return result;
  } catch (err) {
    log('removal execution failed', { error: err.message });
    return { outcome: OUTCOME.FAILED, evidence, error: err.message };
  } finally {
    // The page is left open when a human still has to act on it.
    if (!context.keepPageOpen) await page.close().catch(() => {});
  }
}

/**
 * Search-and-select (spec item 15).
 *
 * The site shows a list of people matching the name; we have to pick ours. This
 * runs every candidate through the *same* match engine used for discovery, so
 * the decision uses one consistent notion of "is this me" — and if it is not
 * clearly ours, we ask rather than pick the first row.
 */
async function searchAndSelectRecord(page, context, log) {
  const evidence = [];
  const fields = await readFormFields(page);
  const searchField = fields
    .map((f) => ({ f, c: classifyField(f) }))
    .find((x) => x.c.kind === 'search_query' || x.c.kind === 'full_name' || x.c.kind === 'first_name');

  if (searchField) {
    const name = context.values?.name?.full || '';
    if (name) {
      await page.fill(searchField.f.selector, name).catch(() => {});
      const button = await findSubmitButton(page);
      if (button) await clickButton(page, button).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // Harvest candidate rows. Broker result lists are heterogeneous, so we look
  // for repeated blocks that carry a link and some personal-looking text.
  const candidates = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll(
      '[class*="result"], [class*="person"], [class*="record"], [class*="card"], li, tr',
    )];
    return blocks
      .map((el, i) => {
        const text = (el.innerText || '').trim();
        if (text.length < 20 || text.length > 1200) return null;
        const link = el.querySelector('a[href]');
        const button = el.querySelector('button, input[type="radio"], input[type="checkbox"]');
        if (!link && !button) return null;
        return {
          index: i,
          text: text.slice(0, 800),
          href: link ? link.href : null,
          hasControl: Boolean(button),
        };
      })
      .filter(Boolean)
      .slice(0, 40);
  });

  if (!candidates.length) {
    return { outcome: 'selected', note: 'No record list appeared — treating the page as a direct form.', evidence };
  }

  const { extractFromPage } = await import('../discover/extract.js');
  const scored = candidates.map((c) => {
    const { record } = extractFromPage({ url: page.url(), title: '', text: c.text });
    const match = scoreMatch(record, context.profile);
    return { ...c, match };
  }).sort((a, b) => b.match.score - a.match.score);

  const best = scored[0];
  const runnerUp = scored[1];

  // Ambiguous when the top two are close together, or the best is not clearly
  // ours. Picking the first row here is how a stranger's record gets deleted.
  const tooClose = runnerUp && (best.match.score - runnerUp.match.score) < 0.15;
  const notConfident = best.match.classification !== CLASSIFICATION.CONFIRMED;

  if (tooClose || notConfident) {
    log('record selection is ambiguous — asking', { count: scored.length });
    const answer = await context.hooks?.askWhichRecord?.({
      exposure: context.exposure,
      url: page.url(),
      candidates: scored.slice(0, 5).map((c) => ({
        text: c.text.slice(0, 300),
        score: c.match.score,
        why: c.match.explanation,
      })),
    });
    if (!answer || answer.choice == null || answer.choice === 'none') {
      return {
        outcome: OUTCOME.NEEDS_HUMAN,
        needs: 'record_selection',
        note: 'Several listings look similar and we could not tell which one is yours.',
        candidates: scored.slice(0, 5),
        evidence,
      };
    }
    scored.splice(0, 0, scored.splice(answer.choice, 1)[0]);
  }

  const chosen = scored[0];
  if (chosen.href) {
    await page.goto(chosen.href, { waitUntil: 'domcontentloaded' });
  } else {
    await page.evaluate((idx) => {
      const blocks = [...document.querySelectorAll(
        '[class*="result"], [class*="person"], [class*="record"], [class*="card"], li, tr',
      )];
      const el = blocks[idx];
      const control = el?.querySelector('button, input[type="radio"], input[type="checkbox"], a[href]');
      control?.click();
    }, chosen.index);
  }

  return { outcome: 'selected', chosen: { score: chosen.match.score, why: chosen.match.explanation }, evidence };
}

/**
 * Fill whatever form is on the page and submit it, pausing where a human is
 * genuinely required.
 */
async function fillAndSubmit(page, session, method, context, evidence, log) {
  const maxSteps = context.maxSteps ?? 5;

  for (let step = 0; step < maxSteps; step++) {
    /* --- CAPTCHA (spec item 20) --- */
    const captcha = await detectCaptcha(page);
    if (captcha.present) {
      log('captcha — pausing for you', { url: page.url() });
      const paused = await pauseForHuman(page, {
        kind: 'captcha',
        url: page.url(),
        domain: method.domain,
        message: `${method.domain} is showing a CAPTCHA. We will not try to work around it — please solve it in the browser window and we will carry straight on.`,
      }, {
        onPause: context.hooks?.onPause,
        resolveWhen: captchaCleared,
        cancelled: context.hooks?.cancelled,
      });
      if (!paused.resolved) {
        return { outcome: OUTCOME.NEEDS_HUMAN, needs: 'captcha', evidence, note: paused.reason };
      }
      await page.waitForTimeout(800);
    }

    const fields = await readFormFields(page);
    if (!fields.length) {
      // No inputs left usually means we already submitted and this is the
      // confirmation page.
      const confirmation = await detectConfirmation(page);
      if (confirmation.confirmed) {
        const after = await captureEvidence(session, page, context, 'confirmation');
        if (after) evidence.push(after);
        return {
          outcome: OUTCOME.SUBMITTED,
          evidence,
          confirmation,
          submittedAt: new Date().toISOString(),
        };
      }
      return { outcome: OUTCOME.NO_FORM, evidence, note: 'No form fields found on the removal page.' };
    }

    const classified = fields.map((f) => ({ ...f, classification: classifyField(f) }));
    const plan = planFill(classified, context.values, {
      approvedSensitiveKinds: context.approvals?.sensitiveKinds || [],
    });

    /* --- sensitive fields (spec item 21) --- */
    const needsApproval = plan.blocked.filter((b) => b.requiresApproval);
    if (needsApproval.length) {
      const payment = needsApproval.find((b) => b.classification.kind === 'payment_card');
      if (payment) {
        return {
          outcome: OUTCOME.PAYMENT_DEMANDED,
          evidence,
          note: `${method.domain} asks for payment card details as part of the removal. We never pay for removals.`,
        };
      }

      log('sensitive data requested — asking', {
        kinds: needsApproval.map((b) => b.classification.kind),
      });
      const answer = await context.hooks?.askSensitive?.({
        domain: method.domain,
        url: page.url(),
        exposure: context.exposure,
        requests: needsApproval.map((b) => ({
          kind: b.classification.kind,
          label: b.field.label || b.field.name,
          required: b.field.required,
          explanation: sensitiveExplanation(b.classification.kind),
          siteReason: extractNearbyReason(context, b),
        })),
      });

      if (!answer?.approved?.length) {
        return {
          outcome: OUTCOME.NEEDS_HUMAN,
          needs: 'sensitive_data',
          evidence,
          requests: needsApproval.map((b) => b.classification.kind),
          note: `${method.domain} wants ${needsApproval.map((b) => b.classification.kind.replace(/_/g, ' ')).join(', ')} before it will process the removal. Nothing has been submitted.`,
        };
      }
      context.approvals = context.approvals || {};
      context.approvals.sensitiveKinds = [
        ...(context.approvals.sensitiveKinds || []), ...answer.approved,
      ];
      continue; // re-plan with the approvals in hand
    }

    /* --- fill --- */
    let filled = 0;
    for (const item of plan.fills) {
      try {
        if (item.field.tag === 'select') {
          await page.selectOption(item.selector, String(item.value));
        } else if (item.field.type === 'checkbox' || item.field.type === 'radio') {
          await page.check(item.selector);
        } else {
          await page.fill(item.selector, String(item.value));
        }
        filled += 1;
      } catch (err) {
        log('could not fill a field', { selector: item.selector, error: err.message });
      }
    }

    // Tick the consent/confirmation boxes — these are assertions the user is
    // the data subject, which is exactly what they asked us to do.
    for (const f of classified) {
      if (f.classification.kind === 'consent' && f.type === 'checkbox') {
        await page.check(f.selector).catch(() => {});
      }
    }

    log('form filled', { filled, unfilled: plan.unfilled.length, step });

    /* --- submit --- */
    const button = await findSubmitButton(page);
    if (!button) {
      return { outcome: OUTCOME.NO_FORM, evidence, note: 'Form found but no submit control identified.' };
    }

    const urlBefore = page.url();
    await clickButton(page, button);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);

    /* --- what happened? --- */

    const confirmation = await detectConfirmation(page);
    if (confirmation.confirmed) {
      const after = await captureEvidence(session, page, context, 'confirmation');
      if (after) evidence.push(after);
      return {
        outcome: OUTCOME.SUBMITTED,
        evidence,
        confirmation,
        submittedAt: new Date().toISOString(),
      };
    }

    const verification = await detectVerificationNeed(page);
    if (verification.needed) {
      if (verification.channel === 'sms' || verification.channel === 'mfa') {
        // Spec item 19: stop at exactly this step, same browser state.
        log('SMS/MFA required — pausing', { url: page.url() });
        const paused = await pauseForHuman(page, {
          kind: verification.channel,
          url: page.url(),
          domain: method.domain,
          message: `${method.domain} wants a ${verification.channel === 'sms' ? 'code sent to your phone' : 'multi-factor confirmation'}. Enter it in the browser window that is open — the form is filled in and waiting. We will carry on from exactly here.`,
        }, {
          onPause: context.hooks?.onPause,
          resolveWhen: async (p) => p.url() !== urlBefore || (await detectConfirmation(p)).confirmed,
          cancelled: context.hooks?.cancelled,
        });
        if (!paused.resolved) {
          context.keepPageOpen = true;
          return { outcome: OUTCOME.NEEDS_HUMAN, needs: verification.channel, evidence, note: paused.reason };
        }
        continue;
      }

      // Email verification is handled by the mail connector, outside this loop.
      const after = await captureEvidence(session, page, context, 'verification-required');
      if (after) evidence.push(after);
      return {
        outcome: OUTCOME.VERIFICATION_REQUIRED,
        evidence,
        channel: verification.channel,
        url: page.url(),
        note: verification.note,
        submittedAt: new Date().toISOString(),
      };
    }

    const errors = await detectFormErrors(page);
    if (errors.length && page.url() === urlBefore) {
      log('form rejected the submission', { errors });
      if (step === maxSteps - 1) {
        return { outcome: OUTCOME.FAILED, evidence, errors, note: `The form reported: ${errors.join('; ')}` };
      }
      continue; // another pass may fill what it complained about
    }

    // Multi-page form: new fields appeared, keep going.
    const nextFields = await readFormFields(page);
    if (nextFields.length && page.url() !== urlBefore) continue;
    if (!nextFields.length) {
      const after = await captureEvidence(session, page, context, 'after-submit');
      if (after) evidence.push(after);
      return {
        outcome: OUTCOME.SUBMITTED,
        evidence,
        confirmation: { confirmed: false, weak: true, text: (await page.innerText('body').catch(() => '')).slice(0, 400) },
        submittedAt: new Date().toISOString(),
        note: 'Submitted, but the site gave no explicit confirmation. We will verify by re-checking the listing.',
      };
    }
  }

  return { outcome: OUTCOME.FAILED, evidence, note: `Gave up after ${maxSteps} form steps.` };
}

async function clickButton(page, button) {
  if (button.selector) return page.click(button.selector);
  return page.evaluate((idx) => {
    const els = [...document.querySelectorAll('button, input[type="submit"], [role="button"], a.button, .btn')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled;
      });
    els[idx]?.click();
  }, button.index);
}

/** Did the site say the request went through? Capture the case number if so. */
export async function detectConfirmation(page) {
  const text = await page.innerText('body').catch(() => '');
  return parseConfirmation(text);
}

/** Does the site want a verification step, and through which channel? */
export async function detectVerificationNeed(page) {
  const text = await page.innerText('body').catch(() => '');
  return parseVerificationNeed(text);
}

async function detectFormErrors(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll(
      '[class*="error" i], [class*="invalid" i], [role="alert"], .field-error, .help-block',
    )];
    return nodes
      .map((el) => (el.innerText || '').trim())
      .filter((t) => t.length > 3 && t.length < 300)
      .slice(0, 6);
  }).catch(() => []);
}

function extractNearbyReason(context, blocked) {
  return blocked.field.label || blocked.field.placeholder
    || 'The site does not explain why it needs this.';
}

/** Screenshot + metadata, encrypted into the vault's evidence store (spec 26). */
async function captureEvidence(session, page, context, label) {
  if (!context.vault || !context.exposure) return null;
  const bytes = await session.screenshotBuffer(page);
  if (!bytes) return null;
  const saved = context.vault.saveEvidence(bytes, context.exposure.id, label);
  if (!saved) return null;
  return {
    label,
    path: saved,
    encrypted: true,
    url: page.url(),
    capturedAt: new Date().toISOString(),
  };
}

export { sleep, parseConfirmation, parseVerificationNeed };
