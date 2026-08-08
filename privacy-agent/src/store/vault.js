/**
 * The local vault: everything the agent knows, on disk, encrypted.
 *
 * Layout under `~/.privacy-agent/` (override with PRIVACY_AGENT_HOME):
 *
 *   vault.json      encrypted — the identity profile and graph
 *   run.json        encrypted — exposures, workflow state, evidence index
 *   workflows.json  *plaintext, deliberately* — site workflow templates
 *   evidence/       screenshots and confirmation captures
 *   agent.log       redacted log
 *
 * `workflows.json` is the one file that is not encrypted, and that is a
 * decision worth stating plainly: it holds *only* how a website's opt-out form
 * works — field names, navigation path, processing times. It contains no
 * personal data whatsoever, by construction (see workflows.js, which strips
 * values and keeps only selectors and shapes). Keeping it in the clear is what
 * lets it be shared or committed as a community resource, which is spec item
 * 34's requirement — and the same item's second half, "never share one user's
 * personal data with another", is why the split exists at all.
 *
 * Nothing here is uploaded anywhere. There is no server, no telemetry, and no
 * network call in this module.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { encrypt, decrypt, deriveKey, newSalt, passphraseCheck, verifyPassphrase, blindIndex } from './crypto.js';

export function vaultHome() {
  return process.env.PRIVACY_AGENT_HOME || join(homedir(), '.privacy-agent');
}

export class Vault {
  constructor(home = vaultHome()) {
    this.home = home;
    this.evidenceDir = join(home, 'evidence');
    this.metaPath = join(home, 'vault.meta.json');
    this.vaultPath = join(home, 'vault.json');
    this.runPath = join(home, 'run.json');
    this.workflowsPath = join(home, 'workflows.json');
    this.key = null;
    this.meta = null;
  }

  exists() {
    return existsSync(this.metaPath);
  }

  /** First-run setup. Creates the directory tree and the passphrase verifier. */
  create(passphrase) {
    mkdirSync(this.home, { recursive: true, mode: 0o700 });
    mkdirSync(this.evidenceDir, { recursive: true, mode: 0o700 });

    const salt = newSalt();
    const indexSalt = newSalt();
    this.key = deriveKey(passphrase, salt);
    this.meta = {
      version: 1,
      createdAt: new Date().toISOString(),
      salt: salt.toString('base64'),
      indexSalt: indexSalt.toString('base64'),
      check: passphraseCheck(this.key),
      // Spec item 27: retention is bounded by default, not indefinite.
      retentionDays: 365,
    };
    this.#writeJson(this.metaPath, this.meta);
    this.save('vault', { profile: null, graph: null });
    this.save('run', emptyRun());
    return this;
  }

  unlock(passphrase) {
    if (!this.exists()) throw new Error('no vault here yet — run `privacy-agent init` first');
    this.meta = JSON.parse(readFileSync(this.metaPath, 'utf8'));
    const key = deriveKey(passphrase, Buffer.from(this.meta.salt, 'base64'));
    if (!verifyPassphrase(key, this.meta.check)) {
      throw new Error('wrong passphrase');
    }
    this.key = key;
    return this;
  }

  #assertUnlocked() {
    if (!this.key) throw new Error('vault is locked');
  }

  #pathFor(name) {
    if (name === 'vault') return this.vaultPath;
    if (name === 'run') return this.runPath;
    throw new Error(`unknown vault section: ${name}`);
  }

  load(name) {
    this.#assertUnlocked();
    const path = this.#pathFor(name);
    if (!existsSync(path)) return name === 'run' ? emptyRun() : {};
    return decrypt(JSON.parse(readFileSync(path, 'utf8')), this.key);
  }

  save(name, value) {
    this.#assertUnlocked();
    this.#writeJson(this.#pathFor(name), encrypt(value, this.key));
    return value;
  }

  /** Stable pseudonymous id for a value, for dedupe without storing the value. */
  index(value) {
    this.#assertUnlocked();
    return blindIndex(value, Buffer.from(this.meta.indexSalt, 'base64'));
  }

  /* ------------------------------------------------------- workflows */

  /**
   * Site workflow templates. Plaintext by design — see the module header.
   * `assertNoPii` is the guard that keeps that promise honest.
   */
  loadWorkflows() {
    if (!existsSync(this.workflowsPath)) return { version: 1, sites: {} };
    try {
      return JSON.parse(readFileSync(this.workflowsPath, 'utf8'));
    } catch {
      return { version: 1, sites: {} };
    }
  }

  saveWorkflows(workflows) {
    assertNoPii(workflows);
    this.#writeJson(this.workflowsPath, workflows);
    return workflows;
  }

  /* -------------------------------------------------------- evidence */

  evidencePath(exposureId, label, ext = 'png') {
    const safe = String(label).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40);
    return join(this.evidenceDir, `${exposureId}__${Date.now()}__${safe}.${ext}`);
  }

  /**
   * Spec item 27: minimize retention. Drops evidence and closed exposures past
   * the retention window. Called on every run, not on a schedule the user has
   * to remember.
   */
  prune(now = Date.now()) {
    this.#assertUnlocked();
    const days = this.meta?.retentionDays ?? 365;
    const cutoff = now - days * 86400_000;
    const run = this.load('run');
    let dropped = 0;

    run.exposures = (run.exposures || []).filter((e) => {
      const closed = e.status === 'false_match' || e.status === 'successfully_removed';
      const stale = Date.parse(e.updatedAt || e.discoveredAt || 0) < cutoff;
      if (closed && stale) {
        for (const ev of e.evidence || []) {
          if (ev.path && existsSync(ev.path)) { rmSync(ev.path, { force: true }); }
        }
        dropped += 1;
        return false;
      }
      return true;
    });

    if (dropped) this.save('run', run);
    return { dropped, retentionDays: days };
  }

  /** Irreversibly destroy the vault. The user's data, the user's call. */
  destroy() {
    rmSync(this.home, { recursive: true, force: true });
    this.key = null;
    this.meta = null;
  }

  /** Atomic write: temp file then rename, so a crash cannot truncate a vault. */
  #writeJson(path, value) {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    renameSync(tmp, path);
  }
}

export function emptyRun() {
  return {
    startedAt: null,
    mode: null,
    rounds: [],
    exposures: [],
    questions: [],
    searchedQueries: [],
    stats: {},
  };
}

/**
 * Reject anything that looks like personal data before it can be written to
 * the shareable workflows file.
 *
 * This runs on every save rather than on a code review, because the failure it
 * prevents — one user's address leaking into another user's workflow cache —
 * is exactly the kind that slips in through a well-meaning "let's remember what
 * we filled in so next time is faster" change.
 */
export function assertNoPii(workflows) {
  const json = JSON.stringify(workflows || {});
  const offenders = [
    { name: 'email address', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
    { name: 'phone number', re: /\b\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/ },
    { name: 'street address', re: /\b\d{1,6}\s+\w+(?:\s+\w+){0,3}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i },
    { name: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  ];
  for (const o of offenders) {
    const m = json.match(o.re);
    if (m) {
      throw new Error(
        `refusing to write workflows.json: it contains what looks like a ${o.name} (${m[0].slice(0, 6)}…). `
        + 'Workflow templates are shareable and must never carry personal data — store the field *shape*, not the value.',
      );
    }
  }
  return true;
}
