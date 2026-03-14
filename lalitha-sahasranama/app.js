// Sri Lalitha Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

  var searchTimer = null;

  // --- Name-to-Verse Mapping ---
  // Traditional mapping of which divine names appear in each shloka
  // Based on the standard Brahmanda Purana text
    const VERSE_NAMES = {
      1: [1,2,3,4,5],
      2: [6,7,8,9],
      3: [10,11,12],
      4: [13,14],
      5: [15,16],
      6: [17,18],
      7: [19,20],
      8: [21,22],
      9: [23,24],
      10: [25,26],
      11: [27,28],
      12: [29,30],
      13: [31,32],
      14: [33,34],
      15: [35,36],
      16: [37,38],
      17: [39,40],
      18: [41,42,43],
      19: [44,45],
      20: [46,47,48],
      21: [49,50,51,52,53],
      22: [54,55,56,57],
      23: [58,59,60,61,62],
      24: [63,64],
      25: [65,66],
      26: [67,68],
      27: [69,70],
      28: [71,72],
      29: [73,74],
      30: [75,76],
      31: [77,78],
      32: [79,80],
      33: [81,82],
      34: [83,84],
      35: [85,86],
      36: [87,88,89,90],
      37: [91,92,93,94,95,96,97,98],
      38: [99,100,101,102],
      39: [103,104,105,106],
      40: [107,108,109,110,111],
      41: [112,113,114,115,116],
      42: [117,118,119,120,121,122,123,124,125],
      43: [126,127,128,129,130,131,132,133,134],
      44: [135,136,137,138,139,140,141,142,143,144,145,146],
      45: [147,148,149,150,151,152,153,154,155],
      46: [156,157,158,159,160,161,162,163],
      47: [164,165,166,167,168,169,170,171,172],
      48: [173,174,175,176,177,178,179,180,181],
      49: [182,183,184,185,186,187,188,189,190],
      50: [191,192,193,194,195,196,197,198,199,200],
      51: [201,202,203,204,205,206],
      52: [207,208,209,210,211,212],
      53: [213,214,215,216,217,218],
      54: [219,220,221,222,223,224],
      55: [225,226,227,228,229],
      56: [230,231,232,233,234,235],
      57: [236,237,238],
      58: [239,240,241],
      59: [242,243,244,245,246,247],
      60: [248,249,250,251,252],
      61: [253,254,255,256,257],
      62: [258,259,260,261,262,263],
      63: [264,265,266,267,268,269,270,271,272],
      64: [273,274,275,276,277],
      65: [278,279,280,281,282,283],
      66: [284,285,286,287],
      67: [288,289,290,291],
      68: [292,293],
      69: [294,295,296,297,298,299],
      70: [300,301,302,303,304,305,306,307],
      71: [308,309,310,311,312,313,314,315,316],
      72: [317,318,319,320,321,322,323,324,325],
      73: [326,327,328,329,330,331],
      74: [332,333,334,335,336,337,338,339],
      75: [340,341,342,343,344,345,346,347],
      76: [348,349,350,351,352],
      77: [353,354,355,356,357,358,359,360],
      78: [361,362,363,364],
      79: [365,366,367,368,369],
      80: [370,371,372],
      81: [373,374,375,376,377,378,379,380],
      82: [381,382,383,384,385,386],
      83: [387,388,389,390],
      84: [391,392,393,394,395],
      85: [396,397,398,399,400],
      86: [401,402,403,404,405,406],
      87: [407,408,409,410],
      88: [411,412,413,414,415],
      89: [416,417,418,419,420,421,422,423],
      90: [424,425,426,427,428,429,430,431],
      91: [432,433,434,435,436,437],
      92: [438,439,440,441],
      93: [442,443,444,445,446,447],
      94: [448,449,450,451,452,453,454,455],
      95: [456,457,458,459,460,461,462,463],
      96: [464,465,466,467,468,469,470,471,472,473],
      97: [474,475,476,477,478,479,480,481],
      98: [482,483,484,485],
      99: [486,487,488,489,490],
      100: [491,492,493,494,495],
      101: [496,497,498,499],
      102: [500,501,502,503],
      103: [504,505,506,507,508],
      104: [509,510,511,512],
      105: [513,514,515,516,517],
      106: [518,519,520,521],
      107: [522,523,524,525,526],
      108: [527,528,529,530],
      109: [531,532,533,534,535],
      110: [536,537,538,539,540,541],
      111: [542,543,544,545,546,547],
      112: [548,549,550,551,552],
      113: [553,554,555,556,557],
      114: [558,559,560,561,562,563,564,565],
      115: [566,567,568,569,570],
      116: [571,572,573,574,575,576,577,578,579],
      117: [580,581,582,583],
      118: [584,585,586,587,588,589,590,591],
      119: [592,593,594,595],
      120: [596,597,598,599,600,601],
      121: [602,603,604,605],
      122: [606,607,608,609],
      123: [610,611,612,613],
      124: [614,615,616,617,618],
      125: [619,620,621,622,623,624,625,626],
      126: [627,628,629,630,631,632,633,634],
      127: [635,636,637,638,639,640],
      128: [641,642,643,644],
      129: [645,646,647,648,649,650,651,652,653,654],
      130: [655,656,657,658],
      131: [659,660,661,662,663,664],
      132: [665,666,667,668,669,670,671,672,673,674],
      133: [675,676,677,678,679,680,681,682,683],
      134: [684,685,686,687,688],
      135: [689,690,691,692,693,694],
      136: [695,696,697,698,699,700],
      137: [701,702,703,704,705,706,707,708],
      138: [709,710,711,712,713],
      139: [714,715,716,717,718,719,720,721,722,723],
      140: [724,725,726,727,728],
      141: [729,730,731,732,733,734],
      142: [735,736,737,738,739,740,741,742],
      143: [743,744,745,746],
      144: [747,748,749],
      145: [750,751,752,753,754,755,756,757],
      146: [758,759,760,761,762,763,764,765],
      147: [766,767,768,769,770,771,772,773],
      148: [774,775,776,777,778,779],
      149: [780,781,782,783,784,785,786,787,788],
      150: [789,790,791,792,793,794],
      151: [795,796,797,798,799,800],
      152: [801,802,803,804,805,806,807,808,809,810],
      153: [811,812,813,814,815,816,817,818],
      154: [819,820,821,822,823,824],
      155: [825,826,827,828,829,830,831,832,833],
      156: [834,835,836,837,838,839,840,841],
      157: [842,843,844,845,846,847],
      158: [848,849,850,851,852,853],
      159: [854,855,856],
      160: [857,858,859,860,861,862,863,864],
      161: [865,866,867,868],
      162: [869,870,871,872,873,874],
      163: [875,876,877,878,879,880,881,882,883],
      164: [884,885,886,887],
      165: [888,889,890,891,892,893],
      166: [894,895,896,897,898,899,900,901],
      167: [902,903,904,905,906,907,908,909,910],
      168: [911,912,913,914,915,916],
      169: [917,918,919,920,921,922],
      170: [923,924,925,926,927],
      171: [928,929,930],
      172: [931,932,933,934,935,936,937,938],
      173: [939,940,941,942,943,944,945,946,947],
      174: [948,949,950,951,952,953],
      175: [954,955,956,957,958,959,960],
      176: [961,962,963,964,965,966,967,968,969],
      177: [970,971,972,973,974,975,976],
      178: [977,978,979,980,981],
      179: [982,983,984,985,986],
      180: [987,988,989,990,991,992],
      181: [993,994,995],
      182: [996,997,998,999,1000]
    };

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
  }

  // --- Render Dhyana Shlokas ---
  function renderDhyana() {
    var container = document.getElementById('dhyana-container');
    var html = '';
    LALITHA_DATA.dhyana.forEach(function (dv) {
      html += '<div class="dhyana-verse">';
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

      // Build names breakdown
      var namesHtml = '<div class="names-breakdown">';
      nameNums.forEach(function (nNum) {
        var name = namesMap[nNum];
        if (name) {
          namesHtml += '<div class="name-row">';
          namesHtml += '<span class="name-num">' + nNum + '.</span>';
          namesHtml += '<div class="name-details">';
          namesHtml += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
          namesHtml += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
          namesHtml += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
          namesHtml += '</div>';
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
      html += '<div class="name-row">';
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
    html += '<div class="nyasa-text">' + escapeHtml(nyasaText) + '</div>';
    html += '</div>';

    // Dhyana Shlokas
    html += '<div class="section">';
    html += '<h2 class="section-title"><span class="sanskrit-title">ध्यानम्</span> Dhyana Shlokas</h2>';
    html += '<p class="section-intro">Meditation verses to invoke the Divine Mother before chanting</p>';
    LALITHA_DATA.dhyana.forEach(function (dv, idx) {
      html += '<div class="dhyana-verse">';
      html += '<div class="verse-num-label">Dhyana Shloka ' + (idx + 1) + '</div>';
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

      // Names breakdown
      if (nameNums.length > 0) {
        html += '<div class="names-table">';
        nameNums.forEach(function (nNum) {
          var name = namesMap[nNum];
          if (name) {
            html += '<div class="name-entry">';
            html += '<span class="name-num">' + nNum + '.</span>';
            html += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
            html += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
            html += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
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
    html += '<div class="verse-text">evaṃ śrī-lalitā-devyā nāmnāṃ sāhasrakaṃ jaguḥ</div>';
    html += '<div class="translation">Thus the thousand names of Sri Lalita Devi have been sung.</div>';
    html += '</div>';
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
      '.shloka-line { display: inline; }',
      '.separator { color: #b8860b; font-weight: 600; }',
      '.shloka-translation { padding: 0.3rem 0.75rem; font-size: 0.78rem; color: #6b5744; font-style: italic; background: #f7efe3; }',

      // Names
      '.names-table { padding: 0.3rem 0.75rem 0.5rem; }',
      '.name-entry { display: flex; align-items: baseline; gap: 0.4rem; padding: 0.2rem 0; border-bottom: 1px dotted #e8ddd0; font-size: 0.82rem; }',
      '.name-entry:last-child { border-bottom: none; }',
      '.name-num { min-width: 2.2rem; color: #b8860b; font-weight: 600; flex-shrink: 0; }',
      '.name-iast { min-width: 10rem; color: #3a2518; flex-shrink: 0; }',
      '.name-devanagari { font-family: "Noto Sans Devanagari", sans-serif; min-width: 8rem; color: #8b1a1a; flex-shrink: 0; }',
      '.name-meaning { color: #6b5744; font-style: italic; }',

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
    var topBtn = document.getElementById('scrollTopBtn');
    if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var bottomBtn = document.getElementById('scrollBottomBtn');
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
  function init() {
    renderNyasa();
    renderDhyana();
    renderStotram();
    renderNames();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupPdfDownload();
    setupKeyboardNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
