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

  /* ── Evidence & provenance labelling ────────────────────────── */

  var EVIDENCE_KEY =
    '<strong>How to read these labels.</strong> ' +
    '<span class="ev ev-textual">textual</span> — supported directly by the sahityam. ' +
    '<span class="ev ev-trad">traditional</span> — supported by established theological or ' +
    'commentarial tradition. ' +
    '<span class="ev ev-interp">interpretive</span> — a contemplative PaddySpeaks reading, offered as ' +
    'what the song opens into rather than as what Ramadasu is known to have intended.';

  var PROVENANCE_KEY =
    '<strong>Where each observation comes from.</strong> ' +
    '<span class="pv pv-text">in the text</span> — true of any performance. ' +
    '<span class="pv pv-trad">performance tradition</span> — common practice, not the composer\'s mark. ' +
    '<span class="pv pv-rend">this rendition</span> — depends on the specific recording named. ' +
    'Ramadasu left sahityam, not notation: no musical treatment below is presented as his own.';

  function evidenceBadge(kind) {
    if (!kind) return '';
    var map = {
      TEXTUAL: ['ev-textual', 'textual', 'Supported directly by the sahityam'],
      TRADITIONAL: ['ev-trad', 'traditional', 'Supported by established theological or commentarial tradition'],
      INTERPRETIVE: ['ev-interp', 'interpretive', 'A contemplative PaddySpeaks reading, not a claim about intent']
    };
    var m = map[kind];
    if (!m) return '';
    return ' <span class="ev ' + m[0] + '" title="' + esc(m[2]) + '">' + m[1] + '</span>';
  }

  function provenanceBadge(kind) {
    var map = {
      text: ['pv-text', 'in the text', 'Present in the sahityam — true of any performance'],
      tradition: ['pv-trad', 'performance tradition', 'Common performance practice, not the composer\'s own mark'],
      rendition: ['pv-rend', 'this rendition', 'Depends on the specific recording named']
    };
    var m = map[kind];
    if (!m) return '';
    return ' <span class="pv ' + m[0] + '" title="' + esc(m[2]) + '">' + m[1] + '</span>';
  }

  /* ── Listening cards ────────────────────────────────────────── */

  function listeningCards(k) {
    var html = '<div class="listen-wrap">';
    (k.listening || []).forEach(function (l) {
      var isSearch = l.kind === 'search';
      html += '<div class="listen-card' + (isSearch ? ' is-search' : '') + '">';
      html += '<div class="listen-main">';
      html += '<div class="listen-tradition">' + esc(l.tradition) + '</div>';
      html += '<div class="listen-performer">' + esc(l.performer) + '</div>';
      html += '<div class="listen-meta">' +
        '<span><span class="meta-key">Ragam</span> ' + esc(l.raga) + '</span>' +
        '<span><span class="meta-key">Talam</span> ' + esc(l.tala) + '</span></div>';
      html += '<p class="listen-why"><span class="meta-key">Why listen to this version</span>' +
        trusted(l.why) + '</p>';
      html += '</div>';
      html += '<a class="listen-btn" href="' + esc(l.url) + '" target="_blank" rel="noopener nofollow">' +
        (isSearch ? '&#9654; Find it on YouTube' : '&#9654; Watch on YouTube') + '</a>';
      html += '</div>';
    });
    html += '<p class="listen-caveat">' + LISTEN_CAVEAT + '</p>';
    html += '</div>';
    return html;
  }

  var LISTEN_CAVEAT =
    '<strong>About these links.</strong> YouTube was not reachable from the environment this page was ' +
    'written in, so no recording below has been played or checked for liveness. A ' +
    '<em>Watch</em> link points at a video whose indexed title matches this composition (and, where ' +
    'stated, the performer); a <em>Find it</em> link runs a YouTube search instead, which cannot rot ' +
    'and cannot point at the wrong thing. The ragam given beside each entry describes the rendition ' +
    'named, not the composition in general — for songs sung in more than one ragam, check which one you ' +
    'are hearing before deciding what the song means.';

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

    if (k.beforePlay) {
      html += '<div class="before-play">' +
        '<span class="bp-label">Before you press play</span>' +
        '<p>' + trusted(k.beforePlay) + '</p></div>';
    }

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
        html += '<h5 class="eso-head">' + esc(e.head) + evidenceBadge(e.evidence) + '</h5>';
        html += '<p class="eso-text">' + trusted(e.text) + '</p>';
        html += '</div>';
      });
      html += '<p class="eso-key">' + EVIDENCE_KEY + '</p>';
      html += '</div>';
    }

    // The word that holds the song
    if (k.keyWord) {
      var w = k.keyWord;
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">The Word That Holds the Song</h4>';
      html += '<div class="keyword-card">';
      html += '<div class="kw-head"><span class="kw-te" lang="te">' + esc(w.telugu) + '</span>' +
        '<span class="kw-word">' + esc(w.word) + '</span>' +
        '<span class="kw-tr">' + esc(w.translit) + '</span></div>';
      [['Literal', w.literal], ['Colloquial shade', w.colloquial],
       ['Spiritual sense', w.spiritual], ['Why this word', w.why]].forEach(function (row) {
        html += '<div class="kw-row"><span class="kw-key">' + esc(row[0]) + '</span>' +
          '<span class="kw-val">' + trusted(row[1]) + '</span></div>';
      });
      html += '</div></div>';
    }

    // Listen for this
    if (k.cues && k.cues.length) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">Listen For This</h4>';
      html += '<p class="cue-lead">Where the music and the meaning meet. Each cue names where the ' +
        'observation comes from, so a later performance practice is never mistaken for Ramadasu\'s own mark.</p>';
      k.cues.forEach(function (c, i) {
        html += '<div class="cue-row">';
        html += '<span class="cue-num">' + (i + 1) + '</span>';
        html += '<div class="cue-body">';
        html += '<h5>' + trusted(c.mark) + provenanceBadge(c.provenance) + '</h5>';
        html += '<p>' + trusted(c.text) + '</p>';
        html += '</div></div>';
      });
      html += '<p class="eso-key">' + PROVENANCE_KEY + '</p>';
      html += '</div>';
    }

    // Listen to the keertana
    if (k.listening && k.listening.length) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">&#127911; Listen to the Keertana</h4>';
      html += listeningCards(k);
      html += '</div>';
    }

    // From Ramadasu's prison to our lives
    if (k.modern) {
      html += '<div class="body-section">';
      html += '<h4 class="body-heading">From Ramadasu\'s Prison to Our Lives</h4>';
      html += '<div class="modern-card"><p>' + trusted(k.modern) + '</p></div>';
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

      if (r.prayogas) {
        html += '<div class="raga-grammar">';
        html += '<div class="rg-row"><span class="meta-key">Characteristic prayogas</span>' +
          '<span class="rg-val">' + r.prayogas.map(function (p) {
            return '<span class="prayoga">' + esc(p) + '</span>';
          }).join('') + '</span></div>';
        html += '<div class="rg-row"><span class="meta-key">Jiva / nyasa swaras</span>' +
          '<span class="rg-val">' + trusted(r.jiva) + '</span></div>';
        html += '<div class="rg-row"><span class="meta-key">Gamaka character</span>' +
          '<span class="rg-val">' + trusted(r.gamaka) + '</span></div>';
        html += '<div class="rg-row"><span class="meta-key">Told apart from</span>' +
          '<span class="rg-val">' + trusted(r.distinguish) + '</span></div>';
        html += '<div class="rg-row"><span class="meta-key">With this sahityam</span>' +
          '<span class="rg-val">' + trusted(r.withText) + '</span></div>';
        html += '</div>';
      }

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

    html += buildHallsAndSurvival();

    host.innerHTML = html;
  }

  /* ── Listening Room ────────────────────────────────────────── */

  function renderListeningRoom() {
    var host = el('listen-container');
    if (!host) return;
    var html = '';

    // Reader's journey
    html += '<div class="journey">';
    COLLECTION.journey.forEach(function (j, i) {
      html += '<div class="journey-step' + (i === COLLECTION.journey.length - 1 ? ' is-last' : '') + '">' +
        '<span class="jr-te" lang="te">' + esc(j.te) + '</span>' +
        '<span class="jr-en">' + esc(j.step) + '</span></div>';
    });
    html += '</div>';
    html += '<p class="journey-note">That last step is the one that matters. The link is not decoration — ' +
      'it is what closes the loop between reading the words and hearing them.</p>';

    // Index table
    html += '<div class="table-scroll"><table class="listen-index">';
    html += '<thead><tr><th>Song</th><th>Performer</th><th>Ragam</th><th>Tradition</th>' +
      '<th>Listen</th><th>Read</th></tr></thead><tbody>';
    KRITIS.forEach(function (k) {
      (k.listening || []).forEach(function (l, i) {
        html += '<tr>';
        html += '<td class="li-song">' + (i === 0
          ? '<span lang="te" class="li-te">' + esc(k.telugu) + '</span><br>' + esc(k.title)
          : '<span class="li-cont">&#8627;</span>') + '</td>';
        html += '<td>' + esc(l.performer) + '</td>';
        html += '<td class="li-raga">' + esc(l.raga) + '</td>';
        html += '<td class="li-trad">' + esc(l.tradition) + '</td>';
        html += '<td><a class="li-link" href="' + esc(l.url) + '" target="_blank" rel="noopener nofollow">' +
          (l.kind === 'search' ? '&#9654; Find' : '&#9654; YouTube') + '</a></td>';
        html += '<td>' + (i === 0
          ? '<a class="li-read" href="#kriti-' + esc(k.id) + '" data-jump="' + esc(k.id) + '">&rarr; Analysis</a>'
          : '') + '</td>';
        html += '</tr>';
      });
    });
    html += '</tbody></table></div>';
    html += '<p class="listen-caveat">' + LISTEN_CAVEAT + '</p>';
    host.innerHTML = html;
  }

  /* ── His Voice: the progression + the Navaratna arc ─────────── */

  function renderVoice() {
    var host = el('voice-container');
    if (!host) return;
    var V = COLLECTION.voice, A = COLLECTION.arc;
    var html = '';

    html += '<p class="tradition-intro">' + trusted(V.lede) + '</p>';
    html += '<p class="voice-intro">' + trusted(V.intro) + '</p>';

    html += '<div class="stage-list">';
    V.stages.forEach(function (st) {
      html += '<div class="stage">';
      html += '<div class="stage-mark"><span class="stage-n">' + st.n + '</span>' +
        '<span class="stage-te" lang="te">' + esc(st.telugu) + '</span></div>';
      html += '<div class="stage-body">';
      html += '<h4>' + esc(st.name) + '</h4>';
      html += '<p>' + trusted(st.text) + '</p>';
      html += '<a class="stage-song" href="#kriti-' + esc(st.songId) + '" data-jump="' + esc(st.songId) + '">' +
        esc(st.song) + ' &rarr;</a>';
      html += '</div></div>';
    });
    html += '</div>';
    html += '<div class="voice-close"><p>' + trusted(V.close) + '</p></div>';

    // ── Navaratna arc ──
    html += '<h4 class="sub-heading">' + esc(A.title) + '</h4>';
    html += '<p class="sub-lead">' + trusted(A.lede) + '</p>';
    html += '<div class="arc-caveat">' + trusted(A.caveat) + '</div>';

    html += '<div class="arc-chain">';
    A.steps.forEach(function (st, i) {
      html += '<div class="arc-node">';
      html += '<div class="arc-n">' + st.n + '</div>';
      html += '<div class="arc-stage"><span class="arc-te" lang="te">' + esc(st.telugu) + '</span>' +
        '<span class="arc-name">' + esc(st.stage) + '</span>' +
        '<span class="arc-gloss">' + esc(st.gloss) + '</span></div>';
      html += '<div class="arc-detail">';
      html += '<a class="arc-song" href="#kriti-' + esc(st.songId) + '" data-jump="' + esc(st.songId) + '">' +
        esc(st.song) + '</a>';
      html += '<span class="arc-raga">' + esc(st.raga) + '</span>';
      html += '<p>' + trusted(st.text) + '</p>';
      html += '</div></div>';
      if (i < A.steps.length - 1) html += '<div class="arc-link">&#8595;</div>';
    });
    html += '</div>';
    html += '<div class="voice-close"><p>' + trusted(A.close) + '</p></div>';

    host.innerHTML = html;
  }

  /* ── Halls + survival, appended into the Tradition view ─────── */

  function buildHallsAndSurvival() {
    var H = COLLECTION.halls, S = COLLECTION.survival;
    var html = '';

    html += '<h4 class="sub-heading">' + esc(H.title) + '</h4>';
    html += '<p class="sub-lead">' + trusted(H.lede) + '</p>';
    html += '<div class="table-scroll"><table class="halls">';
    html += '<thead><tr><th></th><th>Concert hall</th><th>Bhajan hall</th></tr></thead><tbody>';
    H.rows.forEach(function (r) {
      html += '<tr><td class="halls-aspect">' + esc(r.aspect) + '</td>' +
        '<td>' + trusted(r.concert) + '</td><td>' + trusted(r.bhajan) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="halls-close">' + trusted(H.close) + '</div>';
    html += '<p class="halls-note">' + trusted(H.note) + '</p>';

    html += '<h4 class="sub-heading">' + esc(S.title) + '</h4>';
    html += '<p class="sub-lead">' + trusted(S.lede) + '</p>';
    html += '<div class="survival-grid">';
    S.reasons.forEach(function (r) {
      html += '<div class="survival-card"><h5>' + esc(r.head) + '</h5><p>' + trusted(r.text) + '</p></div>';
    });
    html += '</div>';
    html += '<div class="voice-close"><p>' + trusted(S.close) + '</p></div>';
    return html;
  }

  /* ── The coda ───────────────────────────────────────────────── */

  function renderCoda() {
    var host = el('coda-container');
    if (!host) return;
    var C = COLLECTION.coda;
    var html = '';
    C.lines.forEach(function (line, i) {
      html += '<p class="coda-line' + (i === 1 ? ' coda-name' : '') + '">' + trusted(line) + '</p>';
    });
    html += '<p class="coda-final">' + esc(C.final) +
      '<span class="coda-te" lang="te">' + esc(C.finalTe) + '</span></p>';
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
    renderListeningRoom();
    renderVoice();
    renderCoda();
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

    // Deep links. Two shapes are supported:
    //   #kriti-<id>  — open that keertana in the Keertanas view
    //   #<view>      — switch straight to a named view (e.g. #listen from the article)
    var VIEW_NAMES = ['kritis', 'ragas', 'listen', 'voice', 'story', 'tradition', 'search'];

    function applyHash() {
      var h = location.hash.replace('#', '');
      if (!h) return;
      if (location.hash.indexOf('#kriti-') === 0) {
        jumpToKriti(location.hash.replace('#kriti-', ''));
      } else if (VIEW_NAMES.indexOf(h) !== -1) {
        showView(h);
        var nav = document.querySelector('.view-nav');
        if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    applyHash();

    // A hash-only navigation (address bar, back/forward, or an inbound link while
    // already on this page) does not re-run init, so handle it explicitly.
    window.addEventListener('hashchange', applyHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
