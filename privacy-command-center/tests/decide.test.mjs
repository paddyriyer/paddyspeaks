/* Decide & Report: the decision register and memo, recording a decision,
 * the trail → investigation report → draft memo, and print / PDF output. */
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };
const SECTIONS = ['Decision required', 'Promise and people affected', 'Evidence', 'Options', 'Recommendation', 'Dissent or uncertainty', 'Owner, approver and due date', 'Final decision and follow-up test'];
const noJunk = (t) => !/\b(NaN|undefined|Infinity)\b/.test(t);

/* Count PDF pages from the page tree: /Type /Page objects (not /Pages). */
const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
/* A4 with the @page margins in pcc-print.css: 297mm − 16mm − 18mm tall, 210mm − 28mm wide, at 96 px per inch. */
const MM = 96 / 25.4, PAGE_H = (297 - 16 - 18) * MM, PAGE_W = (210 - 28) * MM;

export default [
  { name: 'register lists every decision with stage, promise, owner, approver, due, SLA, recommendation and test', async run({ page, assert }) {
    const p = await page('decisions');
    const r = await p.evaluate(() => ({ rows: document.querySelectorAll('table.dreg tbody tr').length, n: NS.decisions.length,
      heads: [...document.querySelectorAll('table.dreg th')].map((t) => t.textContent), text: document.querySelector('main').innerText,
      promiseChips: document.querySelectorAll('table.dreg .dr-p .chip').length, fresh: document.querySelectorAll('table.dreg .fresh').length }));
    assert(r.rows === r.n, `every decision listed (${r.rows} of ${r.n})`);
    for (const h of ['Decision · promise', 'Stage', 'Owner · approver', 'Due · SLA', 'Recommended', 'Follow-up test']) assert(r.heads.includes(h), 'column ' + h);
    assert(r.promiseChips === r.n && r.fresh >= r.n - 1, 'promise and test freshness on every row');
    assert(noJunk(r.text), 'no NaN/undefined');
    await p.go('decisions?stage=verifying');
    const v = await p.evaluate(() => [...document.querySelectorAll('table.dreg tbody tr .stage')].map((s) => s.className));
    assert(v.length >= 1 && v.every((c) => /stage-verifying/.test(c)), 'stage filter keeps only verifying decisions');
    await p.go('decisions?owner=__none');
    const o = await p.evaluate(() => ({ rows: document.querySelectorAll('table.dreg tbody tr').length, unk: document.querySelectorAll('table.dreg tbody .unknown').length, want: NS.decisions.filter((d) => !d.owner).length }));
    assert(o.rows === o.want && o.unk >= o.rows, 'owner filter: unowned decisions, shown as UNKNOWN');
    clean(p, 'register'); await p.closeAll();
    const q = await page('decisions?as=cpo');
    const note = await q.evaluate(() => document.querySelector('.dr-note').innerText);
    clean(q, 'register cpo'); await q.closeAll();
    assert(/you approve/i.test(note) && /D-1\d\d/.test(note), 'leadership note names what the CPO approves: ' + note);
  } },
  { name: 'decision memo has every required section, and recording a decision moves it to decided', async run({ page, assert }) {
    const p = await page('decisions/D-101');
    const r = await p.evaluate(() => ({ h: [...document.querySelectorAll('.dm-sec > .dm-h')].map((h) => h.textContent.replace(/^\d+/, '').trim()),
      quote: (document.querySelector('.dm-quote q') || {}).textContent || '', opts: document.querySelectorAll('.dm-opt').length, rec: document.querySelectorAll('.dm-opt.rec').length,
      optFields: [...document.querySelectorAll('.dm-opt')].every((o) => ['Privacy reduction', 'Product impact', 'Cost'].every((k) => o.innerText.toLowerCase().includes(k.toLowerCase())) && o.querySelector('.pro') && o.querySelector('.con') && /Trade-off/.test(o.innerText)),
      risk: (document.querySelector('.dm .rx-s') || {}).textContent || '', chain: document.querySelectorAll('.dm .chainx .cx').length, fresh: document.querySelectorAll('#dm-evidence .fresh').length,
      sev: document.querySelectorAll('#dm-evidence .tag[class*="sev-"]').length, cite: document.querySelectorAll('.dm .cite').length,
      stage: document.querySelector('.dm-meta .stage').textContent, form: !!document.querySelector('#dmForm'), text: document.querySelector('main').innerText }));
    assert(JSON.stringify(r.h) === JSON.stringify(['Decision required', 'Promise and people affected', 'Evidence', 'Options', 'Recommendation', 'Dissent or uncertainty', 'Owner, approver and due date', 'Final decision and follow-up test']), 'eight sections in order: ' + r.h.join(' | '));
    assert(r.quote.length > 20, 'the promise is quoted');
    assert(/Up to .* customers/i.test(r.text) && /What it means for them/i.test(r.text), 'people affected and the human consequence');
    assert(r.opts >= 2 && r.rec === 1 && r.optFields, 'at least two options, each with pros, cons, trade-off, privacy, product, cost');
    assert(/^(High|Medium|Low) because /.test(r.risk), 'residual risk explained in words');
    assert(r.chain === 14 && r.fresh > 0 && r.sev > 0 && r.cite >= 2, 'evidence: findings with severity, tests with freshness, the chain, citations');
    assert(/SLA/.test(r.text) && /approver/i.test(r.text) && /\d{1,2} [A-Z][a-z]{2} 20\d\d/.test(r.text), 'owner, approver, human due date and SLA');
    assert(r.stage === 'Decision owed' && r.form, 'owed memo offers the record form');
    assert(noJunk(r.text) && !/residual\s+\d/i.test(r.text.replace(/residual risk/ig, '')), 'no junk values or bare residual score');
    /* An empty rationale is refused, with a message. */
    await p.click('#dmForm button[type=submit]');
    const refused = await p.evaluate(() => ({ msg: document.querySelector('#dmMsg').textContent, inv: document.querySelector('#dmRationale').getAttribute('aria-invalid'), st: NS.decisions.find((d) => d.id === 'D-101').status }));
    assert(refused.msg && refused.inv === 'true' && refused.st === 'owed', 'empty rationale refused');
    await p.check('#dmForm input[value="B"]');
    await p.fill('#dmRationale', 'Removing the data class beats guarding it.');
    await p.fill('#dmBy', 'CPO (test)');
    await p.click('#dmForm button[type=submit]'); await p.waitForTimeout(200);
    const after = await p.evaluate(() => ({ stage: document.querySelector('.dm-meta .stage').textContent, next: (document.querySelector('#dmNext') || {}).innerText || '', final: (document.querySelector('.dm-final') || {}).innerText || '',
      steps: document.querySelector('.dm-steps [aria-current="step"]').textContent, chosen: (document.querySelector('.dm-opt.chosen .dm-opt-id') || {}).textContent,
      trail: PCC.state.trail.slice(-1)[0], form: !!document.querySelector('#dmForm'), focus: document.activeElement && document.activeElement.id, owed: NS.decisions.filter((d) => d.status === 'owed').length,
      stored: (() => { try { return Object.keys(localStorage).filter((k) => /decision|D-101/i.test(k + localStorage.getItem(k))).length; } catch (e) { return 0; } })() }));
    assert(after.stage === 'Decided' && /Decided/.test(after.steps), 'stage becomes decided: ' + after.stage);
    assert(/Next thing to prove/i.test(after.next) && /Retention scan/.test(after.next), 'the follow-up test is shown as the next thing to prove');
    assert(/CPO \(test\)/.test(after.final) && /Removing the data class/.test(after.final) && after.chosen === 'B', 'final decision shows option, who and why');
    assert(after.trail === 'D-101' && !after.form && after.focus === 'dmNext', 'decision on the trail, form gone, focus on the next proof');
    assert(after.stored === 0, 'nothing written to browser storage');
    await p.go('decisions');
    const reg = await p.evaluate(() => [...document.querySelectorAll('table.dreg tbody tr')].find((tr) => tr.innerText.includes('D-101')).innerText);
    assert(/Decided/i.test(reg) && /option B/.test(reg), 'the register reflects the recorded decision');
    clean(p, 'memo'); await p.closeAll();
  } },
  { name: 'executive memo keeps old links working and renders the same memo', async run({ page, assert }) {
    for (const [route, want] of [['report/executive', null], ['report/executive?r=R-03', 'D-103'], ['report/executive?f=PRV-0237', 'D-109'], ['report/executive?d=D-104', 'D-104']]) {
      const p = await page(route);
      const r = await p.evaluate(() => ({ id: document.querySelector('.dm').getAttribute('data-decision'), secs: document.querySelectorAll('.dm-sec').length, pick: !!document.querySelector('#execPick') }));
      clean(p, route); await p.closeAll();
      assert(r.secs === 8 && r.pick, route + ': memo with picker');
      if (want) assert(r.id === want, route + ' → ' + r.id + ', expected ' + want);
    }
  } },
  { name: 'trail → share link → investigation report → draft memo reproduces steps and citations', async run({ page, assert }) {
    const p = await page('promises/PR-LOC');
    for (const id of ['PRV-0201', 'd_lochist', 'c_retention_scan']) { await p.evaluate((i) => PCC.open(i), id); await p.waitForTimeout(80); }
    await p.keyboard.press('Escape');
    const t = await p.evaluate(() => ({ trail: PCC.state.trail.slice(), acts: [...document.querySelectorAll('#trail .trail-act')].map((a) => a.textContent), report: document.querySelector('#trail a[href*="report/investigation"]').getAttribute('href'), draft: document.querySelector('#trail a[href*="decisions/new"]').getAttribute('href') }));
    assert(JSON.stringify(t.trail) === JSON.stringify(['PR-LOC', 'PRV-0201', 'd_lochist', 'c_retention_scan']), 'trail recorded in order: ' + t.trail);
    assert(['Report', 'Draft memo', 'Copy link'].every((a) => t.acts.includes(a)), 'trail bar offers report, draft memo and copy link');
    await p.click('#trail [data-act="shareTrail"]'); await p.waitForTimeout(200);
    const shared = await p.evaluate(() => { const i = document.getElementById('trailLink'); return i ? i.value : (document.getElementById('trailMsg') || {}).textContent; });
    assert(/report\/investigation\?t=PR-LOC,PRV-0201,d_lochist,c_retention_scan|Link copied/.test(shared), 'share gives the reproducing link: ' + shared);
    clean(p, 'trail'); await p.closeAll();
    /* A fresh page, from the link alone. */
    const q = await page(t.report.replace(/^#\//, ''));
    const r = await q.evaluate(() => ({ steps: [...document.querySelectorAll('.ir-step')].map((s) => ({ type: s.querySelector('.ir-type').textContent, why: s.querySelector('.ir-why').textContent, cites: s.querySelectorAll('.cite .chip').length })),
      trail: PCC.state.trail.slice(), chain: document.querySelectorAll('.ir .chainx .cx').length, text: document.querySelector('main').innerText }));
    assert(r.steps.length === 4, 'four steps reproduced, got ' + r.steps.length);
    assert(/Promise/.test(r.steps[0].type) && /Finding/.test(r.steps[1].type) && /Dataset/.test(r.steps[2].type) && /Control/.test(r.steps[3].type), 'types in order');
    assert(r.steps.every((s) => /Why it matters: .{10}/.test(s.why) && s.cites > 0), 'each step says why it matters and cites records');
    assert(JSON.stringify(r.trail) === JSON.stringify(t.trail), 'the fresh page rebuilds the same trail');
    assert(r.chain === 14 && /Generated \d{1,2} [A-Z][a-z]{2} 20\d\d/.test(r.text) && /Synthetic demo data/.test(r.text) && noJunk(r.text), 'chain, generated date and disclaimer');
    await q.click('.ir-acts a[href*="decisions/new"]'); await q.waitForTimeout(200);
    const d = await q.evaluate(() => ({ banner: (document.querySelector('.dm-banner') || {}).textContent || '', secs: [...document.querySelectorAll('.dm-sec > .dm-h')].map((h) => h.textContent.replace(/^\d+/, '').trim()),
      quote: (document.querySelector('.dm-quote q') || {}).textContent || '', findings: [...document.querySelectorAll('#dm-evidence .dm-t .chip')].map((c) => c.textContent), empty: document.querySelectorAll('.dm-opt.empty').length,
      cover: (document.querySelector('.dm-cover') || {}).textContent || '', found: document.querySelectorAll('#dm-evidence .cite .chip').length, decided: NS.decisions.find((x) => x.id === 'D-101').status }));
    clean(q, 'report → draft'); await q.closeAll();
    assert(/Draft — not a decision/.test(d.banner), 'labelled as a draft, not a decision');
    assert(d.secs.length === 8, 'draft has the eight memo sections');
    assert(/pickup point/.test(d.quote) && d.findings.some((f) => /PRV-0201/.test(f)), 'pre-filled with the promise and the finding from the trail');
    assert(d.empty >= 2 && d.found >= 4, 'empty option slots and every record found along the way cited');
    assert(/D-101/.test(d.cover) && d.decided === 'owed', 'points to the existing decision instead of duplicating it');
  } },
  { name: 'print media hides chrome, opens details, and adds the date and disclaimer', async run({ page, assert }) {
    for (const route of ['decisions/D-102', 'report/investigation?t=PR-HEALTH,PRV-0229,D-102', 'overview?as=cpo', 'explore/person', 'privacy/deletion', 'privacy/ai', 'assurance/controls']) {
      const p = await page(route);
      await p.emulateMedia({ media: 'print' });
      const r = await p.evaluate(() => {
        const vis = (s) => [...document.querySelectorAll(s)].some((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
        const closed = [...document.querySelectorAll('#view details:not([open])')];
        const hiddenInside = closed.filter((d) => [...d.children].some((c) => c.tagName !== 'SUMMARY' && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height === 0 && c.textContent.trim())).length;
        const head = document.querySelector('.pcc-print-head');
        return { chrome: ['.top', '.side', '.trail', '.drawer', '.analyst', '.palette', '.pcc-foot', '.ps-footer-legal'].filter(vis), closed: closed.length, hiddenInside,
          head: head && getComputedStyle(head).display !== 'none' ? head.innerText : '', foot: (document.querySelector('.pcc-print-foot') || {}).innerText || '',
          mainLeft: document.getElementById('view').getBoundingClientRect().left, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      clean(p, route); await p.closeAll();
      assert(!r.chrome.length, route + ': chrome visible in print: ' + r.chrome.join(', '));
      assert(r.hiddenInside === 0, route + ': ' + r.hiddenInside + ' closed <details> still hide content in print');
      assert(/Generated \d{1,2} [A-Z][a-z]{2} 20\d\d/.test(r.head) && /synthetic demo data/i.test(r.head) && /Synthetic demo data/.test(r.foot), route + ': print header/footer with date and disclaimer');
      assert(r.mainLeft < 20 && r.overflow <= 0, route + ': content uses the full width (left ' + r.mainLeft + ')');
    }
  } },
  { name: 'PDF output has a plausible page count and no blank pages', async run({ page, assert }) {
    for (const route of ['decisions/D-101', 'report/investigation?t=PR-LOC,PRV-0201,d_lochist,c_retention_scan,D-101', 'decisions']) {
      const p = await page(route, { width: Math.round(PAGE_W) });
      const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      await p.emulateMedia({ media: 'print' });
      await p.setViewportSize({ width: Math.round(PAGE_W), height: 900 });
      const h = await p.evaluate(() => { window.PCC.printPrepare(); const H = document.documentElement.scrollHeight; window.PCC.printRestore(); return H; });
      clean(p, route); await p.closeAll();
      const pages = pdfPages(buf), expect = Math.ceil(h / PAGE_H);
      assert(buf.slice(0, 5).toString() === '%PDF-', route + ': not a PDF');
      assert(pages >= 1, route + ': no pages');
      assert(pages <= expect + 1 && pages >= Math.max(1, expect - 1), `${route}: ${pages} PDF pages for ${Math.round(h)}px of print content (≈${expect} pages) — blank or missing pages`);
    }
  } },
  /* Module pages are long and dense, so the height estimate is only an upper bound here:
   * a page that must not split can push the next record over, but a run of blank pages
   * (the failure this guards) would blow well past it. Lost content is caught above, by
   * the check that no closed <details> hides anything in print. */
  { name: 'module pages print without runaway or blank pages', async run({ page, assert }) {
    for (const route of ['explore/person', 'privacy/deletion', 'privacy/ai', 'assurance/controls', 'privacy/consent']) {
      const p = await page(route, { width: Math.round(PAGE_W) });
      const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      await p.emulateMedia({ media: 'print' });
      const h = await p.evaluate(() => { window.PCC.printPrepare(); const H = document.documentElement.scrollHeight; window.PCC.printRestore(); return H; });
      clean(p, route); await p.closeAll();
      const pages = pdfPages(buf), expect = Math.ceil(h / PAGE_H);
      assert(buf.slice(0, 5).toString() === '%PDF-' && pages >= 1, route + ': no PDF');
      assert(pages <= expect + Math.ceil(expect * 0.2) + 1, `${route}: ${pages} PDF pages for ≈${expect} pages of print content — blank pages`);
    }
  } },
];
