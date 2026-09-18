// Abhirami Anthadhi — interactive application
// ============================================
//
// data.js       verified Tamil, transliteration, legacy English meaning
// enrichment.js interpretation layer, keyed by verse number
//
// The two are joined here. Nothing in this file edits Tamil.

(function () {
  'use strict';

  var verses = ABHIRAMI_ANDHADHI_DATA;
  var E = (typeof ABHIRAMI_ENRICHMENT !== 'undefined') ? ABHIRAMI_ENRICHMENT : {};
  var META = (typeof ABHIRAMI_META !== 'undefined') ? ABHIRAMI_META : {};
  var THEMES = (typeof ABHIRAMI_THEMES !== 'undefined') ? ABHIRAMI_THEMES : [];
  var GROUPS = (typeof ABHIRAMI_CHALLENGES !== 'undefined') ? ABHIRAMI_CHALLENGES : [];
  var FEATURED = (typeof ABHIRAMI_FEATURED !== 'undefined') ? ABHIRAMI_FEATURED : [];

  var byNum = {};
  verses.forEach(function (v) { byNum[v.num] = v; });

  var searchTimer = null;
  var activeFilter = 'all';

  // ---------------------------------------------------------------- utils

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function highlightText(text, query) {
    var escaped = escapeHtml(text);
    if (!query) return escaped;
    var q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return escaped.replace(new RegExp('(' + q + ')', 'gi'), '<mark>$1</mark>');
    } catch (e) { return escaped; }
  }

  function enrich(num) { return E[num] || null; }

  function verseLabel(num) {
    var e = enrich(num);
    if (e && e.label) return e.label;
    if (num === 0) return 'Kaappu';
    if (num === 101) return 'Nool Payan';
    return String(num);
  }

  function verseTitle(num) {
    if (num === 0) return 'Kaappu · Invocation';
    if (num === 101) return 'Nool Payan · Closing verse';
    return 'பாடல் ' + num + ' · Verse ' + num;
  }

  // Small iconographic set. Line art, drawn once, reused by reference.
  var ICONS = {
    lotus:     '<path d="M12 21c-5 0-9-3.2-9-6.4 0-.9.6-1.4 1.4-1.1 1 .4 2 1 2.9 1.8-.6-1.7-.8-3.5-.5-5.2.2-.9.9-1.2 1.6-.7.9.7 1.7 1.6 2.3 2.6.3-1.9 1-3.7 2.1-5.2.4-.6 1.1-.6 1.5 0 1.1 1.5 1.8 3.3 2.1 5.2.6-1 1.4-1.9 2.3-2.6.7-.5 1.4-.2 1.6.7.3 1.7.1 3.5-.5 5.2.9-.8 1.9-1.4 2.9-1.8.8-.3 1.4.2 1.4 1.1C21 17.8 17 21 12 21z"/>',
    sun:       '<circle cx="12" cy="13" r="4"/><path d="M12 5V2M5.6 7.6 3.5 5.5M18.4 7.6l2.1-2.1M4 13H1M23 13h-3M3 20h18"/>',
    gem:       '<path d="M7 3h10l4 6-9 12L3 9z"/><path d="M3 9h18M7 3l2 6 3 12 3-12 2-6M9 9h6"/>',
    bow:       '<path d="M4 20C10 18 18 10 20 4"/><path d="M20 4c-4 .5-9 3-12.5 6.5S2.5 18 2 22"/><path d="M4 20h4M4 20v-4"/>',
    flower:    '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8c0-2.6-.9-4.8-2.2-4.8S7.6 7.2 7.6 9.8M12 9.8c0-2.6.9-4.8 2.2-4.8s2.2 2.2 2.2 4.8M9.8 12c-2.6 0-4.8.9-4.8 2.2s2.2 2.2 4.8 2.2M14.2 12c2.6 0 4.8.9 4.8 2.2s-2.2 2.2-4.8 2.2M12 14.2c0 2.6-.5 4.8-1.2 4.8"/>',
    pasa:      '<path d="M12 4c3.9 0 7 2.2 7 5s-3.1 5-7 5-7-2.2-7-5 3.1-5 7-5z"/><path d="M12 14v6M9.5 20h5"/>',
    light:     '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    moon:      '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    lotusfeet: '<path d="M8 21c-1.7 0-3-1.3-3-3 0-2 1-3 1-5.5S4.8 8 6.5 6.5 10 6 10 8.5 8.5 13 9.5 15s2 2 2 3.5-1.5 2.5-3.5 2.5z"/><circle cx="15.5" cy="6" r="1"/><circle cx="18" cy="8" r="1"/><circle cx="19" cy="11" r="1"/>',
    trident:   '<path d="M12 22V6M5 10V4l3 4V4M19 10V4l-3 4V4M5 10c0 3.9 3.1 6 7 6s7-2.1 7-6"/>',
    mantra:    '<path d="M7 5c2.2 0 3.4 1.4 3.4 3S9 11 7.4 11 5 9.8 5 8.2M10.4 8c2.5 0 3.3 1.8 3.3 3.6S12.2 19 8.6 19C5.4 19 3 16.4 3 12.5 3 7.8 6.6 4 11.4 4"/><circle cx="18" cy="6" r="1.2"/><path d="M15.5 10h5"/>'
  };

  function icon(name, cls) {
    var d = ICONS[name] || ICONS.lotus;
    return '<svg class="' + (cls || 'layer-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      d + '</svg>';
  }

  // ------------------------------------------------------- card fragments

  function chipRow(e) {
    var html = '<div class="chip-row">';
    html += '<span class="chip chip-text">Abhirami Bhattar — Text</span>';
    if (e) {
      if (e.association && e.association.basis) html += '<span class="chip chip-tradition">Traditional Association</span>';
      if (e.lalitha && e.lalitha.length) html += '<span class="chip chip-lalitha">Lalitha Sahasranamam Parallel</span>';
      if (e.sriVidya) html += '<span class="chip chip-srividya">Śrī Vidyā Interpretation</span>';
      if (e.lesson) html += '<span class="chip chip-modern">Modern Reflection</span>';
    } else {
      html += '<span class="chip chip-review">Working translation — under review</span>';
    }
    html += '</div>';
    return html;
  }

  function wordTable(e, query) {
    var html = '<div class="word-table-wrap"><table class="word-table">';
    html += '<thead><tr><th>Tamil</th><th>Transliteration</th><th>English</th></tr></thead><tbody>';
    e.words.forEach(function (w) {
      html += '<tr class="' + (w.lemma ? 'is-lemma' : '') + '">';
      html += '<td class="wt-tamil">' + highlightText(w.tamil, query) +
        (w.lemma ? '<span class="lemma-flag">word note</span>' : '') + '</td>';
      html += '<td class="wt-translit">' + highlightText(w.translit, query) + '</td>';
      html += '<td class="wt-meaning">';
      if (w.meanings.length > 1) {
        html += '<ol>';
        w.meanings.forEach(function (m) { html += '<li>' + highlightText(m, query) + '</li>'; });
        html += '</ol>';
      } else {
        html += highlightText(w.meanings[0], query);
      }
      if (w.note) html += '<span class="wt-note">' + highlightText(w.note, query) + '</span>';
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="confidence-flag">The split above follows sense, not spacing: Tamil compounds, ' +
      'sandhi and poetic contractions are opened out so each element can be read on its own.</p>';
    return html;
  }

  function accordion(title, body, extraClass) {
    return '<details class="layer-accordion ' + (extraClass || '') + '"><summary>' +
      escapeHtml(title) + '</summary><div class="accordion-body">' + body + '</div></details>';
  }

  function layer(title, iconName, paragraphs, query) {
    var html = '<div class="layer"><div class="layer-title">' + icon(iconName) + escapeHtml(title) + '</div>';
    (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).forEach(function (p) {
      if (p) html += '<p>' + highlightText(p, query) + '</p>';
    });
    return html + '</div>';
  }

  function lalithaBlock(e, query) {
    var html = '<div class="lalitha-list">';
    e.lalitha.forEach(function (l) {
      html += '<div class="lalitha-item">';
      html += '<div class="lalitha-name"><span class="lalitha-num">' + l.num + '</span>';
      html += '<span class="lalitha-iast">' + highlightText(l.iast, query) + '</span></div>';
      html += '<div class="lalitha-gloss">' + highlightText(l.meaning, query) + '</div>';
      html += '<div class="lalitha-why">' + highlightText(l.why, query) + '</div>';
      html += '<a class="lalitha-link" href="/lalitha-sahasranama/#name-' + l.num + '">' +
        'Open name ' + l.num + ' in the Lalitha Sahasranamam &rarr;</a>';
      html += '</div>';
    });
    return html + '</div>';
  }

  function associationBox(e, query) {
    if (!e.association) return '';
    var a = e.association;
    var html = '<div class="association-box">';
    html += '<span class="association-kicker">Traditional Devotional Association</span>';
    html += '<span class="association-label">' + highlightText(a.label, query) + '</span>';
    if (a.note) {
      html += '<p class="association-note">' + highlightText(a.note, query) + '</p>';
    } else if (a.basis === 'text') {
      html += '<p class="association-note">Supported by the verse’s own words. See <em>Why This Verse?</em> below.</p>';
    } else {
      html += '<p class="association-note">Recorded in later devotional practice; a direct textual basis is not explicit.</p>';
    }
    html += '</div>';
    return html;
  }

  // ------------------------------------------------------------ the card

  function buildVerseCard(verse, opts) {
    opts = opts || {};
    var num = verse.num;
    var e = enrich(num);
    var query = opts.query || '';
    var idPrefix = opts.idPrefix || 'verse';
    var cardId = idPrefix + '-' + num;

    var preview = verse.tamil.split('\n')[0];
    if (preview.length > 58) preview = preview.substring(0, 58) + '…';

    var cls = ['verse-card'];
    cls.push(num === 0 ? 'kaappu-verse' : (num <= 50 ? 'first-half-verse' : 'second-half-verse'));
    if (e) cls.push('interpreted');
    if (opts.expanded) cls.push('expanded');

    var html = '<div class="' + cls.join(' ') + '" id="' + cardId + '" data-num="' + num + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + escapeHtml(verseLabel(num)) + '</span>';
    html += '<span class="verse-text-preview">' + highlightText(preview, query) + '</span>';
    if (e) html += '<span class="verse-theme">' + escapeHtml(e.theme) + '</span>';
    else if (num === 0) html += '<span class="verse-section-tag">Invocation</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body — Tamil is never behind an accordion
    html += '<div class="verse-body">';
    html += '<div class="tamil-block">' + highlightText(verse.tamil, query) + '</div>';
    html += '<div class="transliteration-block">' + highlightText(verse.transliteration, query) + '</div>';
    html += chipRow(e);

    if (e) {
      html += '<div class="meaning-block"><div class="meaning-label">What the Verse Says</div>';
      html += '<div class="meaning-text">' + highlightText(e.english, query) + '</div></div>';
      html += associationBox(e, query);

      html += accordion('Word by Word', wordTable(e, query));

      html += accordion('Why This Verse?',
        layer('The textual basis', 'light', e.textualBasis, query));

      var deeper = layer('① Devotional Layer', 'lotus', e.devotional, query) +
                   layer('② Inner / Psychological Layer', 'moon', e.inner, query);
      if (e.sriVidya) deeper += layer('③ Śrī Vidyā / Śākta Layer', 'trident', e.sriVidya, query);
      deeper += layer('④ The Human Lesson', 'sun', e.lesson, query);
      html += accordion('Beneath the Poetry', deeper);

      if (e.lalitha && e.lalitha.length) {
        html += accordion('Lalitha Connection', lalithaBlock(e, query));
      }

      var apply = '<div class="layer"><div class="layer-title">' + icon('lotusfeet') +
        'Carry This Verse Into Life</div><div class="apply-list">';
      e.apply.forEach(function (a) {
        apply += '<div class="apply-item"><span class="apply-when">' + highlightText(a.when, query) +
          '</span><span class="apply-what">' + highlightText(a.what, query) + '</span></div>';
      });
      apply += '</div></div>';
      apply += layer('Traditional Pārāyaṇa Association', 'mantra', e.parayana, query);
      html += accordion('Carry This Verse Into Life', apply);

      if (e.sourceNotes && e.sourceNotes.length) {
        html += '<div class="source-notes"><strong>Source notes</strong><ul>';
        e.sourceNotes.forEach(function (n) { html += '<li>' + highlightText(n, query) + '</li>'; });
        html += '</ul></div>';
      }
      html += '<p class="confidence-flag">Interpretation confidence: <b>' + escapeHtml(e.confidence) + '</b>. ' +
        'Tamil text is from the verified source and is not affected by this rating.</p>';

    } else if (verse.meaning) {
      html += '<div class="meaning-block legacy-meaning"><div class="meaning-label">Meaning</div>';
      html += '<div class="meaning-text">' + highlightText(verse.meaning, query) + '</div></div>';
      html += '<p class="confidence-flag">This verse has not yet been worked through with the ' +
        'word-by-word and interpretive layers. Its English rendering is inherited from the ' +
        'original build of this page and is being re-checked against the Tamil line by line.</p>';
    } else {
      html += '<p class="confidence-flag">No English rendering is carried for this verse yet.</p>';
    }

    html += '</div></div>';
    return html;
  }

  window.toggleVerse = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('expanded');
  };

  // --------------------------------------------------------- verse list

  function matchesFilter(num, filter) {
    if (filter === 'all') return true;
    var e = enrich(num);
    return !!(e && e.tags.indexOf(filter) !== -1);
  }

  function renderFilters() {
    var row = document.getElementById('filter-row');
    if (!row) return;
    row.innerHTML = THEMES.map(function (t) {
      var n = (t.key === 'all')
        ? verses.length
        : verses.filter(function (v) { return matchesFilter(v.num, t.key); }).length;
      return '<button class="filter-btn' + (t.key === activeFilter ? ' active' : '') +
        '" data-filter="' + t.key + '"' + (n === 0 ? ' disabled' : '') + '>' +
        escapeHtml(t.label) + ' <span class="cc-count">' + n + '</span></button>';
    }).join('');
    row.querySelectorAll('.filter-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        activeFilter = b.getAttribute('data-filter');
        renderFilters();
        renderVerses();
      });
    });
  }

  function renderVerses() {
    var c = document.getElementById('verses-container');
    if (!c) return;
    var list = verses.filter(function (v) { return matchesFilter(v.num, activeFilter); });
    var note = (activeFilter === 'all')
      ? verses.length + ' verses · ' + Object.keys(E).length + ' interpreted in full so far'
      : list.length + ' verse' + (list.length === 1 ? '' : 's') + ' tagged “' +
        (THEMES.filter(function (t) { return t.key === activeFilter; })[0] || {}).label + '”';
    c.innerHTML = '<p class="filter-count">' + escapeHtml(note) + '</p>' +
      (list.length ? list.map(function (v) { return buildVerseCard(v); }).join('')
                   : '<p class="empty-note">No verses carry that tag yet.</p>');
  }

  function renderFeatured() {
    var c = document.getElementById('featured-container');
    if (!c) return;
    c.innerHTML = FEATURED.map(function (f) {
      return '<button class="featured-card" data-verse="' + f.verse + '">' +
        '<span class="featured-label">' + escapeHtml(f.label) + '</span>' +
        '<span class="featured-line">“' + escapeHtml(f.line) + '”</span>' +
        '<span class="featured-verse">' + escapeHtml(verseTitle(f.verse)) + ' &rarr;</span>' +
        '</button>';
    }).join('');
    c.querySelectorAll('.featured-card').forEach(function (b) {
      b.addEventListener('click', function () { openVerse(Number(b.getAttribute('data-verse'))); });
    });
  }

  // ------------------------------------------- life challenge navigator

  function renderChallenges() {
    var p = document.getElementById('navigator-provenance');
    if (p) {
      p.innerHTML = '<strong>Where these groupings come from.</strong> ' +
        escapeHtml(META.navigatorProvenance || '') +
        ' Only the ' + Object.keys(E).length + ' verses interpreted so far appear here; the ' +
        'remaining verses are grouped as they are worked through.';
    }

    var c = document.getElementById('challenges-container');
    if (!c) return;
    c.innerHTML = GROUPS.map(function (g) {
      var items = g.items.map(function (it) {
        return '<button class="challenge-chip" data-group="' + g.key + '" data-item="' + it.key + '">' +
          escapeHtml(it.label) + '<span class="cc-count">' + it.verses.length + '</span></button>';
      }).join('');
      return '<div class="challenge-group">' +
        '<div class="challenge-group-head">' + icon(g.icon, 'challenge-icon') +
        '<div><div class="challenge-title">' + escapeHtml(g.title) + '</div>' +
        '<div class="challenge-blurb">' + escapeHtml(g.blurb) + '</div></div></div>' +
        '<div class="challenge-items">' + items + '</div></div>';
    }).join('');

    c.querySelectorAll('.challenge-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        c.querySelectorAll('.challenge-chip').forEach(function (o) { o.classList.remove('active'); });
        b.classList.add('active');
        showChallenge(b.getAttribute('data-group'), b.getAttribute('data-item'));
      });
    });
  }

  function showChallenge(groupKey, itemKey) {
    var out = document.getElementById('challenge-results');
    if (!out) return;
    var group = GROUPS.filter(function (g) { return g.key === groupKey; })[0];
    if (!group) return;
    var item = group.items.filter(function (i) { return i.key === itemKey; })[0];
    if (!item) return;

    var html = '<div class="challenge-results-head">';
    html += '<div class="challenge-results-title">' + escapeHtml(item.label) + '</div>';
    html += '<div class="challenge-results-sub">' + escapeHtml(group.title) + ' · ' +
      item.verses.length + ' verse' + (item.verses.length === 1 ? '' : 's') +
      '. A verse may appear under more than one challenge.</div></div>';

    html += item.verses.map(function (n) {
      var v = byNum[n];
      return v ? buildVerseCard(v, { idPrefix: 'challenge', expanded: true }) : '';
    }).join('');

    out.innerHTML = html;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------- garland map

  function renderGarland() {
    var c = document.getElementById('garland-container');
    if (!c) return;
    var nodes = verses.map(function (v) {
      var e = enrich(v.num);
      var cls = ['garland-node'];
      if (e) cls.push('is-interpreted');
      if (v.num === 0) cls.push('is-kaappu');
      if (v.num === 101) cls.push('is-payan');
      var label = v.num === 0 ? 'K' : (v.num === 101 ? 'N' : v.num);
      return '<button class="' + cls.join(' ') + '" data-num="' + v.num + '" ' +
        'title="' + escapeHtml(verseTitle(v.num) + (e ? ' — ' + e.theme : '')) + '" ' +
        'aria-label="' + escapeHtml(verseTitle(v.num)) + '">' + label + '</button>';
    }).join('');

    c.innerHTML =
      '<div class="garland-legend">' +
        '<span><i class="legend-swatch is-interpreted"></i> Interpreted in full</span>' +
        '<span><i class="legend-swatch is-plain"></i> Tamil, transliteration and meaning</span>' +
        '<span>K = Kāppu · N = Nūl Payan</span>' +
      '</div>' +
      '<div class="garland-grid">' + nodes + '</div>' +
      '<p class="garland-loop">↻ The last word of verse 100 returns to verse 1. The garland has no end.</p>';

    // Hover scans; click or keyboard focus pins the selection ring.
    c.querySelectorAll('.garland-node').forEach(function (b) {
      var num = Number(b.getAttribute('data-num'));
      b.addEventListener('mouseenter', function () { showGarlandDetail(num, null); });
      b.addEventListener('click', function () { showGarlandDetail(num, b); });
      b.addEventListener('focus', function () { showGarlandDetail(num, b); });
    });
  }

  function showGarlandDetail(num, btn) {
    var out = document.getElementById('garland-detail');
    if (!out) return;
    var v = byNum[num];
    if (!v) return;
    var e = enrich(num);

    if (btn) {
      document.querySelectorAll('.garland-node.selected').forEach(function (n) { n.classList.remove('selected'); });
      btn.classList.add('selected');
    }

    var opening = v.tamil.split('\n')[0];
    if (opening.length > 46) opening = opening.substring(0, 46) + '…';

    out.innerHTML = '<div class="garland-card">' +
      '<div class="garland-card-num">' + escapeHtml(verseTitle(num)) + '</div>' +
      '<div class="garland-card-tamil">' + escapeHtml(opening) + '</div>' +
      '<div class="garland-card-theme">' + escapeHtml(e ? e.theme : 'Not yet interpreted') + '</div>' +
      '<button class="garland-jump" data-num="' + num + '">Open this verse &rarr;</button>' +
      '</div>';

    var jump = out.querySelector('.garland-jump');
    if (jump) jump.addEventListener('click', function () { openVerse(num); });
  }

  // ------------------------------------------------------------- search

  function searchHaystack(v) {
    var e = enrich(v.num);
    var parts = [String(v.num), v.tamil, v.transliteration, v.meaning || ''];
    if (e) {
      parts.push(e.theme, e.english, e.textualBasis, e.devotional, e.inner,
                 e.sriVidya || '', e.lesson, e.parayana, e.tags.join(' '));
      if (e.association) parts.push(e.association.label, e.association.note || '');
      e.words.forEach(function (w) {
        parts.push(w.tamil, w.translit, w.meanings.join(' '), w.note || '');
      });
      e.lalitha.forEach(function (l) { parts.push(l.iast, l.meaning, l.why, 'lalitha ' + l.num); });
      e.apply.forEach(function (a) { parts.push(a.when, a.what); });
      (e.sourceNotes || []).forEach(function (n) { parts.push(n); });
      // challenge labels this verse answers
      GROUPS.forEach(function (g) {
        g.items.forEach(function (it) {
          if (it.verses.indexOf(v.num) !== -1) parts.push(it.label, g.title);
        });
      });
    }
    return parts.join(' · ').toLowerCase();
  }

  var haystack = null;
  function getHaystack() {
    if (!haystack) {
      haystack = {};
      verses.forEach(function (v) { haystack[v.num] = searchHaystack(v); });
    }
    return haystack;
  }

  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');
    if (!input) return;

    function run() {
      var query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '<p class="empty-note">Type at least two characters. ' +
          'The search covers Tamil, transliteration, every word gloss, the English meanings, ' +
          'the Lalitha names and the life challenges.</p>';
        count.textContent = '';
        return;
      }
      var hay = getHaystack();
      var matches = verses.filter(function (v) {
        return String(v.num) === query || hay[v.num].indexOf(query) !== -1;
      });
      count.textContent = matches.length + ' found';
      results.innerHTML = matches.length
        ? matches.map(function (v) {
            return buildVerseCard(v, { query: input.value.trim(), idPrefix: 'search', expanded: true });
          }).join('')
        : '<p class="empty-note">Nothing found for “' + escapeHtml(query) + '”.</p>';
    }

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(run, 250);
    });
  }

  // --------------------------------------------------------- navigation

  function setView(viewId) {
    var target = document.getElementById(viewId + '-view');
    if (!target) return;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === viewId);
    });
  }

  function openVerse(num) {
    activeFilter = 'all';
    renderFilters();
    renderVerses();
    setView('verses');
    var el = document.getElementById('verse-' + num);
    if (!el) return;
    el.classList.add('expanded');
    // let layout settle before scrolling
    window.requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (history.replaceState) history.replaceState(null, '', '#verse-' + num);
  }
  window.openVerse = openVerse;

  function setupNavigation() {
    document.querySelectorAll('.nav-btn, .mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        setView(view);
        var nav = document.querySelector('.view-nav');
        if (btn.classList.contains('mode-btn') && nav) {
          nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (view === 'search') {
          var i = document.getElementById('search-input');
          if (i) setTimeout(function () { i.focus(); }, 300);
        }
      });
    });
  }

  function applyHash() {
    var m = /^#verse-(\d+)$/.exec(window.location.hash || '');
    if (m) { openVerse(Number(m[1])); return; }
    var v = (window.location.hash || '').replace('#', '');
    if (['verses', 'challenges', 'garland', 'search'].indexOf(v) !== -1) setView(v);
  }

  // ------------------------------------------------- progress & scroll

  function setupProgressBar() {
    var scrollButtons = document.getElementById('scrollButtons');
    var top = document.getElementById('scrollTopBtn');
    var bottom = document.getElementById('scrollBottomBtn');
    var bar = document.getElementById('progressBar');

    if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (bottom) bottom.addEventListener('click', function () {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
      if (scrollButtons) scrollButtons.classList.toggle('visible', y > 300);
    }, { passive: true });
  }

  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var cards = document.querySelectorAll('.view.active .verse-card');
      if (!cards.length) return;
      var expanded = document.querySelectorAll('.view.active .verse-card.expanded');
      var last = expanded.length ? expanded[expanded.length - 1] : null;

      function step(dir) {
        var node = last;
        if (!node) { if (dir > 0) { cards[0].classList.add('expanded'); cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } return; }
        var next = dir > 0 ? node.nextElementSibling : node.previousElementSibling;
        while (next && !next.classList.contains('verse-card')) {
          next = dir > 0 ? next.nextElementSibling : next.previousElementSibling;
        }
        if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'Escape' && last) { last.classList.remove('expanded'); }
    });
  }

  // ---------------------------------------------------------------- PDF

  window.generatePDF = function () {
    var w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to download the PDF.'); return; }

    var h = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">';
    h += '<title>Abhirami Anthadhi</title>';
    h += '<link rel="preconnect" href="https://fonts.googleapis.com">';
    h += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    h += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,600&display=swap" rel="stylesheet">';
    h += '<style>';
    h += '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}';
    h += 'body{font-family:"Source Serif 4",Georgia,serif;color:#2c1810;background:#fff;line-height:1.7}';
    h += '.title-page{text-align:center;padding:120px 40px 80px;page-break-after:always}';
    h += '.title-page h1{font-family:"Playfair Display",Georgia,serif;font-size:34px;color:#7a1f2b;margin-bottom:10px}';
    h += '.title-page .tamil-title{font-family:"Noto Sans Tamil",sans-serif;font-size:24px;color:#7a1f2b;margin-bottom:14px}';
    h += '.title-page .subtitle{font-size:15px;color:#6b5744}';
    h += '.title-page .author{font-size:13px;color:#8a7a68;margin-top:40px;line-height:1.9}';
    h += '.ornament{font-size:22px;color:#b8860b;margin-bottom:26px}';
    h += '.content{max-width:700px;margin:0 auto;padding:20px 30px}';
    h += '.verse-block{page-break-inside:avoid;margin-bottom:26px;padding:15px 17px;border:1px solid #d4c4b0;border-radius:6px;border-left:4px solid #7a1f2b}';
    h += '.verse-block.kaappu,.verse-block.noorpayan{border-left-color:#b8860b}';
    h += '.verse-label{font-family:"Playfair Display",Georgia,serif;font-weight:700;font-size:12px;color:#7a1f2b;margin-bottom:9px;text-transform:uppercase;letter-spacing:.06em}';
    h += '.kaappu .verse-label,.noorpayan .verse-label{color:#b8860b}';
    h += '.theme{font-size:10.5px;color:#b0303f;letter-spacing:.05em;margin-bottom:8px}';
    h += '.tamil-text{font-family:"Noto Sans Tamil",sans-serif;font-size:15px;line-height:2.1;text-align:center;padding:12px;background:#fdf4f3;border-radius:4px;margin-bottom:10px;white-space:pre-line}';
    h += '.translit-text{font-size:11.5px;line-height:1.9;text-align:center;font-style:italic;color:#6b5744;margin-bottom:10px;white-space:pre-line}';
    h += '.meaning-box{font-size:11.5px;line-height:1.7;padding:10px 12px;border-left:3px solid #b8860b;background:#fffdf7}';
    h += '.meaning-label{font-family:"Playfair Display",Georgia,serif;font-size:9.5px;font-weight:600;color:#b8860b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}';
    h += '.words{margin-top:10px;font-size:10.5px;line-height:1.75;color:#4a3628}';
    h += '.words b{font-family:"Noto Sans Tamil",sans-serif;font-size:12px;color:#7a1f2b;font-weight:600}';
    h += '.words i{color:#6b5744}';
    h += '.caveat{font-size:10px;color:#8a7a68;margin-top:8px;font-style:italic}';
    h += '.footer-page{text-align:center;padding:60px 40px;page-break-before:always}';
    h += '.footer-page p{color:#6b5744;font-size:13px;margin-bottom:6px}';
    h += '.footer-page .mantra{font-size:17px;color:#7a1f2b;margin-bottom:14px}';
    h += '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.verse-block{page-break-inside:avoid}.title-page{page-break-after:always}}';
    h += '</style></head><body>';

    h += '<div class="title-page"><div class="ornament">&#x2733;</div>';
    h += '<p class="tamil-title">அபிராமி அந்தாதி</p>';
    h += '<h1>Abhirami Anthadhi</h1>';
    h += '<p class="subtitle">100 Verses of Surrender, Śakti and the Divine Mother</p>';
    h += '<p class="author">Abhirami Bhattar &middot; Thirukkadaiyur<br>' +
         'அபிராமி பட்டர் &middot; ' +
         'திருக்கடையூர்</p>';
    h += '<div class="ornament" style="margin-top:50px">&#x2733;</div></div>';

    h += '<div class="content">';
    verses.forEach(function (v) {
      var e = enrich(v.num);
      var label, cls = '';
      if (v.num === 0) { label = 'Kāppu — Invocation'; cls = 'kaappu'; }
      else if (v.num === 101) { label = 'Nūl Payan — Closing verse'; cls = 'noorpayan'; }
      else { label = 'Verse ' + v.num; }

      h += '<div class="verse-block ' + cls + '">';
      h += '<div class="verse-label">' + label + '</div>';
      if (e) h += '<div class="theme">' + escapeHtml(e.theme) + '</div>';
      h += '<div class="tamil-text">' + escapeHtml(v.tamil) + '</div>';
      h += '<div class="translit-text">' + escapeHtml(v.transliteration) + '</div>';
      if (e) {
        h += '<div class="meaning-box"><div class="meaning-label">What the Verse Says</div>' +
             escapeHtml(e.english) + '</div>';
        h += '<div class="words">';
        h += e.words.map(function (wd) {
          return '<b>' + escapeHtml(wd.tamil) + '</b> &nbsp;<i>' + escapeHtml(wd.translit) +
                 '</i> &nbsp;&mdash;&nbsp; ' + escapeHtml(wd.meanings.join('; '));
        }).join('<br>');
        h += '</div>';
        if (e.association) {
          h += '<div class="caveat">Traditional devotional association: ' +
               escapeHtml(e.association.label) + '. Not a medical or financial claim.</div>';
        }
      } else if (v.meaning) {
        h += '<div class="meaning-box"><div class="meaning-label">Meaning</div>' +
             escapeHtml(v.meaning) + '</div>';
        h += '<div class="caveat">Not yet worked through word by word; this rendering is being re-checked against the Tamil.</div>';
      }
      h += '</div>';
    });
    h += '</div>';

    h += '<div class="footer-page"><div class="ornament">&#x2733;</div>';
    h += '<p class="mantra">அபிராமி துணை &middot; Abhirami Thunai</p>';
    h += '<p>Abhirami Anthadhi — composed by Abhirami Bhattar at Thirukkadaiyur</p>';
    h += '<p style="font-size:11px;color:#999;margin-top:12px">' + escapeHtml(META.textSource || '') + '</p>';
    h += '<p style="font-size:11px;color:#999">A PaddySpeaks creation &middot; paddyspeaks.com</p>';
    h += '</div></body></html>';

    w.document.write(h);
    w.document.close();
    w.onload = function () { setTimeout(function () { w.print(); }, 600); };
  };

  // --------------------------------------------------------------- init

  function init() {
    var sn = document.getElementById('source-note');
    if (sn) sn.textContent = META.textSource || '';

    renderFeatured();
    renderFilters();
    renderVerses();
    renderChallenges();
    renderGarland();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupKeyboardNav();
    applyHash();
    window.addEventListener('hashchange', applyHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
