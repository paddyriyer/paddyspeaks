#!/usr/bin/env node
/**
 * privacy-agent — command line entry point.
 *
 * Commands:
 *   init        create the encrypted vault
 *   onboard     the guided identity interview
 *   run         discover + remove (mission or review mode)
 *   discover    discovery only, no removals
 *   status      what the last run found
 *   verify      re-check pending removals, and look for reappearances
 *   report      the full end-of-run summary
 *   workflows   inspect the learned site templates
 *   destroy     delete the vault and everything in it
 */

import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { stdin, stdout, argv, exit, env } from 'node:process';
import { Vault, vaultHome } from '../src/store/vault.js';
import { PrivacyAgent, MODE } from '../src/agent.js';
import { GROUPS, normalizeAnswers, assessCoverage } from '../src/onboarding/interview.js';
import { providerGuidance } from '../src/discover/providers.js';
import { Dashboard } from '../src/ui/server.js';
import { STATE, STATE_LABELS } from '../src/core/states.js';
import { readConsoleExport, mergeExposures } from '../src/core/handoff.js';

const rl = createInterface({ input: stdin, output: stdout });

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  gold: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

async function main() {
  const command = argv[2] || 'help';
  const flags = parseFlags(argv.slice(3));

  switch (command) {
    case 'init': return cmdInit();
    case 'onboard': return cmdOnboard();
    case 'import': return cmdImport(argv[3]);
    case 'run': return cmdRun(flags);
    case 'discover': return cmdRun({ ...flags, mode: MODE.DISCOVER_ONLY });
    case 'status': return cmdStatus();
    case 'verify': return cmdVerify();
    case 'report': return cmdReport();
    case 'workflows': return cmdWorkflows();
    case 'evidence': return cmdEvidence(flags);
    case 'forget-browser': return cmdForgetBrowser();
    case 'destroy': return cmdDestroy();
    default: return cmdHelp();
  }
}

/* ------------------------------------------------------------- commands */

async function cmdInit() {
  const vault = new Vault();
  if (vault.exists()) {
    console.log(`A vault already exists at ${vaultHome()}.`);
    console.log('Use `privacy-agent destroy` first if you want to start over.');
    return;
  }

  console.log(c.bold('\nSetting up your vault.\n'));
  console.log('Everything the agent learns about you is encrypted on this machine');
  console.log('with a passphrase only you know. Nothing is uploaded anywhere.\n');
  console.log(c.dim('If you forget this passphrase the vault cannot be recovered.'));
  console.log(c.dim('That is deliberate — it holds your home address.\n'));

  const pass = await rl.question('Choose a passphrase (at least 8 characters): ');
  const again = await rl.question('Type it again: ');
  if (pass !== again) return console.log(c.red('\nThose do not match. Nothing was created.'));

  try {
    vault.create(pass);
  } catch (err) {
    return console.log(c.red(`\n${err.message}`));
  }
  console.log(c.green(`\nVault created at ${vaultHome()}`));
  console.log('\nNext: `privacy-agent onboard`');
}

async function cmdOnboard() {
  const vault = await unlock();
  if (!vault) return;

  console.log(c.bold('\nLet\'s work out who we are looking for.\n'));
  console.log('Every question is optional. Press Enter to skip anything you would');
  console.log('rather not share — the agent will tell you what that costs.\n');

  const answers = {};
  for (const group of GROUPS) {
    console.log(`\n${c.bold(group.title)}`);
    console.log(c.dim(wrap(group.intro, 76)));
    console.log('');

    for (const q of group.questions) {
      console.log(c.dim(`  ${wrap(q.why, 74, '  ')}`));
      const hint = q.type === 'list' ? ' (comma-separated)' : '';
      const value = await rl.question(`  ${c.gold(q.prompt)}${hint}: `);
      if (value.trim()) answers[q.key] = value;
      console.log('');
    }

    if (group !== GROUPS[GROUPS.length - 1]) {
      const more = await rl.question(c.dim('  Continue to the next group? [Y/n] '));
      if (more.trim().toLowerCase() === 'n') break;
    }
  }

  const normalized = normalizeAnswers(answers);
  const coverage = assessCoverage(normalized);

  if (!coverage.ok) {
    return console.log(c.red(`\n${coverage.gaps.join('\n')}`));
  }

  console.log(`\n${c.bold('Coverage:')} ${coverage.strength}% — ${coverage.summary}`);
  for (const gap of coverage.gaps) console.log(c.dim(`  · ${wrap(gap, 74, '    ')}`));

  const agent = new PrivacyAgent({ vault });
  await agent.initIdentity(normalized);

  console.log(c.green('\nIdentity profile saved and encrypted.'));
  console.log(`Known identifiers to search on: ${agent.graph.size()}`);
  console.log('\nNext: `privacy-agent run --review` (or `--mission` to let it work unattended)');
}

