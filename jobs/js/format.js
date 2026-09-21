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

  function placeText(city, region, country) {
    var bits = [];
    if (city) bits.push(city);
    if (region) bits.push(region);
    if (country && country !== 'US') bits.push(country);
    return bits.join(', ');
  }

  /** Every place the role is open in, primary first. */
  function locationList(job) {
    var out = [placeText(job.location_city, job.location_region, job.location_country)];
    if (!out[0] && job.location) out[0] = job.location;
    var extra = job.locations_extra || [];
    for (var i = 0; i < extra.length; i++) {
      var t = placeText(extra[i][0], extra[i][1], extra[i][2]);
      if (t) out.push(t);
    }
    return out.filter(function (t) { return !!t; });
  }

  /** The primary place, and an honest count of the ones not shown.

      A role open in San Francisco AND New York used to render as just "San
      Francisco" — true but misleading, and it made the New York opening
      invisible to the person it was for. The card has room for one place, so
      it names the rest rather than dropping them. */
  function locationText(job) {
    var all = locationList(job);
    if (!all.length) return '';
    if (all.length === 1) return all[0];
    var rest = all.length - 1;
    return all[0] + ' +' + rest + ' other location' + (rest === 1 ? '' : 's');
  }

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  /** Skill names as people write them, not as the extractor stores them. */
  var SKILL_CASE = {
    sql: 'SQL', etl: 'ETL', elt: 'ELT', aws: 'AWS', gcp: 'GCP', azure: 'Azure',
    'ci/cd': 'CI/CD', nlp: 'NLP', llm: 'LLM', 'c++': 'C++', 'c#': 'C#',
    'node.js': 'Node.js', graphql: 'GraphQL', 'a/b testing': 'A/B testing',
    'power bi': 'Power BI', dbt: 'dbt', 'rest api': 'REST API', mlops: 'MLOps',
    ios: 'iOS'
  };
  function skill(s) {
    var k = String(s || '').toLowerCase();
    if (SKILL_CASE[k]) return SKILL_CASE[k];
    return k.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  /** What the Apply button names. Prefers the employer over the ATS host. */
  function companyShort(job) {
    var n = String(job.company_name || '').trim();
    return n.length > 22 ? n.slice(0, 21) + '\u2026' : (n || job.apply_url_host || 'the employer');
  }

  /**
   * A role open an unusually long time, stated as an observation with its
   * date — never as an accusation. Only shown when we can evidence it.
   */
  function longRunningLine(job) {
    if (job.repost_count) return '';
    var d = job.age_days;
    if (d === null || d === undefined || d < 180) return '';
    var from = job.posted_at_original || job.first_seen_at;
    return 'Open since ' + monthYear(from) + ' \u2014 ' + Number(d).toLocaleString('en-US') +
           ' days. The employer has not republished it.';
  }

  global.JSFormat = {
    skill: skill, companyShort: companyShort, longRunningLine: longRunningLine,
    statusText: statusText, since: since, day: day, dayShort: dayShort,
    monthYear: monthYear, ageText: ageText, money: money, salary: salary,
    remote: remote, level: level, employment: employment, ats: ats,
    repostLine: repostLine, locationText: locationText,
    locationList: locationList, num: num,
  };
})(window);
