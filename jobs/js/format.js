/**
 * JobSignal — display formatting.
 *
 * This module FORMATS and decides nothing. Status, confidence level, freshness
 * band, age and repost count are all computed by the Python pipeline and
 * shipped as fields; here they only become words on a screen.
 *
 * That split is deliberate. CLAUDE.md records what happened when form
 * validation was implemented twice — once in the Worker, once in the browser —
 * and had to be kept in step by hand. JobSignal has one implementation of every
 * judgement, and it is the one with tests around it.
 */
(function (global) {
  'use strict';

  var STATUS_TEXT = {
    live: 'Verified live',
    recent: 'Recently verified',
    unverified: 'Unverified',
    closed: 'Closed',
  };

  function statusText(status) { return STATUS_TEXT[status] || 'Unknown'; }

  /** "21 minutes ago" — always relative to last_verified_at, never to a crawl. */
  function since(iso) {
    if (!iso) return 'never';
    var then = Date.parse(iso);
    if (isNaN(then)) return 'unknown';
    var mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return 'moments ago';
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function day(iso) {
    if (!iso) return '';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }

  function dayShort(iso) {
    if (!iso) return '';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }

  function monthYear(iso) {
    if (!iso) return '';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  /** Age, stated plainly. An unknown age says so rather than showing zero. */
  function ageText(days) {
    if (days === null || days === undefined) return 'age not established';
    if (days === 0) return 'less than a day';
    return days === 1 ? '1 day' : days + ' days';
  }

  var CUR = { USD: '$', GBP: '£', EUR: '€', INR: '₹', CAD: 'C$', AUD: 'A$' };

  function money(n, currency) {
    if (n === null || n === undefined) return '';
    var sym = CUR[currency] || (currency ? currency + ' ' : '');
    return n >= 1000 ? sym + Math.round(n / 1000) + 'K' : sym + n;
  }

  /** Salary is shown only when the employer published one. Never estimated. */
  function salary(job) {
    if (!job.salary_min || !job.salary_max) return '';
    return money(job.salary_min, job.currency) + '–' + money(job.salary_max, job.currency);
  }

  var REMOTE = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Onsite', unknown: '' };
  function remote(v) { return REMOTE[v] || ''; }

  var LEVEL = {
    internship: 'Internship', entry: 'Entry level', mid: 'Mid level',
    senior: 'Senior', manager: 'Manager', director_plus: 'Director+', unknown: '',
  };
  function level(v) { return LEVEL[v] || ''; }

  var EMPLOYMENT = {
    full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract',
    internship: 'Internship', unknown: '',
  };
  function employment(v) { return EMPLOYMENT[v] || ''; }

  var ATS = {
    greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
    smartrecruiters: 'SmartRecruiters', workable: 'Workable', recruitee: 'Recruitee',
  };
  function ats(v) { return ATS[v] || v || 'the employer’s own system'; }

  /**
   * The repost line. Phrased as an observation with a date behind it —
   * never as a claim about why the employer did it.
   */
  function repostLine(job) {
    var n = job.repost_count || 0;
    if (!n) return '';
    var times = (n + 1) + ' times';
    var since_ = job.lineage_first_seen ? ' since ' + monthYear(job.lineage_first_seen) : '';
    return 'A posting for this role has appeared ' + times + since_ + '.';
  }

  function locationText(job) {
    var bits = [];
    if (job.location_city) bits.push(job.location_city);
    if (job.location_region) bits.push(job.location_region);
    if (!bits.length && job.location) bits.push(job.location);
    if (job.location_country && job.location_country !== 'US') bits.push(job.location_country);
    return bits.join(', ');
  }

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  global.JSFormat = {
    statusText: statusText, since: since, day: day, dayShort: dayShort,
    monthYear: monthYear, ageText: ageText, money: money, salary: salary,
    remote: remote, level: level, employment: employment, ats: ats,
    repostLine: repostLine, locationText: locationText, num: num,
  };
})(window);