/**
 * Pick up where the website left off.
 *
 * The console at paddyspeaks.com/privacy/ can do everything except press
 * submit — a page cannot fill in a form on another origin, and that rule is
 * why a random tab cannot post from your bank. Without this command, anyone
 * who did that work in the browser had to start again from an empty vault to
 * get a single thing actually removed.
 */
async function cmdImport(file) {
  if (!file) {
    console.log(c.red('\nUsage: privacy-agent import <file.json>'));
    console.log('\nExport the file from paddyspeaks.com/privacy/ — step 4, "Your data",');
    console.log('the "Export as JSON" button.\n');
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return console.log(c.red(`\nCould not read ${file}: ${err.message}\n`));
  }

  const read = readConsoleExport(data);
  if (!read.ok) {
    return console.log(c.red(`\n${read.warnings.join('\n')}\n`));
  }

  const vault = await unlock();
  if (!vault) return;

  const agent = new PrivacyAgent({ vault });
  agent.load();

  // The profile is rebuilt from the raw answers rather than copied out of the
  // file, so it is always produced by this version of the parser.
  if (read.answers) {
    const normalized = normalizeAnswers(read.answers);
    const coverage = assessCoverage(normalized);
    if (!coverage.ok) {
      console.log(c.red(`\n${coverage.gaps.join('\n')}`));
      return;
    }
    await agent.initIdentity(normalized);
    console.log(c.green(`\nIdentity profile rebuilt — ${agent.graph.size()} identifiers to search on.`));
  } else if (!agent.profile) {
    return console.log(c.red('\nNo identity in the export and none in the vault. Run `privacy-agent onboard` first.\n'));
  }

  agent.run = agent.run || { exposures: [] };
  agent.run.exposures = agent.run.exposures || [];
  const merged = mergeExposures(agent.run.exposures, read.exposures);
  agent.run.exposures = merged.exposures;
  agent.save();

  console.log(`\n${c.bold('Imported.')} ${read.summary}`);
  if (merged.added) console.log(c.green(`  ${merged.added} new`));
  if (merged.kept) console.log(c.dim(`  ${merged.kept} already in the vault, left as they were`));

  for (const w of read.warnings) console.log(c.dim(`  · ${wrap(w, 74, '    ')}`));
  for (const s of read.skipped.slice(0, 8)) {
    console.log(c.dim(`  · skipped ${s.url} — ${s.why}`));
  }
  if (read.skipped.length > 8) console.log(c.dim(`  · and ${read.skipped.length - 8} more skipped`));

  console.log(`\nNothing has been submitted yet. To let the agent file the removals:`);
  console.log(`  ${c.gold('privacy-agent run --mission')}`);
  console.log(c.dim('  (or --review to approve each one yourself)\n'));
}

