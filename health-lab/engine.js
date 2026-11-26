/* Health Intelligence Lab — the LOCAL engine (Mode 2: My Private Health Lab).
 *
 * Runs in a Web Worker on the person's device. It reads an Apple Health export
 * (ZIP or XML, streamed), device CSVs and FHIR R4 bundles, and computes the same
 * judgements as the Python pipeline (healthlab/), using the SAME tables, shipped
 * in data/meta.json (import_spec). health-lab/tests/engine.mjs runs this file on
 * the published sample files and compares every count, window, coverage status,
 * medication status and signal with the Python results (tests/parity.json). If you
 * change a rule in Python, this file must change too, or that test fails.
 *
 * No network: this file makes no requests of any kind, and the page's
 * Content-Security-Policy would block one anyway (tests check both).
 * UMD: works as a worker script, a classic script and a Node module.
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ utils
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function dateFromIso(s) { return new Date(s.slice(0, 10) + 'T00:00:00Z'); }
  function addDays(s, n) { var d = dateFromIso(s); d.setUTCDate(d.getUTCDate() + n); return isoDate(d); }
  function diffDays(a, b) { return Math.round((dateFromIso(a) - dateFromIso(b)) / 86400000); }
  function median(v) { var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length; if (!n) return null; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function pct(v, q) {
    var s = v.slice().sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var k = (s.length - 1) * q / 100, f = Math.floor(k), c = Math.ceil(k);
    return f === c ? s[f] : s[f] + (s[c] - s[f]) * (k - f);
  }
  function mean(v) { var t = 0; for (var i = 0; i < v.length; i++) t += v[i]; return t / v.length; }
  function rnd(x, n) { if (x == null) return null; var p = Math.pow(10, n || 0); return Math.round(x * p) / p; }
  function unesc(s) { return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
  function attrs(tag) {
    var out = {}, re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g, m;
    while ((m = re.exec(tag))) out[m[1]] = unesc(m[2]);
    return out;
  }
  // "2026-11-10 06:40:00 -0800" -> {iso, local_date, utcMs, tz}
  function parseApple(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s || '');
    if (!m) return null;
    var sign = m[7] === '-' ? -1 : 1, offMin = sign * (+m[8] * 60 + +m[9]);
    var utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offMin * 60000;
    return { iso: m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + m[7] + m[8] + ':' + m[9],
      local_date: m[1] + '-' + m[2] + '-' + m[3], utcMs: utc, tz: m[7] + m[8] + ':' + m[9] };
  }
  // "2026-11-14T07:10:00-05:00"
  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/.exec(s || '');
    if (!m) return null;
    return parseApple(m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6] + ' ' + m[7] + m[8] + m[9]);
  }

  // ------------------------------------------------------------------ session
  function Session(spec, opts) {
    this.spec = spec; this.opts = opts || {};
    this.obs = new Map(); this.workouts = new Map(); this.notifications = []; this.clinical = []; this.entries = [];
    this.counts = new Map();
    this.lin = {}; var self = this;
    spec.linear.forEach(function (r) { self.lin[r[0] + '|' + r[1]] = [r[2], r[3]]; });
    this.same = {}; spec.same_unit.forEach(function (r) { self.same[r[0] + '|' + r[1]] = 1; });
  }
  Session.prototype.count = function (file, outcome, reason) {
    var k = file + '\u0000' + outcome + '\u0000' + (reason || '');
    this.counts.set(k, (this.counts.get(k) || 0) + 1);
  };
  Session.prototype.add = function (code, value, unit, when, o) {
    var m = this.spec.metrics[code], conv = this.lin[unit + '|' + m.unit];
    if (!conv) { this.count(o.file, 'rejected', 'unknown unit ' + JSON.stringify(unit) + ' for ' + code); return; }
    var num = parseFloat(value);
    if (value == null || isNaN(num) || !/^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(String(value))) { this.count(o.file, 'rejected', 'unreadable value for ' + code); return; }
    var v = num * conv[0] + conv[1];
    if (!(m.range[0] <= v && v <= m.range[1])) { this.count(o.file, 'rejected', 'implausible ' + m.label.toLowerCase() + ' ' + value + ' ' + unit); return; }
    var key = [o.system, o.rawKey || code, when.iso, value].join('|');
    if (this.obs.has(key)) { this.count(o.file, 'duplicate', 'same record imported again'); return; }
    var flags = (o.flags || []).slice();
    if (unit !== m.unit && !this.same[unit + '|' + m.unit]) flags.push('converted ' + unit + '→' + m.unit);
    this.obs.set(key, { code: code, value: v, unit: m.unit, orig_value: value, orig_unit: unit, start: when.iso,
      local_date: when.local_date, tz: o.dateOnly ? 'date-only' : when.tz, utcMs: when.utcMs,
      source: { system: o.system, name: o.name, device: o.device || null, file: o.file },
      kind: o.kind || m.kind, method: o.method || null, flags: flags });
    this.count(o.file, 'kept');
  };

  // ---- Apple Health export.xml, as a stream of text chunks
  Session.prototype.appleTokenizer = function (file) {
    var self = this, buf = '', sp = this.spec, sleepType = 'HKCategoryTypeIdentifierSleepAnalysis';
    function record(tag) {
      var a = attrs(tag), t = a.type, s = parseApple(a.startDate), e = parseApple(a.endDate);
      if (!s || !e) { self.count(file, 'rejected', 'malformed record (unreadable date)'); return; }
      if (t === sleepType) {
        if ((a.value || '').indexOf('Asleep') < 0) { self.count(file, 'skipped', 'in-bed, not asleep'); return; }
        var hours = (e.utcMs - s.utcMs) / 3600000, key = 'apple_health_export|sleep|' + e.iso + '|' + rnd(hours, 4);
        if (self.obs.has(key)) { self.count(file, 'duplicate', 'same record imported again'); return; }
        var r = sp.metrics.sleep_hours.range;
        if (!(r[0] <= hours && hours <= r[1])) { self.count(file, 'rejected', 'implausible sleep'); return; }
        self.obs.set(key, { code: 'sleep_hours', value: rnd(hours, 4), unit: 'h', orig_value: a.startDate + ' → ' + a.endDate, orig_unit: 'interval',
          start: e.iso, local_date: e.local_date, tz: e.tz, utcMs: e.utcMs,
          source: { system: 'apple_health_export', name: a.sourceName, device: a.device || null, file: file },
          kind: 'estimated', method: 'asleep interval (stages estimated)', flags: [] });
        self.count(file, 'kept'); return;
      }
      if (sp.apple_events[t]) {
        if (self.notifications.some(function (n) { return n.type_id === t && n.raw_start === a.startDate; })) { self.count(file, 'duplicate', 'same record imported again'); return; }
        self.notifications.push({ type_id: t, label: sp.apple_events[t], raw_start: a.startDate, start: s.iso, end: e.iso, local_date: e.local_date, source: a.sourceName, kind: 'device_notification' });
        self.count(file, 'kept'); return;
      }
      var code = sp.apple_types[t];
      if (!code) { self.count(file, 'skipped', 'type not used: ' + t); return; }
      self.add(code, a.value, a.unit, s, { system: 'apple_health_export', name: a.sourceName, device: a.device, file: file, method: code === 'hrv_sdnn' ? 'SDNN' : null, rawKey: t });
    }
    function workout(block) {
      var head = block.slice(0, block.indexOf('>') + 1), a = attrs(head), s = parseApple(a.startDate);
      if (!s) { self.count(file, 'rejected', 'malformed workout'); return; }
      var key = s.iso + '|' + a.duration;
      if (self.workouts.has(key)) { self.count(file, 'duplicate', 'same workout imported again'); return; }
      var w = { type: (a.workoutActivityType || '').replace('HKWorkoutActivityType', ''), start: s.iso, local_date: s.local_date, duration_min: parseFloat(a.duration) };
      var re = /<(MetadataEntry|WorkoutStatistics)\b[^>]*>/g, m;
      while ((m = re.exec(block))) {
        var c = attrs(m[0]);
        if (m[1] === 'MetadataEntry' && c.key === 'HKElevationAscended') w.elevation_m = parseFloat(c.value) / 100;
        if (m[1] === 'WorkoutStatistics' && /Distance/.test(c.type || '')) w.distance_km = parseFloat(c.sum);
        if (m[1] === 'WorkoutStatistics' && c.type === 'HKQuantityTypeIdentifierHeartRate') w.avg_hr = parseFloat(c.average);
      }
      self.workouts.set(key, w); self.count(file, 'kept');
    }
    return {
      push: function (chunk) {
        buf += chunk;
        var i = 0;
        for (;;) {
          var r = buf.indexOf('<Record', i), w = buf.indexOf('<Workout', i);
          var at = r < 0 ? w : (w < 0 ? r : Math.min(r, w));
          if (at < 0) { i = Math.max(i, buf.length - 16); break; }
          if (at === w) {
            var close = buf.indexOf('</Workout>', at), selfEnd = buf.indexOf('/>', at), gt = buf.indexOf('>', at);
            if (gt < 0) { i = at; break; }
            if (buf[gt - 1] === '/' ) { workout(buf.slice(at, gt + 1)); i = gt + 1; continue; }
            if (close < 0) { i = at; break; }
            workout(buf.slice(at, close + 10)); i = close + 10; continue;
          }
          var end = buf.indexOf('>', at);
          if (end < 0) { i = at; break; }
          if (buf[end - 1] === '/') { record(buf.slice(at, end + 1)); i = end + 1; continue; }
          var rc = buf.indexOf('</Record>', end);
          if (rc < 0) { i = at; break; }
          record(buf.slice(at, end + 1)); i = rc + 9;
        }
        buf = buf.slice(i);
      },
      end: function () { buf = ''; }
    };
  };

  function rows(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l && l[0] !== '#'; });
    if (!lines.length) return [];
    var head = lines[0].split(',');
    return lines.slice(1).map(function (l) { var c = l.split(','), o = {}; head.forEach(function (h, i) { o[h] = c[i]; }); return o; });
  }
  Session.prototype.csv = function (text, file) {
    var self = this, rs = rows(text);
    if (!rs.length) return 'empty';
    var cols = Object.keys(rs[0]);
    if (cols.indexOf('systolic_mmHg') >= 0) {
      rs.forEach(function (r) { var w = parseIso(r.measured_at); if (!w) { self.count(file, 'rejected', 'unreadable time'); return; }
        [['systolic', 'systolic_mmHg', 'mmHg'], ['diastolic', 'diastolic_mmHg', 'mmHg'], ['pulse_cuff', 'pulse_bpm', 'count/min']].forEach(function (x) {
          self.add(x[0], r[x[1]], x[2], w, { system: 'bp_cuff_csv', name: 'Blood-pressure cuff', device: r.device, file: file, rawKey: x[0] }); }); });
      return 'cuff';
    }
    if (cols.indexOf('weight') >= 0) {
      rs.forEach(function (r) { var w = parseIso(r.measured_at); if (!w) { self.count(file, 'rejected', 'unreadable time'); return; }
        self.add('weight', r.weight, r.unit, w, { system: 'scale_csv', name: 'Connected scale', device: 'Scale', file: file }); });
      return 'scale';
    }
    if (cols.indexOf('glucose_mg_dl') >= 0) {
      rs.forEach(function (r) { var w = parseIso(r.timestamp); if (!w) { self.count(file, 'rejected', 'unreadable time'); return; }
        self.add('glucose_cgm', r.glucose_mg_dl, 'mg/dL', w, { system: 'cgm_csv', name: 'Continuous glucose monitor', device: 'CGM sensor', file: file }); });
      return 'cgm';
    }
    return 'unknown';
  };
  Session.prototype.fhir = function (text, file) {
    var self = this, b = JSON.parse(text);
    (b.entry || []).forEach(function (e) {
      var r = e.resource, rt = r.resourceType;
      if (rt === 'Observation') {
        var coding = r.code.coding[0], m = self.spec.loinc_map[coding.code];
        if (!m) { self.count(file, 'skipped', 'unmapped code ' + coding.code); return; }
        var d = r.effectiveDateTime, dateOnly = d.length === 10;
        var when = dateOnly ? { iso: d + 'T08:00:00+00:00', local_date: d, utcMs: Date.parse(d + 'T08:00:00Z'), tz: '+00:00' } : parseIso(d);
        self.add(m[0], r.valueQuantity.value, r.valueQuantity.code, when, { system: 'fhir_r4', name: (r.performer || [{}])[0].display || 'Lab',
          file: file, kind: 'clinician_verified', flags: ['date-only result; time not reported'], rawKey: coding.code, dateOnly: dateOnly });
      } else if (rt === 'Condition') {
        self.clinical.push({ type: 'condition', text: r.code.text, clinical_status: r.clinicalStatus.coding[0].code, verification: r.verificationStatus.coding[0].code, onset: r.onsetDateTime }); self.count(file, 'kept');
      } else if (rt === 'MedicationStatement') {
        self.clinical.push({ type: 'medication', text: r.medicationCodeableConcept.text, record_status: r.status, start: (r.effectivePeriod || {}).start, asserted: r.dateAsserted }); self.count(file, 'kept');
      } else if (rt === 'MedicationRequest') {
        var vp = (r.dispenseRequest || {}).validityPeriod || {};
        self.clinical.push({ type: 'prescription', text: r.medicationCodeableConcept.text, record_status: r.status, authored: r.authoredOn, valid_until: vp.end, by: (r.requester || {}).display }); self.count(file, 'kept');
      } else if (rt === 'MedicationDispense') {
        self.clinical.push({ type: 'dispense', text: r.medicationCodeableConcept.text, record_status: r.status, when: r.whenHandedOver, days_supply: (r.daysSupply || {}).value }); self.count(file, 'kept');
      } else if (rt === 'Goal' || rt === 'CarePlan') {
        self.clinical.push({ type: rt === 'Goal' ? 'clinical_goal' : 'care_plan', text: rt === 'Goal' ? r.description.text : r.title }); self.count(file, 'kept');
      } else self.count(file, 'skipped', 'resource type ' + rt);
    });
  };

  // ------------------------------------------------------------------ analysis (mirrors healthlab/analyze.py)
  // What was found, before any analysis: per measure, count and date range.
  Session.prototype.preview = function () {
    var by = {}, sp = this.spec;
    this.obs.forEach(function (o) {
      var b = by[o.code] = by[o.code] || { code: o.code, label: sp.metrics[o.code].label, kind: o.kind, n: 0, first: o.local_date, last: o.local_date, sources: {} };
      b.n++; if (o.local_date < b.first) b.first = o.local_date; if (o.local_date > b.last) b.last = o.local_date; b.sources[o.source.name] = 1;
    });
    var list = Object.keys(by).map(function (k) { var b = by[k]; b.sources = Object.keys(b.sources); return b; });
    var last = list.reduce(function (m, b) { return b.last > m ? b.last : m; }, '');
    return { measures: list, latest: last || null, workouts: this.workouts.size, notifications: this.notifications.length,
      clinical: this.clinical.filter(function (c) { return c.type !== 'dispense'; }).length };
  };

  Session.prototype.analyze = function (asOf, opts) {
    opts = opts || {};
    var sp = this.spec, cfg = sp.cfg, obs = Array.from(this.obs.values()), DAYS = 730, START = addDays(asOf, -(DAYS - 1));
    if (opts.codes) obs = obs.filter(function (o) { return opts.codes.indexOf(o.code) >= 0; });
    if (opts.from) obs = obs.filter(function (o) { return o.local_date >= opts.from; });
    var d2i = function (d) { return diffDays(d, START); }, i2d = function (i) { return addDays(START, i); };
    // reconcile: time zones (home offsets = >= 10% of records)
    var tzc = {}, tot = 0;
    obs.forEach(function (o) { if (o.tz !== 'date-only') { tzc[o.tz] = (tzc[o.tz] || 0) + 1; tot++; } });
    var home = {}; Object.keys(tzc).forEach(function (z) { if (tzc[z] / (tot || 1) >= 0.1) home[z] = 1; });
    var away = {}; obs.forEach(function (o) { if (o.tz !== 'date-only' && !home[o.tz]) { away[o.local_date] = 1; o.flags.push('recorded in UTC' + o.tz + ' (away from home)'); } });
    // daily series
    var by = {};
    obs.forEach(function (o) {
      var c = cfg[o.code]; if (!c) return;
      if (c.prefer && o.source.system !== c.prefer) return;
      var i = d2i(o.local_date);
      if ((0 <= i && i < DAYS) || c.cadence === 'lab') { (by[o.code] = by[o.code] || {}); (by[o.code][i] = by[o.code][i] || []).push(o.value); }
    });
    var daily = {};
    Object.keys(by).forEach(function (code) {
      daily[code] = {};
      Object.keys(by[code]).forEach(function (i) { var v = by[code][i]; daily[code][i] = cfg[code].agg === 'sum' ? v.reduce(function (a, b) { return a + b; }, 0) : mean(v); });
    });
    function values(code, a, b) { var s = daily[code] || {}, out = []; Object.keys(s).forEach(function (i) { var d = i2d(+i); if (a <= d && d <= b) out.push(s[i]); }); return out; }
    function classify(code, prev, cur, span) {
      var c = cfg[code], dec = sp.dec[code];
      if (c.cadence === 'lab' || c.cadence === 'episode') return null;
      var need = c.cadence === 'daily' ? function (v) { return v.length >= Math.max(5, 0.5 * span); } : function (v) { return v.length >= c.min_n; };
      var res = { n_prev: prev.length, n_cur: cur.length, prev: prev.length ? rnd(median(prev), dec) : null, cur: cur.length ? rnd(median(cur), dec) : null,
        cov_prev: c.cadence === 'daily' ? rnd(prev.length / span, 2) : null, cov_cur: c.cadence === 'daily' ? rnd(cur.length / span, 2) : null };
      if (!need(prev) || !need(cur)) { res.status = 'insufficient'; res.reason = 'Not enough data in one of the periods.'; return res; }
      var mp = median(prev), mc = median(cur), delta = mc - mp, thr = c.thr * (c.rel ? Math.abs(mp) : 1), status;
      res.delta = rnd(delta, dec);
      if (c.better === 'goal-lower') { res.status = Math.abs(delta) < thr ? 'stable' : 'changed'; res.reason = 'Weight direction counts only when weight is a goal.'; return res; }
      if (c.better === 'range') {
        var dist = function (x) { return Math.max(c.rng[0] - x, 0, x - c.rng[1]); }, imp = dist(mp) - dist(mc);
        status = imp >= thr ? 'improving' : (imp <= -thr ? 'declining' : 'stable');
      } else {
        var sign = c.better === 'higher' ? 1 : -1;
        status = Math.abs(delta) < thr ? 'stable' : (sign * delta > 0 ? 'improving' : 'declining');
      }
      res.status = status; res.reason = 'Median moved ' + rnd(delta, dec) + ' (' + c.basis + ').';
      return res;
    }
    function window(code, w) { return classify(code, values(code, addDays(asOf, -(2 * w - 1)), addDays(asOf, -w)), values(code, addDays(asOf, -(w - 1)), asOf), w); }
    var windows = {};
    [30, 90, 180, 365].forEach(function (w) {
      windows[w] = {};
      sp.order.forEach(function (c) { if (daily[c] && (cfg[c].cadence === 'daily' || cfg[c].cadence === 'sparse')) windows[w][c] = window(c, w); });
    });
    // medications
    var meds = reconcileMeds(this.clinical, this.entries, asOf);
    // signals
    var sigs = [], self = this;
    Object.keys(sp.bad).forEach(function (code) {
      var s = daily[code]; if (!s) return;
      var c = cfg[code], sparse = c.cadence === 'sparse', rw = sparse ? 14 : 7, rmin = sparse ? 5 : 4, bmin = sparse ? 20 : 45, bad = sp.bad[code];
      var flagged = [], cache = {};
      for (var i = 120; i < DAYS; i++) {
        var base = [], recent = [], j;
        for (j = i - 90 - rw - 7; j < i - rw - 7; j++) if (s[j] != null) base.push(s[j]);
        for (j = i - rw + 1; j <= i; j++) if (s[j] != null) recent.push(s[j]);
        if (base.length < bmin || recent.length < rmin) continue;
        var p10 = pct(base, 10), p50 = pct(base, 50), p90 = pct(base, 90), m = median(recent), thr = c.thr * (c.rel ? Math.abs(p50) : 1);
        if ((bad === 'up' && m > p90 && m - p50 >= thr) || (bad === 'down' && m < p10 && p50 - m >= thr)) { flagged.push(i); cache[i] = [p10, p50, p90, m]; }
      }
      var eps = [], cur = [];
      flagged.forEach(function (i) { if (cur.length && i !== cur[cur.length - 1] + 1) { eps.push(cur); cur = []; } cur.push(i); });
      if (cur.length) eps.push(cur);
      eps.forEach(function (e) {
        if (e.length < 7) return;
        var a = i2d(e[0] - rw + 1), b = i2d(e[e.length - 1]), ongoing = e[e.length - 1] === DAYS - 1, span = diffDays(b, a) + 1;
        var ctx = false; for (var k = e[0] - rw + 1; k <= e[e.length - 1]; k++) if (away[i2d(k)]) ctx = true;
        var tier = ctx ? 'context' : ((ongoing && span >= 14) || (span >= 21 && ['systolic', 'walking_speed', 'resting_hr'].indexOf(code) >= 0) ? 'discuss' : 'observed');
        var cc = cache[e[0]];
        sigs.push({ metric: code, label: sp.metrics[code].label, kind: 'baseline_change', tier: tier, start: a, end: b, ongoing: ongoing, days: span,
          baseline: { p10: rnd(cc[0], sp.dec[code]), median: rnd(cc[1], sp.dec[code]), p90: rnd(cc[2], sp.dec[code]) },
          why: sp.metrics[code].label + ': outside your usual range for ' + span + ' days' + (ctx ? ', partly recorded in another time zone.' : '.'),
          limits: sp.limits[code], next: tier === 'discuss' ? (sp.next.discuss[code] || sp.next.discuss._) : sp.next[tier] });
      });
    });
    ['walking_speed', 'resting_hr', 'systolic'].forEach(function (code) {
      if (!daily[code]) return;
      var w = window(code, 365);
      if (w && w.status === 'declining') sigs.push({ metric: code, label: sp.metrics[code].label, kind: 'persistent_trend', tier: 'discuss', gradual: true,
        start: addDays(asOf, -729), end: asOf, why: sp.metrics[code].label + ': a gradual change over a year, median ' + w.prev + ' → ' + w.cur + '.',
        limits: sp.limits[code], next: sp.next.discuss[code] || sp.next.discuss._ });
    });
    meds.forEach(function (m) { if (m.status === 'needs review') sigs.push({ metric: 'record', label: 'Medication: ' + m.name, kind: 'record_conflict', tier: 'context', start: asOf, end: asOf, why: m.reasons.join(' '), evidence: m.sources.map(function (s) { return s.text; }), limits: 'The app cannot know which source is current. It changes no record.', next: 'Bring the list to your clinician or pharmacist. Do not start, stop or change a medicine because of an app.' }); });
    this.notifications.forEach(function (n) { sigs.push({ metric: 'notification', label: n.label, kind: 'device_notification', tier: 'discuss', start: n.local_date, end: n.local_date, why: n.label + ' recorded by the watch on ' + n.local_date + '.', limits: 'A notification is a prompt to talk to a clinician. It is not a diagnosis and its absence rules nothing out.', next: 'Mention it to your clinician. If you have chest pain, fainting, severe breathlessness or signs of stroke, call emergency services now.' }); });
    if (daily.steps) {
      var idx = Object.keys(daily.steps).map(Number).filter(function (i) { return i >= DAYS - 365; }).sort(function (a, b) { return a - b; });
      for (var q = 0; q + 1 < idx.length; q++) {
        var gap = idx[q + 1] - idx[q] - 1;
        if (gap >= 14) sigs.push({ metric: 'data', label: 'Gap in watch data', kind: 'data_issue', tier: 'observed', start: i2d(idx[q] + 1), end: i2d(idx[q + 1] - 1), days: gap, why: 'No watch data for ' + gap + ' days.', limits: 'A gap says nothing about health.', next: 'Nothing to do.' });
      }
    }
    var lip = obs.filter(function (o) { return o.code === 'ldl' || o.code === 'chol_total'; });
    if (lip.length && !lip.some(function (o) { return diffDays(asOf, o.local_date) <= 365; })) {
      var last = lip.map(function (o) { return o.local_date; }).sort().pop();
      sigs.push({ metric: 'data', label: 'Cardiovascular risk: not enough current data', kind: 'data_issue', tier: 'context', start: last, end: asOf,
        why: 'The latest cholesterol results are ' + Math.floor(diffDays(asOf, last) / 30) + ' months old. A current cardiovascular risk estimate would need current results and is a clinician\'s calculation.',
        limits: 'The lab does not compute cardiovascular risk scores.', next: 'Ask your clinician whether and when these tests should be repeated.' });
    }
    var order = { urgent: 0, discuss: 1, context: 2, observed: 3 };
    sigs.sort(function (a, b) { return order[a.tier] - order[b.tier] || (a.end < b.end ? -1 : a.end > b.end ? 1 : 0); });
    // coverage
    var cov = sp.coverage.map(function (row) {
      var id = row[0], label = row[1], codes = row[2], kind = row[3], needs = row[4];
      var os = obs.filter(function (o) { return codes.indexOf(o.code) >= 0; });
      if (!os.length) return { id: id, label: label, status: (kind === 'external' || kind === 'lab' || id === 'weight' || id === 'blood_pressure') ? 'requires external source' : 'not imported', evidence: 'No measurements imported.', needs: needs, conclusion: 'No measurement → no usable evidence → no conclusion. Missing data never means a condition is absent.' };
      var last = os.map(function (o) { return o.local_date; }).sort().pop(), age = diffDays(asOf, last), status, ev;
      if (kind === 'lab') { status = age <= 365 ? 'available' : 'stale'; ev = 'Latest ' + last + ' (' + Math.floor(age / 30) + ' months ago).'; }
      else if (kind === 'daily') {
        var d90 = {}; os.forEach(function (o) { if (diffDays(asOf, o.local_date) < 90) d90[o.local_date] = 1; });
        var cv = Object.keys(d90).length / 90; status = cv >= 0.6 ? 'available' : (Object.keys(d90).length ? 'partial' : 'stale'); ev = Math.round(cv * 100) + '% of the last 90 days have data; latest ' + last + '.';
      } else {
        var n90 = os.filter(function (o) { return diffDays(asOf, o.local_date) < 90; }).length;
        status = (n90 >= 8 || (kind === 'external' && age <= 365)) ? 'available' : (n90 ? 'partial' : 'stale'); ev = n90 + ' readings in the last 90 days; latest ' + last + '.';
      }
      return { id: id, label: label, status: status, evidence: ev, needs: needs, conclusion: status === 'available' ? null : 'Thin or old data: conclusions are limited to what the dates show.' };
    });
    cov.push({ id: 'medications', label: 'Medication status', status: meds.some(function (m) { return m.status === 'needs review'; }) ? 'requires reconciliation' : (meds.length ? 'available' : 'not imported'), evidence: meds.length ? meds.length + ' medicines from your records.' : 'No medication records imported.', needs: 'Medication lists, prescriptions or pharmacy records.' });
    cov.push({ id: 'rhythm', label: 'ECG / heart rhythm', status: this.notifications.length ? 'notification recorded' : 'unavailable', evidence: this.notifications.length ? this.notifications.length + ' device notification(s); no ECG recordings imported.' : 'No ECG recordings or rhythm notifications imported.', needs: 'ECG recordings or a clinical ECG.', conclusion: 'Absence of notifications rules nothing out.' });
    cov.push({ id: 'cohorts', label: 'Comparisons with other people', status: 'illustrative only', evidence: 'No validated reference population is loaded.', needs: 'A licensed, method-matched reference dataset.' });
    // chart series (last 730 days)
    var series = {};
    Object.keys(daily).forEach(function (code) {
      if (cfg[code].cadence !== 'daily' && cfg[code].cadence !== 'sparse') return;
      var s = daily[code], v = [], med = [], lo = [], hi = [], dec = sp.dec[code];
      for (var i = 0; i < DAYS; i++) {
        v.push(s[i] != null ? rnd(s[i], dec) : null);
        var win = []; for (var j = Math.max(0, i - 27); j <= i; j++) if (s[j] != null) win.push(s[j]);
        if (win.length >= (cfg[code].cadence === 'daily' ? 7 : 3)) { med.push(rnd(median(win), dec)); lo.push(rnd(pct(win, 25), dec)); hi.push(rnd(pct(win, 75), dec)); }
        else { med.push(null); lo.push(null); hi.push(null); }
      }
      series[code] = { v: v, med: med, p25: lo, p75: hi };
    });
    var files = {};
    this.counts.forEach(function (n, k) { var p = k.split('\u0000'); (files[p[0]] = files[p[0]] || { kept: 0, duplicate: 0, rejected: 0, skipped: 0, reasons: [] })[p[1]] += n; if (p[2]) files[p[0]].reasons.push([p[1], p[2], n]); });
    var labs = {};
    obs.forEach(function (o) { if (cfg[o.code] && cfg[o.code].cadence === 'lab') (labs[o.code] = labs[o.code] || []).push({ date: o.local_date, value: rnd(o.value, sp.dec[o.code] || 1), orig: o.orig_value + ' ' + o.orig_unit }); });
    Object.keys(labs).forEach(function (k) { labs[k].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
    return { as_of: asOf, start: START, days: DAYS, files: files, observations: obs.length, workouts: this.workouts.size,
      notifications: this.notifications, windows: windows, coverage: cov, medications: meds, signals: sigs, series: series, labs: labs,
      away_days: Object.keys(away).length, timezones: Object.keys(tzc).sort() };
  };

  function reconcileMeds(clinical, entries, asOf) {
    var names = {};
    clinical.forEach(function (c) { if (['medication', 'prescription', 'dispense'].indexOf(c.type) >= 0) (names[c.text] = names[c.text] || []).push(c); });
    entries.forEach(function (e) { if (e.type === 'medication_report') (names[e.medication] = names[e.medication] || []).push(Object.assign({}, e, { type: 'report' })); });
    return Object.keys(names).sort().map(function (name) {
      var recs = names[name], st = recs.filter(function (r) { return r.type === 'medication'; }), rq = recs.filter(function (r) { return r.type === 'prescription'; });
      var dp = recs.filter(function (r) { return r.type === 'dispense'; }).sort(function (a, b) { return a.when < b.when ? -1 : 1; }), rp = recs.filter(function (r) { return r.type === 'report'; });
      var sources = [], reasons = [], status;
      rq.forEach(function (r) { sources.push({ kind: 'prescribed', text: 'Prescription ' + r.record_status + ', written ' + r.authored + (r.valid_until ? ', valid until ' + r.valid_until : '') }); });
      if (dp.length) sources.push({ kind: 'dispensed', text: dp.length + ' pharmacy fills, last ' + dp[dp.length - 1].when + ' (' + dp[dp.length - 1].days_supply + ' days)' });
      st.forEach(function (r) { sources.push({ kind: 'listed', text: 'Medication list says ' + r.record_status + ' (as of ' + r.asserted + ')' }); });
      rp.forEach(function (r) { sources.push({ kind: 'patient_reported', text: 'You reported: ' + r.reported_status + ' on ' + r.date }); });
      var all = st.concat(rq), active = all.some(function (r) { return r.record_status === 'active'; });
      var ended = all.filter(function (r) { return ['completed', 'stopped', 'cancelled'].indexOf(r.record_status) >= 0; });
      if (ended.length && !active) { status = ended.some(function (r) { return r.record_status === 'stopped'; }) ? 'discontinued' : 'historical'; reasons.push('The record marks it as no longer current; an old prescription does not make it current.'); }
      else {
        status = active ? 'active' : 'needs review';
        if (rp.some(function (r) { return r.reported_status === 'stopped' || r.reported_status === 'not taking'; })) { status = 'needs review'; reasons.push('The record lists it as active, but you reported stopping it.'); }
        if (dp.length) { var end = addDays(dp[dp.length - 1].when, dp[dp.length - 1].days_supply || 30); if (diffDays(asOf, end) > 30) { status = 'needs review'; reasons.push('The last fill would have run out around ' + end + '; no fill since.'); } }
      }
      return { name: name, status: status, sources: sources, reasons: reasons };
    });
  }

  // ------------------------------------------------------------------ streaming file readers (Blob/File; browser worker and Node 20+)
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }
  async function bytes(blob, a, b) { return new Uint8Array(await blob.slice(a, b).arrayBuffer()); }
  // Find export.xml inside an Apple Health ZIP and return a ReadableStream of its text.
  async function zipEntryStream(blob, wanted) {
    var tailLen = Math.min(blob.size, 65557), tail = await bytes(blob, blob.size - tailLen, blob.size), eocd = -1;
    for (var i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a ZIP file (no end-of-directory record).');
    var cdSize = u32(tail, eocd + 12), cdOff = u32(tail, eocd + 16), cd = await bytes(blob, cdOff, cdOff + cdSize), p = 0, names = [];
    while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50) {
      var method = u16(cd, p + 10), csize = u32(cd, p + 20), nlen = u16(cd, p + 28), xlen = u16(cd, p + 30), clen = u16(cd, p + 32), loff = u32(cd, p + 42);
      var name = new TextDecoder().decode(cd.slice(p + 46, p + 46 + nlen)); names.push(name);
      if (wanted(name)) {
        var lh = await bytes(blob, loff, loff + 30), start = loff + 30 + u16(lh, 26) + u16(lh, 28), body = blob.slice(start, start + csize);
        if (csize === 0xffffffff) throw new Error('This export uses ZIP64; it is too large for the browser reader in this prototype.');
        var raw = body.stream();
        var s = method === 8 ? raw.pipeThrough(new DecompressionStream('deflate-raw')) : (method === 0 ? raw : null);
        if (!s) throw new Error('Unsupported compression method ' + method + '.');
        return { name: name, stream: s, compressedSize: csize, names: names };
      }
      p += 46 + nlen + xlen + clen;
    }
    throw new Error('No export.xml found in this ZIP (entries: ' + names.slice(0, 5).join(', ') + ').');
  }
  // Read a text stream in chunks, feeding tok.push; onProgress(bytesRead); stop when signal.aborted.
  async function pumpText(stream, onChunk, onProgress, signal) {
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader(), read = 0;
    for (;;) {
      if (signal && signal.aborted) { await reader.cancel(); throw new Error('cancelled'); }
      var r = await reader.read();
      if (r.done) break;
      read += r.value.length; onChunk(r.value); if (onProgress) onProgress(read);
    }
  }
  async function head(stream, n) {
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader(), out = '';
    while (out.length < n) { var r = await reader.read(); if (r.done) break; out += r.value; }
    await reader.cancel(); return out;
  }

  // Import one Blob/File. kind is detected from the name and content.
  async function importBlob(session, blob, name, opts) {
    opts = opts || {};
    var lower = name.toLowerCase(), isZip = lower.endsWith('.zip'), isXml = lower.endsWith('.xml');
    var mark = session.spec.synthetic_mark;
    if (isZip || isXml) {
      var getStream = async function () { return isZip ? (await zipEntryStream(blob, function (n) { return /(^|\/)export\.xml$/.test(n); })).stream : blob.stream(); };
      var first = await head(await getStream(), 4096);
      if (!opts.allowReal && first.indexOf(mark) < 0) return { name: name, refused: true };
      if (first.indexOf('<HealthData') < 0) throw new Error(name + ' does not look like an Apple Health export (no <HealthData> element).');
      var tok = session.appleTokenizer(name), total = isZip ? null : blob.size;
      await pumpText(await getStream(), tok.push, function (n) { if (opts.onProgress) opts.onProgress(name, n, total); }, opts.signal);
      tok.end();
      return { name: name, kind: 'apple_export' };
    }
    var text = await blob.text();
    if (!opts.allowReal && text.slice(0, 600).indexOf(mark) < 0) return { name: name, refused: true };
    if (lower.endsWith('.json')) { session.fhir(text, name); return { name: name, kind: 'fhir' }; }
    if (lower.endsWith('.csv')) { return { name: name, kind: session.csv(text, name) }; }
    throw new Error(name + ': unsupported file type. Use .zip or .xml (Apple Health), .csv (devices) or .json (FHIR).');
  }

  var api = { Session: Session, importBlob: importBlob, zipEntryStream: zipEntryStream, reconcileMeds: reconcileMeds, parseApple: parseApple };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HLEngine = api;
})(typeof self !== 'undefined' ? self : this);
