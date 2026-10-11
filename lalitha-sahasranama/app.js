// Sri Lalitha Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

  var searchTimer = null;

  // --- Name-to-Verse Mapping ---
  // Generated from the śloka text by scripts/lalitha/build.mjs (edition/text.json).
  const VERSE_NAMES = LALITHA_DATA.verse_names;

  // Build a reverse map: name number -> verse number
  const NAME_TO_VERSE = {};
  for (const [v, ns] of Object.entries(VERSE_NAMES)) {
    for (const n of ns) {
      NAME_TO_VERSE[n] = parseInt(v);
    }
  }

  // --- Helper: Build names lookup ---
  const namesMap = {};
  LALITHA_DATA.names.forEach(function (n) {
    namesMap[n.num] = n;
  });

  // --- Render Nyasa ---
  function renderNyasa() {
    var container = document.getElementById('nyasa-content');
    var text = LALITHA_DATA.nyasa
      .replace(/^\.\.\s*nyāsaḥ\s*\.\.\s*/i, '')
      .replace('|| nyAsaH ||', '')
      .trim();
    container.textContent = text;
    if (LALITHA_DATA.nyasa_dev) {
      var dev = document.createElement('div');
      dev.className = 'nyasa-devanagari';
      dev.lang = 'sa';
      dev.textContent = LALITHA_DATA.nyasa_dev.join(' ।\n') + ' ॥';
      container.parentNode.insertBefore(dev, container);
    }
  }

  // --- Render Dhyana Shlokas ---
  function renderDhyana() {
    var container = document.getElementById('dhyana-container');
    var html = '';
    LALITHA_DATA.dhyana.forEach(function (dv) {
      html += '<div class="dhyana-verse">';
      if (dv.devanagari) html += '<div class="devanagari" lang="sa">' + escapeHtml(dv.devanagari) + '</div>';
      html += '<div class="transliteration">' + escapeHtml(dv.sanskrit) + '</div>';
      if (dv.translation) {
        html += '<div class="translation">' + escapeHtml(dv.translation) + '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // --- Render Stotram (Main Chanting View) ---
  function renderStotram() {
    var container = document.getElementById('stotram-container');

    // Add expand/collapse controls
    var controlsHtml = '<div class="expand-controls">';
    controlsHtml += '<button class="expand-btn" id="expand-all">Expand All</button>';
    controlsHtml += '<button class="expand-btn" id="collapse-all">Collapse All</button>';
    controlsHtml += '</div>';

    var versesHtml = '';

    LALITHA_DATA.verses.forEach(function (verse) {
      var verseNum = verse.num;
      var nameNums = VERSE_NAMES[verseNum] || [];
      var halves = verse.halves || [];

      // Build shloka text display with translations after full verse
      var translations = verse.translations || [];
      var shlokaHtml = '<div class="shloka-text">';
      var halvesDev = verse.halves_dev || [];
      if (halvesDev.length) {
        shlokaHtml += '<div class="shloka-devanagari" lang="sa">';
        halvesDev.forEach(function (half, idx) {
          shlokaHtml += '<span class="shloka-line">' + escapeHtml(half) + (idx < halvesDev.length - 1 ? ' ।' : ' ॥ ' + verseNum + ' ॥') + '</span>';
        });
        shlokaHtml += '</div>';
      }
      halves.forEach(function (half, idx) {
        shlokaHtml += '<span class="shloka-line">' + escapeHtml(half) + '</span>';
        if (idx < halves.length - 1) {
          shlokaHtml += '<span class="shloka-separator">|</span>';
        }
      });
      shlokaHtml += '<span class="shloka-separator">|| ' + verseNum + ' ||</span>';
      // Show translations after the full verse text
      if (translations.length > 0) {
        shlokaHtml += '<div class="shloka-translations">';
        translations.forEach(function (t) {
          if (t) {
            shlokaHtml += '<span class="shloka-translation">' + escapeHtml(t) + '</span>';
          }
        });
        shlokaHtml += '</div>';
      }
      shlokaHtml += '</div>';

      // Build names as word-split cards
      var namesHtml = '<div class="word-section-label">Word Split</div>';
      namesHtml += '<div class="word-grid">';
      nameNums.forEach(function (nNum) {
        var name = namesMap[nNum];
        if (name) {
          namesHtml += '<div class="word-card">';
          namesHtml += '<div class="word-num">' + nNum + '</div>';
          // the name stays whole; its parts are shown beneath it
          namesHtml += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
          namesHtml += '<div class="word-transliteration">' + escapeHtml(name.name_iast || '') + '</div>';
          namesHtml += '<div class="word-meaning">' + escapeHtml(name.meaning) + '</div>';
          namesHtml += '<a class="word-study" href="edition/#n-' + nNum + '">Sandhi, samāsa &amp; full analysis &rarr;</a>';
          if (name.morphemes && name.morphemes.length > 1) {
            namesHtml += '<div class="morpheme-split">';
            name.morphemes.forEach(function (m, idx) {
              if (idx > 0) namesHtml += '<span class="morpheme-sep">+</span>';
              namesHtml += '<span class="morpheme" title="' + escapeHtml(m.transliteration + ' — ' + m.meaning) + '">';
              if (m.devanagari) namesHtml += '<span class="morpheme-devanagari">' + escapeHtml(m.devanagari) + '</span>';
              namesHtml += '<span class="morpheme-meaning">' + escapeHtml(m.meaning) + '</span>';
              namesHtml += '</span>';
            });
            namesHtml += '</div>';
          }
          namesHtml += '</div>';
        }
      });
      namesHtml += '</div>';

      // Preview text (first half of verse)
      var preview = halves.length > 0 ? halves[0] : '';
      if (preview.length > 60) preview = preview.substring(0, 60) + '...';

      // Verse card
      versesHtml += '<div class="verse-card" id="verse-' + verseNum + '">';
      versesHtml += '<div class="verse-header" onclick="toggleVerse(' + verseNum + ')">';
      versesHtml += '<span class="verse-number">' + verseNum + '</span>';
      versesHtml += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
      versesHtml += '<span class="verse-toggle">&#9660;</span>';
      versesHtml += '</div>';
      versesHtml += '<div class="verse-body">';
      versesHtml += shlokaHtml;
      versesHtml += namesHtml;
      versesHtml += '</div>';
      versesHtml += '</div>';
    });

    container.innerHTML = controlsHtml + versesHtml;

    // Expand first 3 verses by default
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById('verse-' + i);
      if (el) el.classList.add('expanded');
    }

    // Expand/Collapse all
    document.getElementById('expand-all').addEventListener('click', function () {
      document.querySelectorAll('.verse-card').forEach(function (c) {
        c.classList.add('expanded');
      });
    });
    document.getElementById('collapse-all').addEventListener('click', function () {
      document.querySelectorAll('.verse-card').forEach(function (c) {
        c.classList.remove('expanded');
      });
    });
  }

  // --- Toggle verse expansion ---
  window.toggleVerse = function (num) {
    var el = document.getElementById('verse-' + num);
    if (el) el.classList.toggle('expanded');
  };

  // --- Render All Names ---
  function renderNames() {
    var container = document.getElementById('names-container');
    var html = '';
    LALITHA_DATA.names.forEach(function (name) {
      html += '<div class="name-row" id="name-' + name.num + '">';
      html += '<span class="name-num">' + name.num + '.</span>';
      html += '<div class="name-details">';
      html += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
      html += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
      html += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
      html += '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = LALITHA_DATA.names.filter(function (name) {
          return (
            name.name_devanagari.toLowerCase().includes(query) ||
            (name.name_iast || '').toLowerCase().includes(query) ||
            name.meaning.toLowerCase().includes(query) ||
            String(name.num) === query
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No names found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (name) {
          html += '<div class="name-row">';
          html += '<span class="name-num">' + name.num + '.</span>';
          html += '<div class="name-details">';
          html += '<span class="name-iast">' + highlightText(name.name_iast || '', query) + '</span>';
          html += '<span class="name-devanagari">' + highlightText(name.name_devanagari, query) + '</span>';
          html += '<span class="name-meaning">' + highlightText(name.meaning, query) + '</span>';
          html += '</div>';
          html += '</div>';
        });
        results.innerHTML = html;
      }, 300);
    });
  }

  // --- View Navigation ---
  function setupNavigation() {
    var buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var viewId = btn.getAttribute('data-view');

        // Update button states
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // Show/hide views
        document.querySelectorAll('.view').forEach(function (v) {
          v.classList.remove('active');
        });
        document.getElementById(viewId + '-view').classList.add('active');
      });
    });
  }

  // --- PDF Download ---
  function setupPdfDownload() {
    var btn = document.getElementById('download-pdf');
    if (!btn) return;
    btn.addEventListener('click', function () {
      generatePrintablePage();
    });
  }

  function generatePrintablePage() {
    var w = window.open('', '_blank');
    if (!w) {
      alert('Please allow pop-ups to download the PDF.');
      return;
    }

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">';
    html += '<title>Sri Lalitha Sahasranama - Complete Text</title>';
    html += '<link rel="preconnect" href="https://fonts.googleapis.com">';
    html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,600&display=swap" rel="stylesheet">';
    html += '<style>' + getPdfStyles() + '</style>';
    html += '</head><body>';

    // Title page
    html += '<div class="title-page">';
    html += '<div class="ornament">&#x2733;</div>';
    html += '<h1>Sri Lalitha Sahasranama</h1>';
    html += '<p class="subtitle">The Thousand Divine Names of the Supreme Goddess</p>';
    html += '<p class="source">From the Brahmanda Purana</p>';
    html += '<p class="source">Dialogue between Hayagriva and Agastya</p>';
    html += '<div class="ornament">&#x2733;</div>';
    html += '</div>';

    // Nyasa
    html += '<div class="section">';
    html += '<h2 class="section-title"><span class="sanskrit-title">न्यासः</span> Nyasa</h2>';
    var nyasaText = LALITHA_DATA.nyasa
      .replace(/^\.\.\s*nyāsaḥ\s*\.\.\s*/i, '')
      .replace('|| nyAsaH ||', '')
      .trim();
    if (LALITHA_DATA.nyasa_dev) html += '<div class="nyasa-text devanagari">' + escapeHtml(LALITHA_DATA.nyasa_dev.join(' ।\n') + ' ॥') + '</div>';
    html += '<div class="nyasa-text">' + escapeHtml(nyasaText) + '</div>';
    html += '</div>';

    // Dhyana Shlokas
    html += '<div class="section">';
    html += '<h2 class="section-title"><span class="sanskrit-title">ध्यानम्</span> Dhyana Shlokas</h2>';
    html += '<p class="section-intro">Meditation verses to invoke the Divine Mother before chanting</p>';
    LALITHA_DATA.dhyana.forEach(function (dv, idx) {
      html += '<div class="dhyana-verse">';
      html += '<div class="verse-num-label">Dhyana Shloka ' + (idx + 1) + '</div>';
      if (dv.devanagari) html += '<div class="verse-text devanagari">' + escapeHtml(dv.devanagari) + '</div>';
      html += '<div class="verse-text">' + escapeHtml(dv.sanskrit) + '</div>';
      if (dv.translation) {
        html += '<div class="translation">' + escapeHtml(dv.translation) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // Main Stotram
    html += '<div class="section">';
    html += '<h2 class="section-title"><span class="sanskrit-title">अथ श्रीललितासहस्रनामस्तोत्रम्</span> Atha Sri Lalitha Sahasranama Stotram</h2>';

    LALITHA_DATA.verses.forEach(function (verse) {
      var verseNum = verse.num;
      var nameNums = VERSE_NAMES[verseNum] || [];
      var halves = verse.halves || [];
      var translations = verse.translations || [];

      html += '<div class="verse-block">';
      html += '<div class="verse-header-bar"><span class="verse-number">Shloka ' + verseNum + '</span></div>';

      // Shloka text
      if (verse.halves_dev) {
        html += '<div class="shloka-devanagari">' + verse.halves_dev.map(function (h, idx) {
          return escapeHtml(h) + (idx === 0 ? ' ।' : ' ॥ ' + verseNum + ' ॥');
        }).join('<br>') + '</div>';
      }
      html += '<div class="shloka-text">';
      halves.forEach(function (half, idx) {
        html += '<span class="shloka-line">' + escapeHtml(half) + '</span>';
        if (idx < halves.length - 1) {
          html += ' <span class="separator">|</span> ';
        }
      });
      html += ' <span class="separator">|| ' + verseNum + ' ||</span>';
      html += '</div>';

      // Translations
      if (translations.length > 0) {
        html += '<div class="shloka-translation">';
        translations.forEach(function (t) {
          if (t) html += '<div>' + escapeHtml(t) + '</div>';
        });
        html += '</div>';
      }

      // Names as word-split cards
      if (nameNums.length > 0) {
        html += '<div class="word-grid">';
        nameNums.forEach(function (nNum) {
          var name = namesMap[nNum];
          if (name) {
            html += '<div class="word-card">';
            html += '<div class="word-num">' + nNum + '</div>';
            html += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
            html += '<div class="word-transliteration">' + escapeHtml(name.name_iast || '') + '</div>';
            html += '<div class="word-meaning">' + escapeHtml(name.meaning) + '</div>';
            if (name.morphemes && name.morphemes.length > 1) {
              html += '<div class="morpheme-split">';
              name.morphemes.forEach(function (m, idx) {
                if (idx > 0) html += '<span class="morpheme-sep">+</span>';
                html += '<span class="morpheme" title="' + escapeHtml(m.meaning) + '">';
                if (m.devanagari) html += '<span class="morpheme-devanagari">' + escapeHtml(m.devanagari) + '</span>';
                html += '<span class="morpheme-meaning">' + escapeHtml(m.meaning) + '</span>';
                html += '</span>';
              });
              html += '</div>';
            }
            html += '</div>';
          }
        });
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // Closing
    html += '<div class="section closing">';
    html += '<div class="closing-verse">';
    html += '<div class="verse-text">iti śrī-brahmāṇḍa-purāṇe uttara-khaṇḍe śrī-hayagrīva-agastya-saṃvāde<br>śrī-lalitā-sahasranāma-stotra-kathanaṃ sampūrṇam</div>';
    html += '<div class="translation">Thus ends the narration of Sri Lalita Sahasranama Stotra from the Uttara Khanda of the Brahmanda Purana, in the dialogue between Sri Hayagriva and Agastya.</div>';
    html += '</div>';
    html += '<div class="ornament" style="margin-top:2rem;">&#x2733;</div>';
    html += '<p class="footer-text">Om Aim Hreem Shreem Sri Lalitha Tripurasundari Paraatparike Namaha</p>';
    html += '<p class="footer-note">A <a href="https://paddyspeaks.com">PaddySpeaks</a> creation</p>';
    html += '</div>';

    html += '<script>window.onload=function(){setTimeout(function(){window.print();},800);}<\/script>';
    html += '</body></html>';

    w.document.write(html);
    w.document.close();
  }

  function getPdfStyles() {
    return [
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: "Source Serif 4", Georgia, serif; color: #2c1810; background: #fff; line-height: 1.7; font-size: 11pt; }',

      // Title page
      '.title-page { text-align: center; padding: 3rem 1rem 2rem; border-bottom: 2px solid #b8860b; margin-bottom: 1.5rem; }',
      '.title-page h1 { font-family: "Playfair Display", Georgia, serif; font-size: 2.2rem; color: #8b1a1a; margin: 0.5rem 0; }',
      '.title-page .subtitle { font-size: 1.1rem; color: #6b5744; font-style: italic; margin: 0.3rem 0; }',
      '.title-page .source { font-size: 0.9rem; color: #8b7355; margin: 0.15rem 0; }',
      '.ornament { font-size: 1.5rem; color: #b8860b; margin: 0.5rem 0; }',

      // Sections
      '.section { margin: 0 auto 1.5rem; max-width: 800px; padding: 0 1.5rem; }',
      '.section-title { font-family: "Playfair Display", Georgia, serif; font-size: 1.3rem; color: #8b1a1a; border-bottom: 1px solid #b8860b; padding-bottom: 0.4rem; margin-bottom: 0.8rem; }',
      '.sanskrit-title { font-family: "Noto Sans Devanagari", sans-serif; font-size: 1rem; color: #b8860b; margin-right: 0.5rem; }',
      '.section-intro { font-size: 0.85rem; color: #6b5744; font-style: italic; margin-bottom: 1rem; }',

      // Nyasa
      '.nyasa-text { font-size: 0.9rem; line-height: 1.8; white-space: pre-line; color: #3a2518; padding: 0.75rem; background: #fdf8f0; border-left: 3px solid #b8860b; }',

      // Dhyana verses
      '.dhyana-verse { margin-bottom: 1.2rem; padding: 0.75rem; background: #fdf8f0; border-left: 3px solid #c41e3a; page-break-inside: avoid; }',
      '.verse-num-label { font-size: 0.75rem; color: #b8860b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }',
      '.verse-text { font-size: 0.95rem; line-height: 1.9; white-space: pre-line; color: #3a2518; }',
      '.translation { font-size: 0.8rem; color: #6b5744; font-style: italic; margin-top: 0.4rem; line-height: 1.5; }',

      // Verse blocks
      '.verse-block { margin-bottom: 0.8rem; border: 1px solid #e8ddd0; border-radius: 4px; page-break-inside: avoid; overflow: hidden; }',
      '.verse-header-bar { background: linear-gradient(135deg, #8b1a1a, #a52a2a); padding: 0.3rem 0.75rem; }',
      '.verse-number { color: #fff; font-size: 0.8rem; font-weight: 600; }',
      '.shloka-text { background: #fdf8f0; padding: 0.6rem 0.75rem; font-size: 0.9rem; line-height: 1.8; }',
      '.shloka-devanagari, .devanagari { font-family: "Noto Sans Devanagari", sans-serif; font-size: 1.02rem; line-height: 1.9; color: #3a2518; }',
      '.shloka-devanagari { background: #fdf8f0; padding: 0.6rem 0.75rem 0; }',
      '.shloka-line { display: inline; }',
      '.separator { color: #b8860b; font-weight: 600; }',
      '.shloka-translation { padding: 0.3rem 0.75rem; font-size: 0.78rem; color: #6b5744; font-style: italic; background: #f7efe3; }',

      // Word cards
      '.word-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; padding: 0.3rem 0.75rem 0.5rem; }',
      '.word-card { border: 1px solid #e8ddd0; border-radius: 4px; padding: 0.4rem 0.3rem; text-align: center; background: #fdf8f0; }',
      '.word-num { font-size: 0.6rem; color: #b8860b; font-weight: 600; margin-bottom: 0.15rem; }',
      '.word-devanagari { font-family: "Noto Sans Devanagari", sans-serif; font-size: 0.9rem; font-weight: 600; color: #8b1a1a; margin-bottom: 0.15rem; }',
      '.word-transliteration { font-size: 0.7rem; font-style: italic; color: #b8860b; margin-bottom: 0.1rem; }',
      '.word-meaning { font-size: 0.65rem; color: #6b5744; line-height: 1.3; }',

      // Morpheme splits
      '.morpheme-split { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.1rem; margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px dashed #e8ddd0; }',
      '.morpheme { display: flex; flex-direction: column; align-items: center; }',
      '.morpheme-devanagari { font-family: "Noto Sans Devanagari", sans-serif; font-size: 0.65rem; font-weight: 600; color: #8b1a1a; }',
      '.morpheme-text { font-size: 0.55rem; font-style: italic; color: #c41e3a; font-weight: 500; }',
      '.morpheme-meaning { font-size: 0.5rem; color: #6b5744; }',
      '.morpheme-sep { font-size: 0.5rem; color: #b8860b; font-weight: 600; margin: 0 0.03rem; }',

      // Closing
      '.closing { text-align: center; border-top: 2px solid #b8860b; padding-top: 1.5rem; margin-top: 2rem; }',
      '.closing-verse { margin-bottom: 1rem; }',
      '.footer-text { font-size: 0.9rem; color: #8b1a1a; margin-top: 1rem; }',
      '.footer-note { font-size: 0.75rem; color: #8b7355; margin-top: 0.3rem; }',
      '.footer-note a { color: #b8860b; }',

      // Print
      '@media print {',
      '  body { font-size: 10pt; }',
      '  .verse-block { page-break-inside: avoid; }',
      '  .dhyana-verse { page-break-inside: avoid; }',
      '  .title-page { page-break-after: always; }',
      '}'
    ].join('\n');
  }

  // --- Floating Scroll Buttons ---
  function setupScrollButtons() {
    var scrollBtns = document.getElementById('scrollButtons');
    var upBtn = document.getElementById('scroll-up');
    var downBtn = document.getElementById('scroll-down');

    if (!scrollBtns || !upBtn || !downBtn) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        scrollBtns.classList.add('visible');
      } else {
        scrollBtns.classList.remove('visible');
      }
    });

    upBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    downBtn.addEventListener('click', function () {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

  // --- Reading Progress ---
  function setupProgressBar() {
    var scrollBtns = document.getElementById('scrollButtons');
    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progress + '%';
      if (scrollBtns) {
        if (scrollTop > 300) scrollBtns.classList.add('visible');
        else scrollBtns.classList.remove('visible');
      }
    });
    var topBtn = document.getElementById('scroll-up');
    if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var bottomBtn = document.getElementById('scroll-down');
    if (bottomBtn) bottomBtn.addEventListener('click', function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); });
  }

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var cards = document.querySelectorAll('.view.active .verse-card');
      if (cards.length === 0) return;
      var expandedCards = document.querySelectorAll('.view.active .verse-card.expanded');
      var lastExpanded = expandedCards.length > 0 ? expandedCards[expandedCards.length - 1] : null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (lastExpanded) {
          var next = lastExpanded.nextElementSibling;
          while (next && !next.classList.contains('verse-card')) next = next.nextElementSibling;
          if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (cards[0]) { cards[0].classList.add('expanded'); cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('verse-card')) prev = prev.previousElementSibling;
          if (prev) { prev.classList.add('expanded'); prev.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  // --- Deep links: /lalitha-sahasranama/#name-551 ---
  function showView(viewId) {
    var target = document.getElementById(viewId + '-view');
    if (!target) return;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === viewId);
    });
  }

  function applyHash() {
    var m = /^#name-(\d+)$/.exec(window.location.hash || '');
    if (!m) return;
    showView('names');
    var row = document.getElementById('name-' + m[1]);
    if (!row) return;
    window.requestAnimationFrame(function () {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('name-row-targeted');
      setTimeout(function () { row.classList.remove('name-row-targeted'); }, 2600);
    });
  }

  function init() {
    renderNyasa();
    renderDhyana();
    renderStotram();
    renderNames();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupScrollButtons();
    setupPdfDownload();
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