async function cmdRun(flags) {
  const vault = await unlock();
  if (!vault) return;

  const guidance = providerGuidance();
  if (!guidance.ready && flags.mode !== MODE.DISCOVER_ONLY) {
    console.log(`\n${guidance.message}\n`);
    const go = await rl.question('Continue in manual mode anyway? [y/N] ');
    if (go.trim().toLowerCase() !== 'y') return;
  } else {
    console.log(c.dim(`\n${guidance.message}`));
  }

  const mode = flags.mode
    || (flags.mission ? MODE.MISSION : MODE.REVIEW);

  if (mode === MODE.MISSION) {
    console.log(c.bold('\n"Remove everything possible" mode.\n'));
    console.log('The agent will file removal requests for every confirmed exposure');
    console.log('without asking each time. It will still stop and ask you about:');
    console.log('  · records it cannot confidently tell are yours');
    console.log('  · any site asking for ID, an SSN or a licence');
    console.log('  · any site asking for payment (it never pays)');
    console.log('  · CAPTCHAs, SMS codes and multi-factor prompts');
    console.log('  · deleting an account, which cannot be undone\n');
    const ok = await rl.question('Approve the mission? [y/N] ');
    if (ok.trim().toLowerCase() !== 'y') return console.log('Nothing was done.');
  }

  const agent = new PrivacyAgent({
    vault,
    options: { mode, headless: flags.headless === true },
  });
  agent.load();

  if (!agent.profile) {
    return console.log(c.red('No identity profile yet. Run `privacy-agent onboard` first.'));
  }

  const dashboard = new Dashboard(agent);
  const url = await dashboard.start();

  agent.hooks = buildHooks(dashboard);
  agent.hooks.onEvent = (event, payload) => dashboard.push(event, payload);
  agent.hooks.onLog = (entry) => {
    if (flags.verbose) console.log(c.dim(`  ${entry.message}`));
  };

  console.log(`\n${c.bold('Dashboard:')} ${c.gold(url)}`);
  console.log(c.dim('Open that to watch progress and answer anything the agent asks.\n'));

  const stopping = () => { agent.cancel(); };
  process.on('SIGINT', stopping);

  try {
    const summary = await agent.start(mode);
    printSummary(summary);
  } finally {
    process.off('SIGINT', stopping);
    console.log(c.dim('\nDashboard still open — press Ctrl+C to close it.'));
    await new Promise((resolve) => process.once('SIGINT', resolve));
    await dashboard.stop();
  }
}

