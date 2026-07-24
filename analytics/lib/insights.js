/**
 * PaddySpeaks Analytics — deterministic insight engine ("What deserves attention?").
 * Pure, rule-based, no LLM. Each rule inspects a normalized aggregate and either
 * returns an evidence-based insight or null. Rules NEVER fire below the small-
 * sample floor, so we never fabricate a conclusion from noise (brief requirement).
 *
 * Insight shape:
 *   { id, observation, explanation (inference), metric, action,
 *     priority: 'high'|'medium'|'low', confidence: 'high'|'medium'|'low' }
 */
import { THRESHOLDS } from './config.js';

function pct(n) { return (n * 100).toFixed(0) + '%'; }
function signedPct(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
/** Confidence from the smallest denominator behind the claim + data completeness. */
function confidenceFor(n, completeness = 1, floor = THRESHOLDS.smallSampleFloor) {
  if (n < floor) return null;                 // below floor → rule must not fire
  if (n >= floor * 3 && completeness >= 0.6) return 'high';
  return 'medium';
}

/**
 * @param a normalized aggregate:
 *   {
 *     current: { sessions, engagedSessions, engagementRate, visitors, goals,
 *                conversionRate, medianActiveS, studioVisitors, studioStarts,
 *                studioCompletions },
 *     previous: { sessions, engagementRate, studioVisitors, studioCompletionRate },
 *     sources: [{ source, visitors, engagementRate }],
 *     content: [{ path, readers, engagementRate, class }],
 *     searchGaps: [{ query_len, count }] | count,
 *     byDevice: { mobile: {engagementRate, sessions}, desktop: {engagementRate, sessions} },
 *     dataQuality: { durationCoverage, scrollCoverage, botRate },
 *     studio: { visitors, completionRate, prevCompletionRate, abandonStep }
 *   }
 * @returns insight[] sorted by priority then confidence
 */
export function generateInsights(a, t = THRESHOLDS) {
  const out = [];
  const cur = a.current || {};
  const prev = a.previous || {};

  // 1) Overall traffic shift (real vs noise)
  const dSess = signedPct(cur.sessions, prev.sessions);
  if (dSess != null && Math.abs(dSess) >= 20) {
    const conf = confidenceFor(Math.min(cur.sessions, prev.sessions));
    if (conf) out.push({
      id: 'traffic_shift',
      observation: `Sessions ${dSess > 0 ? 'rose' : 'fell'} ${Math.abs(dSess)}% vs the previous period (${prev.sessions} → ${cur.sessions}).`,
      explanation: `Likely driven by a specific source or a published/promoted page — check Acquisition for the channel that moved (inference).`,
      metric: `sessions ${prev.sessions} → ${cur.sessions}`,
      action: dSess > 0 ? 'Identify the source that grew and double down on it.' : 'Find which channel dropped and whether it is seasonal or a regression.',
      priority: Math.abs(dSess) >= 40 ? 'high' : 'medium',
      confidence: conf,
    });
  }

  // 2) Engagement quality change
  const dEng = (cur.engagementRate != null && prev.engagementRate != null)
    ? Math.round((cur.engagementRate - prev.engagementRate) * 100) : null;
  if (dEng != null && Math.abs(dEng) >= 8) {
    const conf = confidenceFor(cur.sessions);
    if (conf) out.push({
      id: 'engagement_shift',
      observation: `Engagement rate ${dEng > 0 ? 'improved' : 'declined'} ${Math.abs(dEng)} points (${pct(prev.engagementRate)} → ${pct(cur.engagementRate)}).`,
      explanation: dEng > 0 ? 'More sessions are meeting the engaged threshold — content or targeting is landing better (inference).' : 'More visitors are leaving without engaging — check whether a new source is sending low-intent traffic (inference).',
      metric: `engagement ${pct(prev.engagementRate)} → ${pct(cur.engagementRate)} (n=${cur.sessions})`,
      action: dEng > 0 ? 'Note what changed and repeat it.' : 'Segment engagement by source to find the low-value channel.',
      priority: dEng < 0 ? 'high' : 'medium',
      confidence: conf,
    });
  }

  // 3) Interview Studio: traffic up but completion down (the brief's example)
  const s = a.studio || {};
  if (s.visitors != null && s.completionRate != null && s.prevCompletionRate != null) {
    const visUp = signedPct(s.visitors, prev.studioVisitors);
    const compDrop = Math.round((s.prevCompletionRate - s.completionRate) * 100);
    const conf = confidenceFor(s.visitors);
    if (conf && (visUp == null || visUp >= 0) && compDrop >= 8) {
      out.push({
        id: 'studio_completion_drop',
        observation: `Interview Studio ${visUp != null ? `visits ${visUp >= 0 ? 'up' : 'down'} ${Math.abs(visUp)}%, but ` : ''}exercise completion fell from ${pct(s.prevCompletionRate)} to ${pct(s.completionRate)}${s.abandonStep ? `, most abandonment ${s.abandonStep}` : ''}.`,
        explanation: 'New visitors may be hitting friction before their first answer attempt — often a mobile question-interface issue (inference).',
        metric: `completion ${pct(s.prevCompletionRate)} → ${pct(s.completionRate)} (n=${s.visitors})`,
        action: 'Review the first-answer step, especially on mobile.',
        priority: 'high',
        confidence: conf,
      });
    }
  }

  // 4) High-volume / low-value source
  (a.sources || []).forEach(src => {
    const conf = confidenceFor(src.visitors);
    if (conf && src.class === 'high_volume_low_value') {
      out.push({
        id: `source_low_value_${src.source}`,
        observation: `${src.source} sends high volume (${src.visitors} visitors) but below-median engagement (${pct(src.engagementRate)}).`,
        explanation: 'Volume without engagement suggests a mismatch between the promise of the link and the landing page (inference).',
        metric: `${src.source}: ${src.visitors} visitors @ ${pct(src.engagementRate)} engaged`,
        action: 'Tighten the message-to-landing-page match, or redirect this source to a better-fitting page.',
        priority: 'medium',
        confidence: conf,
      });
    }
  });

  // 5) Hidden-gem content to promote
  (a.content || []).forEach(c => {
    const conf = confidenceFor(c.readers);
    if (conf && c.class === 'hidden_gem') {
      out.push({
        id: `hidden_gem_${c.path}`,
        observation: `"${c.path}" has strong engagement (${pct(c.engagementRate)}) but low reach (${c.readers} readers).`,
        explanation: 'Content that engages the few who find it usually rewards promotion (inference).',
        metric: `${c.path}: ${c.readers} readers @ ${pct(c.engagementRate)} engaged`,
        action: 'Promote this page (LinkedIn post, internal links, homepage feature).',
        priority: 'medium',
        confidence: conf,
      });
    }
  });

  // 6) Search demand with no matching content
  const gapCount = typeof a.searchGaps === 'number' ? a.searchGaps : (a.searchGaps || []).reduce((n, g) => n + (g.count || 1), 0);
  if (gapCount >= 5) {
    out.push({
      id: 'search_gap',
      observation: `${gapCount} searches returned no results in the selected period.`,
      explanation: 'These are explicit requests for content you do not yet have (inference — demand signal).',
      metric: `${gapCount} zero-result searches`,
      action: 'Review the no-result terms and build the top requested topic next.',
      priority: 'medium',
      confidence: gapCount >= 15 ? 'high' : 'medium',
    });
  }

  // 7) Mobile friction
  const bd = a.byDevice || {};
  if (bd.mobile && bd.desktop && bd.mobile.sessions >= t.smallSampleFloor) {
    const gap = Math.round((bd.desktop.engagementRate - bd.mobile.engagementRate) * 100);
    if (gap >= 15) out.push({
      id: 'mobile_friction',
      observation: `Mobile engagement (${pct(bd.mobile.engagementRate)}) trails desktop (${pct(bd.desktop.engagementRate)}) by ${gap} points.`,
      explanation: 'A layout, tap-target, or performance issue is likely dampening mobile engagement (inference).',
      metric: `mobile ${pct(bd.mobile.engagementRate)} vs desktop ${pct(bd.desktop.engagementRate)} (n=${bd.mobile.sessions})`,
      action: 'Audit the top mobile landing pages for layout/perf friction.',
      priority: 'medium',
      confidence: confidenceFor(bd.mobile.sessions),
    });
  }

  // 7b) Anomaly detection — is the latest day outside normal variation?
  const series = (a.dailySeries || []).map(d => d.sessions).filter(v => v != null);
  if (series.length >= 8) {
    const last = series[series.length - 1];
    const base = series.slice(0, -1);
    const mean = base.reduce((s, v) => s + v, 0) / base.length;
    const sd = Math.sqrt(base.reduce((s, v) => s + (v - mean) * (v - mean), 0) / base.length) || 0;
    const z = sd > 0 ? (last - mean) / sd : 0;
    if (Math.abs(z) >= 2 && mean >= 3) {
      out.push({
        id: 'anomaly_daily',
        observation: `The most recent day (${last} sessions) is ${z > 0 ? 'well above' : 'well below'} the ${base.length}-day norm (~${Math.round(mean)}).`,
        explanation: `A ${Math.abs(z).toFixed(1)}σ move is unlikely to be routine variation — a promotion, mention, or outage probably drove it (inference).`,
        metric: `latest ${last} vs mean ${Math.round(mean)} (z=${z.toFixed(1)})`,
        action: z > 0 ? 'Find the referral spike in Acquisition and capitalize while it lasts.' : 'Check for an outage, a broken link, or a lost referral.',
        priority: Math.abs(z) >= 3 ? 'high' : 'medium',
        confidence: base.length >= 14 ? 'high' : 'medium',
      });
    }
  }

  // 8) Data-quality warning (never a "growth" insight — a trust flag)
  const dq = a.dataQuality || {};
  if (dq.durationCoverage != null && dq.durationCoverage < 0.6) {
    out.push({
      id: 'dq_duration_coverage',
      observation: `Only ${pct(dq.durationCoverage)} of sessions recorded engagement time.`,
      explanation: 'Low coverage weakens time-based metrics — usually mobile tab-closes not firing the exit beacon (inference).',
      metric: `duration coverage ${pct(dq.durationCoverage)}`,
      action: 'Verify the pagehide beacon on mobile; treat median-time moves as provisional until coverage rises.',
      priority: 'low',
      confidence: 'high',
    });
  }

  const prio = { high: 0, medium: 1, low: 2 };
  const cf = { high: 0, medium: 1, low: 2 };
  return out
    .filter(i => i.confidence) // drop any rule that produced a null confidence
    .sort((x, y) => (prio[x.priority] - prio[y.priority]) || (cf[x.confidence] - cf[y.confidence]))
    .slice(0, 5); // 3–5 max
}

/** 2×2 content classifier used by the Content tab + insight rule 5. */
export function classifyContent(items) {
  if (!items || !items.length) return [];
  const reaches = items.map(i => i.readers).sort((a, b) => a - b);
  const engs = items.map(i => i.engagementRate).sort((a, b) => a - b);
  const medReach = reaches[Math.floor(reaches.length / 2)];
  const medEng = engs[Math.floor(engs.length / 2)];
  return items.map(i => {
    const hiReach = i.readers >= medReach, hiEng = i.engagementRate >= medEng;
    let cls = 'needs_attention';
    if (hiReach && hiEng) cls = 'winner';
    else if (!hiReach && hiEng) cls = 'hidden_gem';
    else if (hiReach && !hiEng) cls = 'click_magnet';
    return { ...i, class: cls };
  });
}

/** Source value classifier used by the Acquisition tab + insight rule 4. */
export function classifySources(items, floor = THRESHOLDS.smallSampleFloor) {
  if (!items || !items.length) return [];
  const vis = items.map(i => i.visitors).sort((a, b) => a - b);
  const engs = items.map(i => i.engagementRate).sort((a, b) => a - b);
  const p75Vis = vis[Math.floor(vis.length * 0.75)];
  const medVis = vis[Math.floor(vis.length / 2)];
  const medEng = engs[Math.floor(engs.length / 2)];
  const p75Eng = engs[Math.floor(engs.length * 0.75)];
  return items.map(i => {
    let cls = 'normal';
    if (i.visitors >= p75Vis && i.engagementRate <= medEng) cls = 'high_volume_low_value';
    else if (i.visitors <= medVis && i.engagementRate >= p75Eng && i.visitors >= floor) cls = 'low_volume_high_value';
    return { ...i, class: cls };
  });
}
