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
      21: [49,50,51,52,53,54],
      22: [55,56,57,58],
      23: [59,60,61,62,63],
      24: [64,65],
      25: [66,67],
      26: [68,69],
      27: [70,71],
      28: [72,73],
      29: [74,75],
      30: [76,77],
      31: [78,79],
      32: [80,81],
      33: [82,83],
      34: [84,85],
      35: [86,87],
      36: [88,89,90,91],
      37: [92,93,94,95,96,97,98],
      38: [99,100,101,102],
      39: [103,104,105,106],
      40: [107,108,109,110,111],
      41: [112,113,114,115,116],
      42: [117,118,119,120,121,122,123,124,125],
      43: [126,127,128,129,130,131,132,133],
      44: [134,135,136,137,138,139,140,141,142,143],
      45: [144,145,146,147,148,149,150,151],
      46: [152,153,154,155,156,157,158,159],
      47: [160,161,162,163,164,165,166,167],
      48: [168,169,170,171,172,173,174,175],
      49: [176,177,178,179,180,181,182,183],
      50: [184,185,186,187,188,189,190,191,192],
      51: [193,194,195,196,197,198],
      52: [199,200,201,202,203,204],
      53: [205,206,207,208,209,210],
      54: [211,212,213,214,215,216,217],
      55: [218,219,220,221,222,223],
      56: [224,225,226,227,228,229,230,231],
      57: [232,233,234],
      58: [235,236,237],
      59: [238,239,240,241,242,243],
      60: [244,245,246,247,248],
      61: [249,250,251,252,253],
      62: [254,255,256,257,258,259],
      63: [260,261,262,263,264,265,266,267],
      64: [268,269,270,271,272,273,274],
      65: [275,276,277,278,279,280],
      66: [281,282,283,284],
      67: [285,286,287,288],
      68: [289,290],
      69: [291,292,293,294,295,296,297],
      70: [298,299,300,301,302,303,304],
      71: [305,306,307,308,309,310,311,312],
      72: [313,314,315,316,317,318,319,320],
      73: [321,322,323,324,325,326],
      74: [327,328,329,330,331,332,333],
      75: [334,335,336,337,338,339,340],
      76: [341,342,343,344,345],
      77: [346,347,348,349,350,351,352],
      78: [353,354,355,356],
      79: [357,358,359,360,361],
      80: [362,363,364,365],
      81: [366,367,368,369,370,371,372],
      82: [373,374,375,376,377,378],
      83: [379,380,381,382],
      84: [383,384,385,386,387],
      85: [388,389,390,391,392],
      86: [393,394,395,396,397,398,399],
      87: [400,401,402,403],
      88: [404,405,406,407,408],
      89: [409,410,411,412,413,414,415],
      90: [416,417,418,419,420,421,422,423],
      91: [424,425,426,427,428,429,430,431],
      92: [432,433,434,435],
      93: [436,437,438,439,440,441],
      94: [442,443,444,445,446,447,448,449,450,451],
      95: [452,453,454,455,456,457,458],
      96: [459,460,461,462,463,464,465,466,467],
      97: [468,469,470,471,472,473,474],
      98: [475,476,477,478,479],
      99: [480,481,482,483,484],
      100: [485,486,487,488,489,490],
      101: [491,492,493,494],
      102: [495,496,497,498],
      103: [499,500,501,502,503],
      104: [504,505,506,507],
      105: [508,509,510,511,512,513],
      106: [514,515,516,517,518],
      107: [519,520,521,522,523],
      108: [524,525,526,527],
      109: [528,529,530,531,532],
      110: [533,534,535,536,537,538,539,540,541],
      111: [542,543,544,545,546,547],
      112: [548,549,550,551,552],
      113: [553,554,555,556,557,558],
      114: [559,560,561,562,563,564,565],
      115: [566,567,568,569,570,571],
      116: [572,573,574,575,576,577],
      117: [578,579,580,581],
      118: [582,583,584,585,586,587,588,589],
      119: [590,591,592,593],
      120: [594,595,596,597,598,599,600],
      121: [601,602,603,604,605,606],
      122: [607,608,609,610],
      123: [611,612,613,614],
      124: [615,616,617,618,619,620,621],
      125: [622,623,624,625,626,627,628],
      126: [629,630,631,632,633,634,635,636],
      127: [637,638,639,640,641,642,643,644],
      128: [645,646,647,648],
      129: [649,650,651,652,653,654,655,656,657],
      130: [658,659,660,661],
      131: [662,663,664,665,666,667,668],
      132: [669,670,671,672,673,674,675,676,677],
      133: [678,679,680,681,682,683],
      134: [684,685,686,687,688],
      135: [689,690,691,692,693,694],
      136: [695,696,697,698,699,700],
      137: [701,702,703,704,705,706,707],
      138: [708,709,710,711,712,713],
      139: [714,715,716,717,718,719,720,721,722],
      140: [723,724,725,726,727],
      141: [728,729,730,731,732,733,734],
      142: [735,736,737,738,739,740,741],
      143: [742,743,744,745],
      144: [746,747,748],
      145: [749,750,751,752,753,754,755,756],
      146: [757,758,759,760,761,762,763],
      147: [764,765,766,767,768,769,770],
      148: [771,772,773,774,775,776],
      149: [777,778,779,780,781,782,783,784],
      150: [785,786,787,788,789,790],
      151: [791,792,793,794,795,796],
      152: [797,798,799,800,801,802,803,804,805],
      153: [806,807,808,809,810,811,812],
      154: [813,814,815,816,817,818,819,820],
      155: [821,822,823,824,825,826,827,828,829,830],
      156: [831,832,833,834,835,836,837],
      157: [838,839,840,841,842,843],
      158: [844,845,846,847,848,849,850],
      159: [851,852,853],
      160: [854,855,856,857,858,859,860,861],
      161: [862,863,864,865],
      162: [866,867,868,869,870,871],
      163: [872,873,874,875,876,877,878,879],
      164: [880,881,882,883],
      165: [884,885,886,887,888,889],
      166: [890,891,892,893,894,895,896,897],
      167: [898,899,900,901,902,903,904,905],
      168: [906,907,908,909,910,911],
      169: [912,913,914,915,916,917],
      170: [918,919,920,921,922],
      171: [923,924,925,926],
      172: [927,928,929,930,931,932,933],
      173: [934,935,936,937,938,939,940,941],
      174: [942,943,944,945,946,947],
      175: [948,949,950,951,952,953,954],
      176: [955,956,957,958,959,960,961,962,963],
      177: [964,965,966,967,968,969,970],
      178: [971,972,973,974,975,976],
      179: [977,978,979,980,981],
      180: [982,983,984,985,986,987,988,989],
      181: [990,991,992,993],
      182: [994,995,996,997,998,999,1000],
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

      // Build names as word-split cards
      var namesHtml = '<div class="word-section-label">Word Split</div>';
      namesHtml += '<div class="word-grid">';
      nameNums.forEach(function (nNum) {
        var name = namesMap[nNum];
        if (name) {
          namesHtml += '<div class="word-card">';
          namesHtml += '<div class="word-num">' + nNum + '</div>';
          if (name.morphemes && name.morphemes.length > 1) {
            namesHtml += '<div class="word-devanagari">';
            name.morphemes.forEach(function (m, idx) {
              if (idx > 0) namesHtml += ' ';
              namesHtml += escapeHtml(m.devanagari || '');
            });
            namesHtml += '</div>';
          } else {
            namesHtml += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
          }
          namesHtml += '<div class="word-transliteration">' + escapeHtml(name.name_iast || '') + '</div>';
          namesHtml += '<div class="word-meaning">' + escapeHtml(name.meaning) + '</div>';
          if (name.morphemes && name.morphemes.length > 1) {
            namesHtml += '<div class="morpheme-split">';
            name.morphemes.forEach(function (m, idx) {
              if (idx > 0) namesHtml += '<span class="morpheme-sep">+</span>';
              namesHtml += '<span class="morpheme" title="' + escapeHtml(m.meaning) + '">';
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

      // Names as word-split cards
      if (nameNums.length > 0) {
        html += '<div class="word-grid">';
        nameNums.forEach(function (nNum) {
          var name = namesMap[nNum];
          if (name) {
            html += '<div class="word-card">';
            html += '<div class="word-num">' + nNum + '</div>';
            if (name.morphemes && name.morphemes.length > 1) {
              html += '<div class="word-devanagari">';
              name.morphemes.forEach(function (m, idx) {
                if (idx > 0) html += ' ';
                html += escapeHtml(m.devanagari || '');
              });
              html += '</div>';
            } else {
              html += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
            }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