async function cmdStatus() {
  const vault = await unlock();
  if (!vault) return;
  const agent = new PrivacyAgent({ vault });
  agent.load();

  const exposures = agent.run?.exposures || [];
  if (!exposures.length) return console.log('\nNothing found yet. Run `privacy-agent run`.');

  const byState = new Map();
  for (const e of exposures) {
    if (!byState.has(e.status)) byState.set(e.status, []);
    byState.get(e.status).push(e);
  }

  console.log(c.bold(`\n${exposures.length} exposures\n`));
  for (const [state, list] of [...byState.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [label, help] = STATE_LABELS[state] || [state, ''];
    console.log(`${c.bold(String(list.length).padStart(4))}  ${label}`);
    console.log(c.dim(`      ${help}`));
    for (const e of list.slice(0, 4)) {
      console.log(c.dim(`      · ${e.domain} (risk ${e.risk?.score ?? '?'})`));
    }
    if (list.length > 4) console.log(c.dim(`      · …and ${list.length - 4} more`));
    console.log('');
  }
}

async function cmdVerify() {
  const vault = await unlock();
  if (!vault) return;
  const agent = new PrivacyAgent({ vault });
  agent.load();
  agent.hooks = buildHooks(null);

  const { BrowserSession } = await import('../src/browser/session.js');
  agent.session = new BrowserSession({ headless: true });

  console.log('\nRe-checking pending removals…');
  const result = await agent.verificationSweep({ force: true });
  console.log(`  checked ${result.checked}, confirmed removed ${c.green(result.removed || 0)}`);

  console.log('\nLooking for mirrors and republished copies…');
  const re = await agent.recheckForReappearance();
  if (re.reappeared?.length) {
    console.log(c.red(`  ${re.reappeared.length} record(s) have come back:`));
    for (const r of re.reappeared) console.log(`   · ${wrap(r.note, 72, '     ')}`);
  } else {
    console.log(c.green('  nothing has resurfaced.'));
  }

  await agent.session.close();
  agent.save();
}

async function cmdReport() {
  const vault = await unlock();
  if (!vault) return;
  const agent = new PrivacyAgent({ vault });
  agent.load();
  if (!agent.run?.exposures?.length) return console.log('\nNo run to report on yet.');
  printSummary(agent.buildSummary());
}

async function cmdWorkflows() {
  const vault = await unlock();
  if (!vault) return;
  const wf = vault.loadWorkflows();
  const sites = Object.entries(wf.sites || {});
  if (!sites.length) return console.log('\nNo site workflows learned yet.');

  console.log(c.bold(`\n${sites.length} learned workflows\n`));
  console.log(c.dim('These contain no personal data — only how each site\'s form works.'));
  console.log(c.dim(`Stored in the clear at ${vault.workflowsPath} so they can be shared.\n`));

  for (const [domain, t] of sites) {
    const total = t.stats.successes + t.stats.failures;
    console.log(`  ${c.bold(domain.padEnd(30))} ${t.workflowType || '?'}  ${t.stats.successes}/${total} ok`);
    if (t.failureModes?.length) console.log(c.dim(`      known issues: ${t.failureModes.join(', ')}`));
  }
}

/**
 * Evidence is encrypted at rest, so it needs an explicit decrypt step to view.
 * `--export=DIR` writes the PNGs out — with a warning, because the moment they
 * leave the vault they are ordinary readable images of the user's address.
 */
async function cmdEvidence(flags) {
  const vault = await unlock();
  if (!vault) return;
  const agent = new PrivacyAgent({ vault });
  agent.load();

  const items = (agent.run?.exposures || []).flatMap(
    (e) => (e.evidence || []).map((ev) => ({ ...ev, domain: e.domain })),
  );
  if (!items.length) return console.log('\nNo evidence captured yet.');

  console.log(c.bold(`\n${items.length} captures (encrypted at rest)\n`));
  for (const item of items) {
    console.log(`  ${item.domain.padEnd(28)} ${item.label.padEnd(22)} ${c.dim(new Date(item.capturedAt).toLocaleString())}`);
  }

  if (!flags.export) {
    return console.log(c.dim('\nUse --export=DIR to decrypt these to PNG files.'));
  }

  console.log(c.red('\nExporting decrypts these to ordinary PNG files.'));
  console.log(c.red('They are screenshots of pages showing your address and phone number.'));
  const ok = await rl.question('Continue? [y/N] ');
  if (ok.trim().toLowerCase() !== 'y') return console.log('Nothing exported.');

  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join: joinPath, basename } = await import('node:path');
  mkdirSync(flags.export, { recursive: true, mode: 0o700 });

  let n = 0;
  for (const item of items) {
    const bytes = vault.readEvidence(item.path);
    if (!bytes) continue;
    writeFileSync(joinPath(flags.export, basename(item.path).replace(/\.enc$/, '')), bytes, { mode: 0o600 });
    n += 1;
  }
  console.log(c.green(`\nExported ${n} file(s) to ${flags.export}`));
}

/**
 * The browser profile is the one thing that cannot be encrypted — Chromium
 * needs it readable. This wipes it.
 */
async function cmdForgetBrowser() {
  const vault = await unlock();
  if (!vault) return;
  const { rmSync, existsSync } = await import('node:fs');
  const { join: joinPath } = await import('node:path');
  const dir = joinPath(vaultHome(), 'browser-profile');

  if (!existsSync(dir)) return console.log('\nNo browser profile stored.');
  console.log('\nThis clears cookies, history and site data the agent\'s browser accumulated.');
  console.log(c.dim('You may have to redo any site logins or CAPTCHAs on the next run.'));
  const ok = await rl.question('Continue? [y/N] ');
  if (ok.trim().toLowerCase() !== 'y') return console.log('Kept.');

  rmSync(dir, { recursive: true, force: true });
  console.log(c.green('Browser profile cleared.'));
}

async function cmdDestroy() {
  const vault = new Vault();
  if (!vault.exists()) return console.log('\nThere is no vault to destroy.');

  console.log(c.red(c.bold('\nThis deletes your identity profile, every exposure found,')));
  console.log(c.red(c.bold('all captured evidence, and the browser profile. Permanently.')));
  const answer = await rl.question('\nType DELETE to confirm: ');
  if (answer !== 'DELETE') return console.log('Nothing was deleted.');

  vault.destroy();
  console.log(c.green('\nVault destroyed.'));
}

