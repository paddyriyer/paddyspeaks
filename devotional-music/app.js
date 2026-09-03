// Devotional Music — Nama Sankeerthanam
// Interactive application
// =====================================

(function () {
  'use strict';

  /* ── Utilities ──────────────────────────────────────────────── */

  function esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // For fields authored WITH inline markup in data.js (notes, esoteric text).
  // These are our own trusted strings, never user input.
  function trusted(str) {
    return str === null || str === undefined ? '' : String(str);
  }

  function nl2br(str) {
    return esc(str).replace(/\n/g, '<br>');
  }

  function highlight(text, query) {
    var out = esc(text);
    if (!query) return out;
    var safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return out.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
  }

  function el(id) { return document.getElementById(id); }

  /* ── Ragam chip ─────────────────────────────────────────────── */

  function ragaChip(kriti) {
    var conf = kriti.ragaConfidence === 'established'
      ? '<span class="conf conf-ok" title="Consistent across the sources consulted">attested</span>'
      : '<span class="conf conf-vary" title="Sources disagree — see the note">sources differ</span>';
    return '<span class="raga-chip">' + esc(kriti.raga) + '</span>' + conf;
  }

  /* ── Kriti card ─────────────────────────────────────────────── */

  function buildLyricBlock(label, block, cls) {
    if (!block) return '';
    var html = '<div class="lyric-block ' + (cls || '') + '">';
    html += '<div class="lyric-label">' + esc(label) + '</div>';
    if (block.telugu) {
      html += '<div class="telugu-text" lang="te">' + nl2br(block.telugu) + '</div>';
    }
    if (block.translit) {
      html += '<div class="translit-text">' + nl2br(block.translit) + '</div>';
    }
    if (block.meaning) {
      html += '<div class="meaning-text"><span class="meaning-tag">Meaning</span>' + esc(block.meaning) + '</div>';
    }
    if (block.note) {
      html += '<div class="lyric-note">' + trusted(block.note) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildKritiCard(k, open) {
    var html = '<article class="kriti-card" id="kriti-' + esc(k.id) + '">';

    // ── Header ──
    html += '<header class="kriti-head">';
    if (k.navaratna) {
      html += '<span class="navaratna-badge" title="One of the nine Navaratna Keertanas">Navaratna ' + k.navaratna + '</span>';
    }
    html += '<h3 class="kriti-title">' + esc(k.title);
    if (k.altTitle) html += ' <span class="kriti-alt">(also ' + esc(k.altTitle) + ')</span>';
    html += '</h3>';
    html += '<div class="kriti-telugu" lang="te">' + esc(k.telugu) + '</div>';
    html += '<div class="kriti-translit">' + esc(k.translit) + '</div>';
    html += '<p class="kriti-gloss">' + esc(k.gloss) + '</p>';
    html += '</header>';

    // ── Meta strip ──
    html += '<div class="kriti-meta">';
    html += '<div class="meta-item"><span class="meta-key">Composer</span><span class="meta-val">' + esc(COMPOSER.name) + '</span></div>';
    html += '<div class="meta-item"><span class="meta-key">Ragam</span><span class="meta-val">' + ragaChip(k) + '</span></div>';
    html += '<div class="meta-item"><span class="meta-key">Talam</span><span class="meta-val">' + esc(k.tala) + '</span></div>';
    html += '<div class="meta-item"><span class="meta-key">Bhava</span><span class="meta-val">' + esc(k.bhava) + '</span></div>';
    html += '<div class="meta-item"><span class="meta-key">Mudra</span><span class="meta-val">' + esc(COMPOSER.mudra) + '</span></div>';
    html += '</div>';

    if (k.ragaNote) {
      html += '<div class="raga-note"><strong>On the ragam:</strong> ' + trusted(k.ragaNote) + '</div>';
    }

    html += '<p class="kriti-summary">' + esc(k.summary) + '</p>';

    if (k.article) {
      html += '<a class="article-cta" href="' + esc(k.article.href) + '">' +
        '<span class="cta-kicker">Full article</span>' +
        '<span class="cta-label">' + esc(k.article.label) + '</span>' +
        '<span class="cta-arrow">&rarr;</span></a>';
    }

    // ── Toggle ──
    html += '<button class="kriti-toggle" data-target="' + esc(k.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="toggle-label">' + (open ? 'Hide the text' : 'Open the text, meaning & esoterics') + '</span>' +
      '<span class="toggle-caret">&#9662;</span></button>';

    // ── Body ──
    html += '<div class="kriti-body' + (open ? ' open' : '') + '" id="body-' + esc(k.id) + '">';

    // Lyrics
    html += '<div class="body-section">';
    html += '<h4 class="body-heading">The Text <span class="body-heading-te" lang="te">సాహిత్యం</span></h4>';
    html += buildLyricBlock('Pallavi', k.pallavi, 'is-pallavi');
    if (k.anupallavi) {
      html += buildLyricBlock('Anupallavi', k.anupallavi, 'is-anupallavi');
    } else if (k.anupallaviNote) {
      html += '<div class="editorial-note">' + trusted(k.anupallaviNote) + '</div>';
    }
    if (k.charanams && k.charanams.length) {
      k.charanams.forEach(function (c) {
        html += buildLyricBlock('Charanam ' + c.num, c, 'is-charanam');
      });
    }
    if (k.charanamsNote) {
      html += '<div class="editorial-note">' + trusted(k.charanamsNote) + '</div>';
    }
    html += '</div>';

    // Sahityam note
    if (k.sahitya) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">On the Sahityam</h4>';
      html += '<p class="sahitya-text">' + trusted(k.sahitya) + '</p>';
      html += '</div>';
    }

    // Esoteric
    if (k.esoteric && k.esoteric.length) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">Esoteric Reading <span class="body-heading-te" lang="te">అంతరార్థం</span></h4>';
      k.esoteric.forEach(function (e) {
        html += '<div class="eso-card">';
        html += '<h5 class="eso-head">' + esc(e.head) + '</h5>';
        html += '<p class="eso-text">' + trusted(e.text) + '</p>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Sources
    if (k.sources && k.sources.length) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">Sources for this text</h4>';
      html += '<ul class="source-list">';
      k.sources.forEach(function (s) {
        html += '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener nofollow">' + esc(s.label) + '</a></li>';
      });
      html += '</ul>';
      html += '</div>';
    }

    html += '</div>'; // body
    html += '</article>';
    return html;
  }

  /* ── Render: kritis ─────────────────────────────────────────── */

  var currentFilter = 'all';

  function renderKritis() {
    var host = el('kritis-container');
    if (!host) return;

    var list = KRITIS.filter(function (k) {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'navaratna') return !!k.navaratna;
      if (currentFilter === 'featured') return !!k.featured;
      return true;
    });

    if (currentFilter === 'navaratna') {
      list.sort(function (a, b) { return a.navaratna - b.navaratna; });
    }

    var html = '';
    list.forEach(function (k) {
      html += buildKritiCard(k, k.featured && currentFilter !== 'all' ? false : false);
    });
    host.innerHTML = html;

    var count = el('kriti-count');
    if (count) {
      count.textContent = list.length + (list.length === 1 ? ' keertana' : ' keertanas');
    }
  }

  /* ── Render: ragams ────────────────────────────────────────── */

  function renderRagas() {
    var host = el('ragas-container');
    if (!host) return;

    // Which kritis use each ragam
    var usage = {};
    KRITIS.forEach(function (k) {
      if (!usage[k.raga]) usage[k.raga] = [];
      usage[k.raga].push(k);
    });

    var names = Object.keys(RAGAS);
    var html = '';
    names.forEach(function (name) {
      var r = RAGAS[name];
      html += '<div class="raga-card">';
      html += '<div class="raga-card-head">';
      html += '<h3 class="raga-name">' + esc(name) + '</h3>';
      html += '<span class="raga-name-te" lang="te">' + esc(r.telugu) + '</span>';
      html += '</div>';
      html += '<div class="raga-class">' + esc(r.melakarta) + ' &middot; ' + esc(r.type) + '</div>';
      html += '<div class="scale-grid">';
      html += '<div class="scale-row"><span class="scale-key">Arohana</span><span class="scale-val">' + esc(r.arohana) + '</span></div>';
      html += '<div class="scale-row"><span class="scale-key">Avarohana</span><span class="scale-val">' + esc(r.avarohana) + '</span></div>';
      html += '</div>';
      html += '<div class="raga-bhava"><span class="meta-key">Bhava</span> ' + esc(r.bhava) + '</div>';
      html += '<p class="raga-note-text">' + trusted(r.note) + '</p>';

      if (usage[name]) {
        html += '<div class="raga-usage"><span class="meta-key">In this collection</span><div class="raga-usage-links">';
        usage[name].forEach(function (k) {
          html += '<a href="#kriti-' + esc(k.id) + '" class="usage-link" data-jump="' + esc(k.id) + '">' + esc(k.title) + '</a>';
        });
        html += '</div></div>';
      }
      html += '</div>';
    });
    host.innerHTML = html;
  }

  /* ── Render: composer story ────────────────────────────────── */

  function renderStory() {
    var host = el('story-container');
    if (!host) return;
    var html = '';

    html += '<div class="story-facts">';
    [
      ['Born as', COMPOSER.birthName],
      ['Known as', COMPOSER.name + ' (' + COMPOSER.telugu + ')'],
      ['Dates', COMPOSER.dates],
      ['Birthplace', COMPOSER.birthplace],
      ['Language', COMPOSER.language],
      ['Deity', COMPOSER.deity],
      ['Mudra (signature)', COMPOSER.mudra]
    ].forEach(function (row) {
      html += '<div class="fact-row"><span class="fact-key">' + esc(row[0]) + '</span>' +
        '<span class="fact-val">' + esc(row[1]) + '</span></div>';
    });
    html += '</div>';

    html += '<div class="name-note"><strong>A note on the name.</strong> ' + trusted(COMPOSER.nameNote) + '</div>';

    html += '<div class="story-chapters">';
    COMPOSER.story.forEach(function (s, i) {
      html += '<div class="chapter">';
      html += '<div class="chapter-num">' + (i + 1) + '</div>';
      html += '<div class="chapter-body"><h4>' + esc(s.heading) + '</h4><p>' + esc(s.text) + '</p></div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<h4 class="sub-heading">The works</h4><div class="works-grid">';
    COMPOSER.works.forEach(function (w) {
      html += '<div class="work-card"><h5>' + esc(w.title) + '</h5><p>' + esc(w.note) + '</p></div>';
    });
    html += '</div>';

    return host.innerHTML = html;
  }

  /* ── Render: tradition ─────────────────────────────────────── */

  function renderTradition() {
    var host = el('tradition-container');
    if (!host) return;
    var html = '';

    html += '<p class="tradition-intro">' + trusted(TRADITION.intro) + '</p>';

    TRADITION.points.forEach(function (p) {
      html += '<div class="trad-card"><h4>' + esc(p.head) + '</h4><p>' + trusted(p.text) + '</p></div>';
    });

    // Misattributed
    html += '<h4 class="sub-heading">Commonly misattributed</h4>';
    html += '<p class="sub-lead">Songs that turn up on Ramadasu playlists, CD sleeves and bhajan sheets ' +
      'but belong to other composers. This is the most frequent error in popular collections — and one ' +
      'this page had to correct in its own drafting.</p>';
    html += '<div class="misattr-grid">';
    MISATTRIBUTED.forEach(function (m) {
      html += '<div class="misattr-card">';
      html += '<h5>' + esc(m.title) + ' <span lang="te" class="misattr-te">' + esc(m.telugu) + '</span></h5>';
      html += '<div class="misattr-actual"><span class="meta-key">Actually by</span> ' + esc(m.actualComposer) + '</div>';
      html += '<div class="misattr-raga"><span class="meta-key">Ragam</span> ' + esc(m.raga) + '</div>';
      html += '<p>' + esc(m.note) + '</p>';
      html += '</div>';
    });
    html += '</div>';

    // Glossary
    html += '<h4 class="sub-heading">Glossary</h4>';
    html += '<div class="glossary-grid">';
    TRADITION.glossary.forEach(function (g) {
      html += '<div class="gloss-card">';
      html += '<div class="gloss-term">' + esc(g.term) + ' <span lang="te" class="gloss-te">' + esc(g.telugu) + '</span></div>';
      html += '<div class="gloss-def">' + esc(g.def) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    host.innerHTML = html;
  }

  /* ── Search ────────────────────────────────────────────────── */

  function runSearch(q) {
    var host = el('search-results');
    var countHost = el('search-count');
    if (!host) return;

    q = (q || '').trim();
    if (!q) {
      host.innerHTML = '<p class="search-hint">Search across titles, Telugu text, transliteration, ' +
        'meanings, ragams and the esoteric commentary.</p>';
      if (countHost) countHost.textContent = '';
      return;
    }

    var lower = q.toLowerCase();
    var hits = [];

    KRITIS.forEach(function (k) {
      var fields = [];
      fields.push({ where: 'Title', text: k.title });
      if (k.altTitle) fields.push({ where: 'Title', text: k.altTitle });
      fields.push({ where: 'Telugu', text: k.telugu });
      fields.push({ where: 'Transliteration', text: k.translit });
      fields.push({ where: 'Gloss', text: k.gloss });
      fields.push({ where: 'Ragam', text: k.raga });
      fields.push({ where: 'Talam', text: k.tala });
      fields.push({ where: 'Bhava', text: k.bhava });
      fields.push({ where: 'Summary', text: k.summary });

      [k.pallavi, k.anupallavi].forEach(function (b, i) {
        if (!b) return;
        var label = i === 0 ? 'Pallavi' : 'Anupallavi';
        if (b.telugu) fields.push({ where: label + ' (Telugu)', text: b.telugu });
        if (b.translit) fields.push({ where: label, text: b.translit });
        if (b.meaning) fields.push({ where: label + ' meaning', text: b.meaning });
      });

      (k.charanams || []).forEach(function (c) {
        if (c.telugu) fields.push({ where: 'Charanam ' + c.num + ' (Telugu)', text: c.telugu });
        if (c.translit) fields.push({ where: 'Charanam ' + c.num, text: c.translit });
        if (c.meaning) fields.push({ where: 'Charanam ' + c.num + ' meaning', text: c.meaning });
      });

      (k.esoteric || []).forEach(function (e) {
        fields.push({ where: 'Esoteric — ' + e.head, text: e.text.replace(/<[^>]+>/g, '') });
      });

      var matches = fields.filter(function (f) {
        return f.text && String(f.text).toLowerCase().indexOf(lower) !== -1;
      });

      if (matches.length) hits.push({ kriti: k, matches: matches.slice(0, 4) });
    });

    if (countHost) {
      countHost.textContent = hits.length ? hits.length + ' of ' + KRITIS.length + ' keertanas' : 'no matches';
    }

    if (!hits.length) {
      host.innerHTML = '<p class="search-hint">Nothing matched &ldquo;' + esc(q) + '&rdquo;.</p>';
      return;
    }

    var html = '';
    hits.forEach(function (h) {
      html += '<div class="search-hit">';
      html += '<h4><a href="#kriti-' + esc(h.kriti.id) + '" data-jump="' + esc(h.kriti.id) + '">' +
        highlight(h.kriti.title, q) + '</a> ' +
        '<span class="hit-raga">' + highlight(h.kriti.raga, q) + '</span></h4>';
      h.matches.forEach(function (m) {
        html += '<div class="hit-line"><span class="hit-where">' + esc(m.where) + '</span>' +
          '<span class="hit-text' + (/Telugu/.test(m.where) ? ' telugu-inline' : '') + '">' +
          highlight(String(m.text).replace(/\n/g, ' / '), q) + '</span></div>';
      });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  /* ── View switching ────────────────────────────────────────── */

  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === name + '-view');
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === name);
    });
    if (name === 'search') {
      var input = el('search-input');
      if (input) setTimeout(function () { input.focus(); }, 60);
    }
  }

  /* ── Jump to a kriti from anywhere ─────────────────────────── */

  function jumpToKriti(id) {
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
    });
    renderKritis();
    showView('kritis');

    setTimeout(function () {
      var card = el('kriti-' + id);
      if (!card) return;
      var body = el('body-' + id);
      var btn = card.querySelector('.kriti-toggle');
      if (body && !body.classList.contains('open')) {
        body.classList.add('open');
        if (btn) {
          btn.setAttribute('aria-expanded', 'true');
          btn.querySelector('.toggle-label').textContent = 'Hide the text';
        }
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('flash');
      setTimeout(function () { card.classList.remove('flash'); }, 1600);
    }, 60);
  }

  /* ── Wiring ────────────────────────────────────────────────── */

  function init() {
    renderKritis();
    renderRagas();
    renderStory();
    renderTradition();
    runSearch('');

    // View nav
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showView(btn.getAttribute('data-view'));
      });
    });

    // Filters
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = btn.getAttribute('data-filter');
        document.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderKritis();
      });
    });

    // Delegated: toggles, jumps
    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('.kriti-toggle');
      if (toggle) {
        var id = toggle.getAttribute('data-target');
        var body = el('body-' + id);
        if (body) {
          var isOpen = body.classList.toggle('open');
          toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          toggle.querySelector('.toggle-label').textContent =
            isOpen ? 'Hide the text' : 'Open the text, meaning & esoterics';
        }
        return;
      }

      var jump = e.target.closest('[data-jump]');
      if (jump) {
        e.preventDefault();
        jumpToKriti(jump.getAttribute('data-jump'));
        return;
      }

      // In-page esoteric cross-links (#kriti-xxx) written in data.js prose
      var anchor = e.target.closest('a[href^="#kriti-"]');
      if (anchor) {
        e.preventDefault();
        jumpToKriti(anchor.getAttribute('href').replace('#kriti-', ''));
      }
    });

    // Search
    var input = el('search-input');
    if (input) {
      input.addEventListener('input', function () { runSearch(input.value); });
    }

    // Expand / collapse all
    var expandAll = el('expand-all');
    if (expandAll) {
      expandAll.addEventListener('click', function () {
        document.querySelectorAll('.kriti-body').forEach(function (b) { b.classList.add('open'); });
        document.querySelectorAll('.kriti-toggle').forEach(function (t) {
          t.setAttribute('aria-expanded', 'true');
          t.querySelector('.toggle-label').textContent = 'Hide the text';
        });
      });
    }
    var collapseAll = el('collapse-all');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        document.querySelectorAll('.kriti-body').forEach(function (b) { b.classList.remove('open'); });
        document.querySelectorAll('.kriti-toggle').forEach(function (t) {
          t.setAttribute('aria-expanded', 'false');
          t.querySelector('.toggle-label').textContent = 'Open the text, meaning & esoterics';
        });
      });
    }

    // Reading progress
    var bar = el('progressBar');
    if (bar) {
      window.addEventListener('scroll', function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
      }, { passive: true });
    }

    // Scroll buttons
    var topBtn = el('scrollTopBtn');
    var botBtn = el('scrollBottomBtn');
    if (topBtn) topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    if (botBtn) botBtn.addEventListener('click', function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });

    // Deep link: #kriti-<id> on load
    if (location.hash.indexOf('#kriti-') === 0) {
      jumpToKriti(location.hash.replace('#kriti-', ''));
    }

    // ...and on hash change, since a hash-only navigation (address bar, back/forward,
    // or an inbound link while already on this page) does not re-run init.
    window.addEventListener('hashchange', function () {
      if (location.hash.indexOf('#kriti-') === 0) {
        jumpToKriti(location.hash.replace('#kriti-', ''));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
