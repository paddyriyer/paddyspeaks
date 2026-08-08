/**
 * At-rest encryption for the identity vault (spec item 27).
 *
 * Node's built-in `crypto` only — no dependencies, because a privacy tool
 * pulling a crypto library off npm has an unpleasantly large supply-chain
 * surface for what amounts to four primitives.
 *
 * Design:
 *   - scrypt for key derivation. Memory-hard, in the standard library, and the
 *     right answer for a passphrase typed by a human.
 *   - AES-256-GCM for the payload. Authenticated, so a tampered vault fails
 *     loudly at `decrypt` instead of silently returning garbage.
 *   - A fresh 12-byte IV per encryption. Reusing an IV under GCM is
 *     catastrophic, so it is generated per call and never derived.
 *   - The passphrase is never stored. If the user forgets it, the vault is
 *     gone — which is the correct trade for a file that holds a home address.
 */

import {
  randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual,
  createHash,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const TAG_LEN = 16;

/**
 * scrypt parameters. N=2^15 costs ~100ms and 32MB per derivation on a laptop,
 * which is unnoticeable when unlocking once per session and expensive enough
 * to make offline guessing painful.
 */
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

export function deriveKey(passphrase, salt) {
  if (!passphrase || String(passphrase).length < 8) {
    throw new Error('passphrase must be at least 8 characters');
  }
  return scryptSync(String(passphrase).normalize('NFKC'), salt, KEY_LEN, SCRYPT);
}

export function newSalt() {
  return randomBytes(SALT_LEN);
}

/**
 * Encrypt a JSON-serialisable value.
 *
 * The returned envelope is self-describing so a future version can change
 * parameters without orphaning existing vaults.
 */
export function encrypt(value, key) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    algo: ALGO,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

export function decrypt(envelope, key) {
  if (!envelope || envelope.algo !== ALGO) {
    throw new Error('unrecognised vault format');
  }
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');

  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('vault envelope is malformed');
  }

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    // GCM auth failure and a wrong passphrase are indistinguishable, and
    // should be: saying which one it was is a small oracle.
    throw new Error('could not decrypt the vault — wrong passphrase, or the file has been altered');
  }
}

/** A verifier so we can reject a wrong passphrase without decrypting the vault. */
export function passphraseCheck(key) {
  return createHash('sha256').update(key).update('privacy-agent-check-v1').digest('base64');
}

export function verifyPassphrase(key, expected) {
  const actual = Buffer.from(passphraseCheck(key), 'base64');
  const want = Buffer.from(String(expected || ''), 'base64');
  if (actual.length !== want.length) return false;
  return timingSafeEqual(actual, want);
}

/**
 * A stable, non-reversible id for a value — used where we need to know "have we
 * seen this before" without keeping the value itself. The salt is per-vault, so
 * two vaults never produce comparable hashes.
 */
export function blindIndex(value, salt) {
  return createHash('sha256')
    .update(salt)
    .update(String(value == null ? '' : value).toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

export { randomBytes };