function cmdHelp() {
  console.log(`
${c.bold('privacy-agent')} — an autonomous privacy operations centre

  ${c.gold('init')}        create the encrypted vault on this machine
  ${c.gold('onboard')}     the guided identity interview
  ${c.gold('import')}      pick up work started at paddyspeaks.com/privacy/
                ${c.dim('privacy-agent import ~/Downloads/privacy-console-export.json')}
  ${c.gold('run')}         discover exposures and remove them
                ${c.dim('--review   (default) approve each removal yourself')}
                ${c.dim('--mission  approve once, let the agent work')}
                ${c.dim('--headless run the browser invisibly')}
                ${c.dim('--verbose  stream the agent log to the terminal')}
  ${c.gold('discover')}    discovery only — find everything, remove nothing
  ${c.gold('status')}      what state each exposure is in
  ${c.gold('verify')}      re-check pending removals and hunt for reappearances
  ${c.gold('report')}      the full summary
  ${c.gold('workflows')}   inspect the learned (PII-free) site templates
  ${c.gold('evidence')}    list captured screenshots ${c.dim('(--export=DIR to decrypt them)')}
  ${c.gold('forget-browser')} wipe the browser profile (cookies, history, site data)
  ${c.gold('destroy')}     delete the vault and everything in it

Everything runs locally. Your identity data never leaves this machine —
the only things sent anywhere are the removal requests themselves.

Vault: ${vaultHome()}
`);
}

/* ------------------------------------------------------ hooks & helpers */

/**
 * The interruption points. Every one of these is a decision with real
 * consequence — nothing here fires for a routine click or form submission.
 * Questions go to the dashboard when it is running, and fall back to the
 * terminal when it is not.
 */
function buildHooks(dashboard) {
  const ask = async (prompt) => {
    if (dashboard) return dashboard.ask(prompt);
    console.log(`\n${c.gold(prompt.title || 'Question')}: ${prompt.message || prompt.explanation || ''}`);
    const answer = await rl.question('  [y/N] ');
    return answer.trim().toLowerCase() === 'y';
  };

  return {
    askIsThisYou: (ctx) => ask({
      kind: 'is_this_you',
      title: 'Is this you?',
      domain: ctx.domain,
      url: ctx.url,
      explanation: ctx.explanation,
      evidence: ctx.evidence,
      conflicts: ctx.conflicts,
    }),

    askApproveRemoval: (ctx) => ask({
      kind: 'approve_removal',
      title: `Remove your details from ${ctx.domain}?`,
      message: `${ctx.risk?.explanation || ''} Exposed: ${(ctx.whatIsExposed || []).join(', ')}.`,
    }),

    askSensitive: async (ctx) => {
      const approved = [];
      for (const r of ctx.requests) {
        const ok = await ask({
          kind: 'sensitive',
          title: `${ctx.domain} is asking for ${r.kind.replace(/_/g, ' ')}`,
          message: `${r.explanation} The site labels the field "${r.label}"${r.required ? ' and marks it required' : ''}. Nothing has been sent.`,
        });
        if (ok) approved.push(r.kind);
      }
      return { approved };
    },

    askConfirmDestructive: (ctx) => ask({
      kind: 'destructive',
      title: `Permanently ${ctx.what} on ${ctx.domain}?`,
      message: ctx.why,
    }),

    askEmailAccess: (ctx) => ask({
      kind: 'email_access',
      title: 'Read your inbox to find the confirmation?',
      message: `${ctx.domain} sent a verification email. With your permission the agent will search recent mail for it, open it, and click the confirmation link. It only reads messages that look like this confirmation, and never sends anything.`,
    }),

    askWhichRecord: async (ctx) => {
      if (dashboard) {
        return dashboard.ask({
          kind: 'which_record',
          title: 'Which of these listings is yours?',
          message: ctx.candidates.map((r, i) => `${i + 1}. ${r.why}`).join('\n'),
        });
      }
      console.log(`\n${c.gold('Which listing is yours?')}`);
      ctx.candidates.forEach((r, i) => console.log(`  ${i + 1}. ${r.why}`));
      const answer = await rl.question('  number, or "none": ');
      const n = Number(answer);
      return Number.isFinite(n) && n >= 1 ? { choice: n - 1 } : { choice: 'none' };
    },

    askManualResults: async (query) => {
      console.log(`\n${c.gold('Manual search needed')}: ${query.text}`);
      console.log(c.dim('  Paste result URLs one per line, blank line when done.'));
      const urls = [];
      for (;;) {
        const line = await rl.question('  > ');
        if (!line.trim()) break;
        urls.push(line.trim());
      }
      return urls;
    },

    onPause: (request) => {
      console.log(`\n${c.gold('⏸  Paused')} — ${request.message}`);
      if (dashboard) dashboard.push('paused', request);
    },
  };
}

