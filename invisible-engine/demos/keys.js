/* Interactive demo F — Key protection.
 * A TOY, but mathematically real, version of the pattern Apple documents for Find My:
 * the owner holds a private key d and a secret seed; each time window i the seed is
 * hashed forward and gives (u_i, v_i); the tag can compute the window's public key
 *     P_i = P^u_i · g^v_i            (it never holds d)
 * and only the owner can compute the matching private key
 *     d_i = d·u_i + v_i  (mod p − 1),   so g^d_i = P_i.
 * A finder seals a report to P_i with a fresh ephemeral key (Diffie–Hellman, then a
 * hash-based keystream and tag); the owner opens it with d_i. A separate Schnorr
 * signature shows that verifying a signature decrypts nothing.
 *
 * Toy parameters: the group of integers modulo the prime 2^31 − 1 with generator 7.
 * Far too small to be secure, chosen so every number fits on screen. Real systems use
 * elliptic curves (Apple documents NIST P-224) and real ciphers (AES-GCM).
 * The pure model (IEDemoF.model) is tested by invisible-engine/tests/demos.mjs.
 */
(function (root) {
  'use strict';
  var p = 2147483647n, g = 7n, n = p - 1n;

  function modpow(b, e, m) {
    var r = 1n; b %= m; if (b < 0n) b += m;
    while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
    return r;
  }
  function mod(a, m) { var r = a % m; return r < 0n ? r + m : r; }

  // SHA-256 (compact, for strings of UTF-8 bytes) → hex
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) { var out = []; s = unescape(encodeURIComponent(s)); for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }
  function sha256(str) {
    var b = utf8(str), l = b.length * 8;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (var s = 7; s >= 0; s--) b.push(s >= 4 ? 0 : (l >>> (s * 8)) & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    function rotr(x, k) { return (x >>> k) | (x << (32 - k)); }
    for (var off = 0; off < b.length; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = (b[off + 4 * t] << 24) | (b[off + 4 * t + 1] << 16) | (b[off + 4 * t + 2] << 8) | b[off + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], gg = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & gg), t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
        h = gg; gg = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + gg) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }
  function hnum(str, m) { return mod(BigInt('0x' + sha256(str).slice(0, 15)), m); }  // hash → number below m

  // keys --------------------------------------------------------------
  function ownerKeys(d, seed) { return { d: mod(d, n) || 1n, P: modpow(g, mod(d, n) || 1n, p), seed: String(seed) }; }
  function windowSecret(seed, i) { var s = seed; for (var k = 0; k < i; k++) s = sha256('next|' + s); return s; }
  function uv(seed, i) { var s = windowSecret(seed, i); return { u: hnum('u|' + s, n - 1n) + 1n, v: hnum('v|' + s, n) }; }
  function tagPublic(P, seed, i) { var c = uv(seed, i); return mod(modpow(P, c.u, p) * modpow(g, c.v, p), p); }  // no d needed
  function ownerPrivate(d, seed, i) { var c = uv(seed, i); return mod(d * c.u + c.v, n); }
  function lookup(Pi) { return sha256('P|' + Pi.toString()).slice(0, 12); }

  // sealing -----------------------------------------------------------
  function keystream(key, len) { var out = [], c = 0; while (out.length < len) { var hx = sha256(key + '|' + c++); for (var j = 0; j < 64 && out.length < len; j += 2) out.push(parseInt(hx.substr(j, 2), 16)); } return out; }
  function xorBytes(a, ks) { return a.map(function (x, i) { return x ^ ks[i]; }); }
  function toHex(a) { return a.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function fromHex(h) { var o = []; for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function seal(Pi, message, e) {
    e = mod(e, n) || 1n;
    var E = modpow(g, e, p), S = modpow(Pi, e, p), key = sha256('K|' + S.toString());
    var ct = toHex(xorBytes(utf8(message), keystream(key, utf8(message).length)));
    return { E: E, ct: ct, tag: sha256('T|' + key + '|' + ct).slice(0, 16), lookup: lookup(Pi) };
  }
  function open(di, rep) {
    var S = modpow(rep.E, di, p), key = sha256('K|' + S.toString());
    if (sha256('T|' + key + '|' + rep.ct).slice(0, 16) !== rep.tag) return null;  // wrong key or tampered
    var bytes = xorBytes(fromHex(rep.ct), keystream(key, rep.ct.length / 2));
    try { return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes))); } catch (err) { return null; }
  }

  // signatures (Schnorr) ----------------------------------------------
  function sign(x, msg, k) { k = mod(k, n) || 1n; var R = modpow(g, k, p), c = hnum('C|' + R + '|' + msg, n); return { R: R, s: mod(k + c * mod(x, n), n) }; }
  function verify(X, msg, sig) { var c = hnum('C|' + sig.R + '|' + msg, n); return modpow(g, sig.s, p) === mod(sig.R * modpow(X, c, p), p); }

  // sharing, as a CONCEPTUAL abstraction (Apple does not document how shared access is keyed):
  // a recipient is given the window secrets for the windows shared with them; revoking
  // moves the owner to a fresh seed for later windows.
  function shareWindows(seed, from, to) { var out = {}; for (var i = from; i <= to; i++) out[i] = windowSecret(seed, i); return out; }

  var model = { p: p, g: g, modpow: modpow, sha256: sha256, ownerKeys: ownerKeys, windowSecret: windowSecret, tagPublic: tagPublic,
    ownerPrivate: ownerPrivate, lookup: lookup, seal: seal, open: open, sign: sign, verify: verify, shareWindows: shareWindows };
  root.IEDemoF = { model: model };

  if (typeof document === 'undefined') return;

  function rand() {
    var a = new Uint32Array(2);
    (root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 4294967296); }));
    return (BigInt(a[0]) << 20n) ^ BigInt(a[1]);
  }

  function init() {
    var host = document.getElementById('demo-f');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var win = document.getElementById('df-win'), winOut = document.getElementById('df-win-o');
    var msg = document.getElementById('df-msg');
    var out = document.getElementById('df-out'), who = document.getElementById('df-who');
    var state = {};

    function fresh() {
      state.owner = ownerKeys(rand(), 'seed-' + rand().toString(16));
      state.maker = rand(); state.makerPub = modpow(g, state.maker, p);
      state.shared = null; state.revokedAt = null; state.tamper = false; state.newSeed = null;
    }
    function seedFor(i) { return state.revokedAt != null && i >= state.revokedAt ? state.newSeed : state.owner.seed; }

    function render() {
      var i = +win.value; winOut.textContent = 'window ' + i;
      var o = state.owner, seed = seedFor(i);
      var Pi = tagPublic(o.P, seed, i), di = ownerPrivate(o.d, seed, i);
      var rep = seal(Pi, msg.value || 'Platform 4, Central Station, 14:05', rand());
      if (state.tamper) rep = { E: rep.E, ct: (rep.ct[0] === 'f' ? '0' : 'f') + rep.ct.slice(1), tag: rep.tag, lookup: rep.lookup };
      var opened = open(di, rep);
      var fw = 'firmware v2 · build 7731', sig = sign(state.maker, fw, rand());
      var sh = state.shared, recip = sh && sh[i] ? 'can open window ' + i + ' (was given its secret)' : (sh ? 'cannot open window ' + i + (state.revokedAt != null && i >= state.revokedAt ? ' (revoked: new seed)' : ' (not shared)') : 'not shared with anyone');
      out.textContent =
        '1  Tag broadcasts, window ' + i + ':   Pᵢ = ' + Pi + '      (computed from P and the window secret; the tag has no d)\n' +
        '2  Finder seals:   E = ' + rep.E + '   ciphertext = ' + rep.ct.slice(0, 28) + '…   check = ' + rep.tag + '\n' +
        '3  Relay stores under lookup ' + rep.lookup + '   (it holds no private key)\n' +
        '4  Owner computes dᵢ = ' + di + '   and opens it:  ' + (opened === null ? '✗ REJECTED: the check failed (wrong key or tampered)' : '“' + opened + '”') + '\n' +
        '   check: g^dᵢ = ' + modpow(g, di, p) + (modpow(g, di, p) === Pi ? '  = Pᵢ ✓' : '  ≠ Pᵢ') + '\n' +
        '5  Maker signs “' + fw + '”:   R = ' + sig.R + '  s = ' + sig.s + '   verify with the public key → ' + (verify(state.makerPub, fw, sig) ? 'valid' : 'invalid') + '\n' +
        '   Verifying used only the maker’s PUBLIC key and revealed nothing secret: a signature proves origin, it decrypts nothing.\n' +
        '6  Shared recipient: ' + recip + '.';
      var rows = [
        ['Owner’s devices', 'd (master private key), the seed, every dᵢ, and the opened location'],
        ['The tag', 'P (public) and the seed; computes Pᵢ for each window; never d'],
        ['Passing finder', 'the current Pᵢ it overheard; its own location; the ephemeral key it then discards'],
        ['Relay service', 'lookup value, E, ciphertext and check; no private key, so no location'],
        ['Shared recipient', sh ? 'only the window secrets it was given' + (state.revokedAt != null ? ', none after revocation' : '') : '— (not shared)'],
        ['Firmware maker', 'its signing key; nothing that opens a report']
      ];
      who.innerHTML = '';
      rows.forEach(function (r) { var d = document.createElement('div'); var b = document.createElement('b'); b.textContent = r[0]; d.appendChild(b); d.appendChild(document.createTextNode(r[1])); who.appendChild(d); });
    }
    function act(name) {
      var i = +win.value;
      if (name === 'new') fresh();
      if (name === 'tamper') state.tamper = !state.tamper;
      if (name === 'share') { state.shared = shareWindows(state.owner.seed, i, i + 2); state.revokedAt = null; state.newSeed = null; }
      if (name === 'revoke' && state.shared) { state.revokedAt = i + 1; state.newSeed = 'seed-' + rand().toString(16); for (var k in state.shared) if (+k >= state.revokedAt) delete state.shared[k]; }
      var btn = host.querySelector('[data-act="tamper"]'); if (btn) btn.setAttribute('aria-pressed', state.tamper ? 'true' : 'false');
      render();
    }
    fresh();
    win.addEventListener('input', render);
    msg.addEventListener('input', render);
    var btns = host.querySelectorAll('[data-act]');
    for (var b = 0; b < btns.length; b++) btns[b].addEventListener('click', function () { act(this.getAttribute('data-act')); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
