/* Health Intelligence Lab — the private worker. Everything the person imports lives
   here, in this worker's memory, and nowhere else. It never makes a network request:
   the import spec arrives in the init message (loaded with the page, before any file
   is chosen), and the engine has no network code (tests/engine.mjs). Terminating the
   worker deletes everything. */
/* global HLEngine */
importScripts('../engine.js');
var session = null, spec = null, ctl = null;
self.onmessage = async function (ev) {
  var m = ev.data;
  try {
    if (m.type === 'init') { spec = m.spec; session = new HLEngine.Session(spec); self.postMessage({ type: 'ready' }); return; }
    if (m.type === 'cancel') { if (ctl) ctl.abort(); return; }
    if (m.type === 'reset') { session = new HLEngine.Session(spec); self.postMessage({ type: 'reset' }); return; }
    if (m.type === 'import') {
      ctl = new AbortController();
      var done = [];
      for (var i = 0; i < m.files.length; i++) {
        var f = m.files[i];
        var r = await HLEngine.importBlob(session, f.blob, f.name, {
          allowReal: !!m.allowReal, signal: ctl.signal,
          onProgress: function (name, n, total) { self.postMessage({ type: 'progress', name: name, chars: n, total: total }); }
        });
        done.push(r);
        self.postMessage({ type: 'file', result: r });
      }
      ctl = null;
      self.postMessage({ type: 'imported', files: done, preview: session.preview() });
      return;
    }
    if (m.type === 'analyze') {
      self.postMessage({ type: 'result', result: session.analyze(m.asOf, { codes: m.codes, from: m.from }) });
    }
  } catch (e) {
    ctl = null;
    if (m.type === 'import') session = new HLEngine.Session(spec);   // a failed or cancelled import leaves nothing half-loaded
    self.postMessage({ type: 'error', message: e && e.message === 'cancelled' ? 'Import cancelled. Nothing was kept.' : String(e && e.message || e) });
  }
};