function printSummary(s) {
  console.log(`\n${c.bold('─'.repeat(60))}`);
  console.log(c.bold('  Run summary'));
  console.log(c.bold('─'.repeat(60)));

  const row = (label, value) => console.log(`  ${String(label).padEnd(34)} ${c.bold(value)}`);

  row('Searches run', s.sourcesSearched);
  row('Pages examined', s.pagesFetched);
  row('Discovery rounds', `${s.rounds} (${s.converged?.converged ? 'converged' : 'budget reached'})`);
  console.log('');
  row('Exposures discovered', s.exposuresDiscovered);
  row('Confirmed as yours', s.confirmedRecords);
  row('False positives rejected', s.falsePositivesRejected);
  row('Duplicate record groups', s.duplicateGroups);
  console.log('');
  row('Removal requests submitted', s.removalsSubmitted);
  row('Removals confirmed complete', c.green(s.removalsCompleted));
  row('Still pending', s.pendingRequests);
  row('Awaiting verification', s.verificationsPending);
  row('Need you', s.humanActionsRequired ? c.gold(s.humanActionsRequired) : 0);
  row('Not removable', s.nonRemovableRecords);
  console.log('');
  row('New identifiers discovered', s.newIdentifiersDiscovered.count);

  console.log(`\n  ${c.bold('Digital exposure score:')} ${s.exposureScore.score}/100 (${s.exposureScore.band})`);
  console.log(`  ${c.dim(wrap(s.exposureScore.explanation, 70, '  '))}`);

  if (s.topRisks?.length) {
    console.log(`\n  ${c.bold('Highest remaining risk:')}`);
    for (const t of s.topRisks) console.log(`    · ${t.domain} — ${t.risk}/100 (${t.band})`);
  }

  if (s.converged?.converged) {
    console.log(`\n  ${c.dim(`Discovery stopped because ${s.converged.reason}.`)}`);
  } else {
    console.log(`\n  ${c.gold('Discovery did not converge')} — ${s.converged?.reason}.`);
    console.log(c.dim('  Run again to keep going from where this left off.'));
  }
  console.log('');
}

async function unlock() {
  const vault = new Vault();
  if (!vault.exists()) {
    console.log(`\nNo vault at ${vaultHome()}. Run \`privacy-agent init\` first.`);
    return null;
  }
  const pass = env.PRIVACY_AGENT_PASSPHRASE
    || await rl.question('Vault passphrase: ');
  try {
    return vault.unlock(pass);
  } catch (err) {
    console.log(c.red(`\n${err.message}`));
    return null;
  }
}

function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.slice(2).split('=');
    const camel = key.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    flags[camel] = value === undefined ? true : value;
  }
  if (flags.mission) flags.mode = MODE.MISSION;
  if (flags.review) flags.mode = MODE.REVIEW;
  return flags;
}

function wrap(text, width = 76, indent = '') {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + word).length > width) { lines.push(line.trimEnd()); line = ''; }
    line += `${word} `;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.join(`\n${indent}`);
}

main()
  .catch((err) => { console.error(c.red(`\n${err.message}`)); exit(1); })
  .finally(() => rl.close());
