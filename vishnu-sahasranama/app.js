// Sri Vishnu Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

  // --- Name-to-Verse Mapping ---
  // Traditional mapping: which divine names appear in each shloka
  // Based on the standard Mahabharata text (Anushasana Parva)
  const VERSE_NAMES = {
    1: [1,2,3,4,5,6,7,8,9],
    2: [10,11,12,13,14,15,16,17],
    3: [18,19,20,21,22,23,24],
    4: [25,26,27,28,29,30,31,32,33,34,35,36],
    5: [37,38,39,40,41,42,43,44,45],
    6: [46,47,48,49,50,51,52,53,54],
    7: [55,56,57,58,59,60,61,62,63],
    8: [64,65,66,67,68,69,70,71,72,73],
    9: [74,75,76,77,78,79,80,81,82,83,84],
    10: [85,86,87,88,89,90,91,92,93,94],
    11: [95,96,97,98,99,100,101,102,103],
    12: [104,105,106,107,108,109,110,111,112,113],
    13: [114,115,116,117,118,119,120,121,122],
    14: [123,124,125,126,127,128,129,130,131,132],
    15: [133,134,135,136,137,138,139,140],
    16: [141,142,143,144,145,146,147,148,149,150],
    17: [151,152,153,154,155,156,157,158,159,160,161,162],
    18: [163,164,165,166,167,168,169,170,171,172],
    19: [173,174,175,176,177,178,179,180],
    20: [181,182,183,184,185,186,187,188],
    21: [189,190,191,192,193,194,195,196,197],
    22: [198,199,200,201,202,203,204,205,206,207,208],
    23: [209,210,211,212,213,214,215,216,217],
    24: [218,219,220,221,222,223,224,225,226,227],
    25: [228,229,230,231,232,233,234,235],
    26: [236,237,238,239,240,241,242,243,244,245,246],
    27: [247,248,249,250,251,252,253,254,255],
    28: [256,257,258,259,260,261,262,263,264],
    29: [265,266,267,268,269,270,271,272,273,274],
    30: [275,276,277,278,279,280,281,282],
    31: [283,284,285,286,287,288,289],
    32: [290,291,292,293,294,295,296,297,298,299],
    33: [300,301,302,303,304,305,306,307],
    34: [308,309,310,311,312,313,314,315,316,317],
    35: [318,319,320,321,322,323,324,325,326],
    36: [327,328,329,330,331,332,333,334,335],
    37: [336,337,338,339,340,341,342,343,344,345],
    38: [346,347,348,349,350,351,352,353,354],
    39: [355,356,357,358,359,360,361,362],
    40: [363,364,365,366,367,368,369,370,371,372],
    41: [373,374,375,376,377,378,379,380,381,382,383],
    42: [384,385,386,387,388,389,390,391,392,393],
    43: [394,395,396,397,398,399,400,401,402,403,404],
    44: [405,406,407,408,409,410,411,412,413,414,415],
    45: [416,417,418,419,420,421,422,423,424,425],
    46: [426,427,428,429,430,431,432,433,434],
    47: [435,436,437,438,439,440,441,442,443,444],
    48: [445,446,447,448,449,450,451,452,453,454],
    49: [455,456,457,458,459,460,461,462,463,464],
    50: [465,466,467,468,469,470,471,472,473,474],
    51: [475,476,477,478,479,480,481,482,483,484,485],
    52: [486,487,488,489,490,491,492,493],
    53: [494,495,496,497,498,499,500,501,502],
    54: [503,504,505,506,507,508,509,510,511,512],
    55: [513,514,515,516,517,518,519,520,521],
    56: [522,523,524,525,526,527,528,529,530,531],
    57: [532,533,534,535,536,537,538,539,540],
    58: [541,542,543,544,545,546,547,548,549],
    59: [550,551,552,553,554,555,556,557,558,559,560,561],
    60: [562,563,564,565,566,567,568,569,570],
    61: [571,572,573,574,575,576,577,578],
    62: [579,580,581,582,583,584,585,586,587,588,589,590],
    63: [591,592,593,594,595,596,597,598,599,600],
    64: [601,602,603,604,605,606,607,608,609],
    65: [610,611,612,613,614,615,616,617,618,619],
    66: [620,621,622,623,624,625,626,627,628],
    67: [629,630,631,632,633,634,635,636,637,638],
    68: [639,640,641,642,643,644,645,646,647],
    69: [648,649,650,651,652,653,654,655,656],
    70: [657,658,659,660,661,662,663,664,665,666],
    71: [667,668,669,670,671,672,673,674,675,676],
    72: [677,678,679,680,681,682,683,684],
    73: [685,686,687,688,689,690,691,692,693,694,695],
    74: [696,697,698,699,700,701,702,703,704],
    75: [705,706,707,708,709,710,711,712,713],
    76: [714,715,716,717,718,719,720,721,722],
    77: [723,724,725,726,727,728,729,730],
    78: [731,732,733,734,735,736,737,738,739,740,741,742],
    79: [743,744,745,746,747,748,749,750,751,752],
    80: [753,754,755,756,757,758,759,760,761,762],
    81: [763,764,765,766,767,768,769,770],
    82: [771,772,773,774,775,776,777,778],
    83: [779,780,781,782,783,784,785,786,787],
    84: [788,789,790,791,792,793,794,795],
    85: [796,797,798,799,800,801,802,803,804,805],
    86: [806,807,808,809,810,811,812],
    87: [813,814,815,816,817,818,819,820,821,822],
    88: [823,824,825,826,827,828,829,830,831],
    89: [832,833,834,835,836,837,838,839,840],
    90: [841,842,843,844,845,846,847,848,849,850,851,852],
    91: [853,854,855,856,857,858,859,860,861,862],
    92: [863,864,865,866,867,868,869,870,871,872],
    93: [873,874,875,876,877,878,879,880,881],
    94: [882,883,884,885,886,887,888,889,890,891],
    95: [892,893,894,895,896,897,898,899,900,901],
    96: [902,903,904,905,906,907,908,909,910,911],
    97: [912,913,914,915,916,917,918,919,920],
    98: [921,922,923,924,925,926,927,928],
    99: [929,930,931,932,933,934,935,936,937],
    100: [938,939,940,941,942,943,944,945,946],
    101: [947,948,949,950,951,952,953,954,955],
    102: [956,957,958,959,960,961,962,963,964,965],
    103: [966,967,968,969,970,971,972,973],
    104: [974,975,976,977,978,979,980,981,982],
    105: [983,984,985,986,987,988,989,990,991],
    106: [992,993,994,995,996,997,998,999],
    107: [1000,1001,1002,1003,1004,1005,1006,1007]
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
  VISHNU_DATA.names.forEach(function (n) {
    namesMap[n.num] = n;
  });

  // --- Render Pre-Stotram Sections (Dhyana, Preamble, Viniyoga, etc.) ---
  function renderDhyana() {
    var container = document.getElementById('dhyana-container');
    var html = '';

    if (VISHNU_DATA.preStotra) {
      VISHNU_DATA.preStotra.forEach(function (section) {
        html += '<div class="pre-stotra-section">';
        html += '<div class="pre-stotra-label">' + escapeHtml(section.label);
        if (section.label_sanskrit) {
          html += ' <span class="label-sanskrit">' + escapeHtml(section.label_sanskrit) + '</span>';
        }
        html += '</div>';

        // Render verses: Devanagari first, then English, then translation (no IAST)
        if (section.verses) {
          section.verses.forEach(function (v) {
            html += '<div class="dhyana-verse">';
            if (v.devanagari) {
              html += '<div class="devanagari-text">' + escapeHtml(v.devanagari) + '</div>';
            }
            if (v.english) {
              html += '<div class="transliteration english-transliteration">' + escapeHtml(v.english) + '</div>';
            }
            if (v.translation) {
              html += '<div class="translation">' + escapeHtml(v.translation) + '</div>';
            }
            html += '</div>';
          });
        }

        // Render prose (for viniyoga): Devanagari first, then English
        if (section.prose) {
          section.prose.forEach(function (p) {
            html += '<div class="dhyana-verse viniyoga-text">';
            if (p.devanagari) {
              html += '<div class="devanagari-text">' + escapeHtml(p.devanagari) + '</div>';
            }
            if (p.english) {
              html += '<div class="transliteration english-transliteration">' + escapeHtml(p.english) + '</div>';
            }
            if (p.translation) {
              html += '<div class="translation">' + escapeHtml(p.translation) + '</div>';
            }
            html += '</div>';
          });
        }

        html += '</div>';
      });
    }

    container.innerHTML = html;
  }

  // --- Render Post-Stotram / Phalashruti ---
  function renderPhalashruti() {
    var container = document.getElementById('phalashruti-container');
    if (!container) return;
    var html = '';

    if (VISHNU_DATA.postStotra) {
      VISHNU_DATA.postStotra.forEach(function (section) {
        html += '<div class="pre-stotra-section">';
        html += '<div class="pre-stotra-label">' + escapeHtml(section.label);
        if (section.label_sanskrit) {
          html += ' <span class="label-sanskrit">' + escapeHtml(section.label_sanskrit) + '</span>';
        }
        html += '</div>';

        if (section.speaker) {
          html += '<div class="speaker-label">' + escapeHtml(section.speaker);
          if (section.speaker_sanskrit) {
            html += ' <span class="label-sanskrit">' + escapeHtml(section.speaker_sanskrit) + '</span>';
          }
          html += '</div>';
        }

        // Render verses: Devanagari first, then English, then translation (no IAST)
        if (section.verses) {
          section.verses.forEach(function (v) {
            html += '<div class="dhyana-verse">';
            if (v.devanagari) {
              html += '<div class="devanagari-text">' + escapeHtml(v.devanagari) + '</div>';
            }
            if (v.english) {
              html += '<div class="transliteration english-transliteration">' + escapeHtml(v.english) + '</div>';
            }
            if (v.translation) {
              html += '<div class="translation">' + escapeHtml(v.translation) + '</div>';
            }
            html += '</div>';
          });
        }

        // Render prose: Devanagari first, then English
        if (section.prose) {
          section.prose.forEach(function (p) {
            html += '<div class="dhyana-verse viniyoga-text">';
            if (p.devanagari) {
              html += '<div class="devanagari-text">' + escapeHtml(p.devanagari) + '</div>';
            }
            if (p.english) {
              html += '<div class="transliteration english-transliteration">' + escapeHtml(p.english) + '</div>';
            }
            if (p.translation) {
              html += '<div class="translation">' + escapeHtml(p.translation) + '</div>';
            }
            html += '</div>';
          });
        }

        html += '</div>';
      });
    }

    container.innerHTML = html;
  }

  // --- Generate PDF (printable page) ---
  function generatePDF() {
    var w = window.open('', '_blank');
    if (!w) {
      alert('Please allow pop-ups to generate the PDF.');
      return;
    }

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    html += '<title>Sri Vishnu Sahasranama Stotram</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">';
    html += '<style>';
    html += 'body{font-family:"Source Serif 4",Georgia,serif;max-width:700px;margin:0 auto;padding:40px 30px;color:#1a1a2e;line-height:1.6;font-size:11pt;}';
    html += '.dev{font-family:"Noto Sans Devanagari",sans-serif;color:#1a1a6e;font-size:12pt;line-height:2;font-weight:500;white-space:pre-line;margin:4px 0;}';
    html += '.iast{font-style:italic;color:#666;font-size:9.5pt;margin:2px 0;}';
    html += '.eng{font-weight:500;font-size:10.5pt;margin:2px 0;white-space:pre-line;}';
    html += '.tl{color:#444;font-size:10pt;margin:4px 0 12px;font-style:italic;}';
    html += '.sec{font-size:14pt;font-weight:700;color:#1a1a6e;margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid #c4a35a;text-transform:uppercase;letter-spacing:0.05em;}';
    html += '.sec .sk{font-weight:500;color:#c4a35a;text-transform:none;letter-spacing:0;font-family:"Noto Sans Devanagari",sans-serif;margin-left:8px;font-size:11pt;}';
    html += '.speaker{font-size:10pt;font-weight:600;color:#888;font-style:italic;margin:8px 0;}';
    html += '.verse-block{margin:10px 0;padding:10px 14px;border-left:3px solid #c4a35a;background:#fafaf7;page-break-inside:avoid;}';
    html += '.stotram-verse{margin:12px 0;padding:8px 0;border-bottom:1px solid #eee;page-break-inside:avoid;}';
    html += '.v-num{font-weight:700;color:#c4a35a;margin-right:4px;}';
    html += '.name-row{display:flex;gap:8px;margin:2px 0;font-size:9.5pt;}';
    html += '.name-num{color:#c4a35a;font-weight:600;min-width:35px;}';
    html += '.name-iast{font-weight:600;}';
    html += '.name-dev{font-family:"Noto Sans Devanagari",sans-serif;color:#1a1a6e;font-size:10pt;}';
    html += '.name-meaning{color:#555;font-style:italic;}';
    html += '.prose{font-size:10pt;white-space:pre-line;margin:4px 0;}';
    html += 'h1{text-align:center;font-size:20pt;color:#1a1a6e;margin-bottom:4px;}';
    html += '.subtitle{text-align:center;color:#666;font-size:11pt;margin-bottom:30px;}';
    html += '.ornament{text-align:center;color:#c4a35a;font-size:18pt;margin:8px 0;}';
    html += '.names-section{margin:6px 0 12px;padding-left:10px;}';
    html += '@media print{body{padding:20px;font-size:10pt;}.verse-block{background:#fff;}}';
    html += '</style></head><body>';

    // Title
    html += '<div class="ornament">&#x2733;</div>';
    html += '<h1>Sri Vishnu Sahasranama Stotram</h1>';
    html += '<div class="subtitle">श्रीविष्णुसहस्रनामस्तोत्रम्</div>';
    html += '<div class="subtitle">The Thousand Divine Names of Lord Vishnu<br>From the Mahabharata, Anushasana Parva</div>';

    // --- Pre-Stotra ---
    if (VISHNU_DATA.preStotra) {
      VISHNU_DATA.preStotra.forEach(function (section) {
        html += '<div class="sec">' + esc(section.label);
        if (section.label_sanskrit) html += '<span class="sk">' + esc(section.label_sanskrit) + '</span>';
        html += '</div>';

        if (section.verses) {
          section.verses.forEach(function (v) {
            html += '<div class="verse-block">';
            if (v.devanagari) html += '<div class="dev">' + esc(v.devanagari) + '</div>';
            if (v.english) html += '<div class="eng">' + esc(v.english) + '</div>';
            if (v.translation) html += '<div class="tl">' + esc(v.translation) + '</div>';
            html += '</div>';
          });
        }
        if (section.prose) {
          section.prose.forEach(function (p) {
            html += '<div class="verse-block">';
            if (p.devanagari) html += '<div class="dev prose">' + esc(p.devanagari) + '</div>';
            if (p.english) html += '<div class="eng prose">' + esc(p.english) + '</div>';
            if (p.translation) html += '<div class="tl">' + esc(p.translation) + '</div>';
            html += '</div>';
          });
        }
      });
    }

    // --- Main Stotram ---
    html += '<div class="sec">Sri Vishnu Sahasranama Stotram<span class="sk">श्रीविष्णुसहस्रनामस्तोत्रम्</span></div>';

    VISHNU_DATA.verses.forEach(function (verse) {
      var verseNum = verse.num;
      var halves = verse.halves || [];
      var englishHalves = verse.english_halves || [];
      var translations = verse.translations || [];
      var nameNums = VERSE_NAMES[verseNum] || [];

      html += '<div class="stotram-verse">';

      // Devanagari (generated from IAST)
      if (halves.length > 0) {
        html += '<div class="dev"><span class="v-num">' + verseNum + '.</span> ';
        html += esc(halves.map(function(h) { return iastToDevanagari(h); }).join(' । ')) + ' ॥</div>';
      }

      // English transliteration
      if (englishHalves.length > 0) {
        html += '<div class="eng">';
        html += esc(englishHalves.join(' | ')) + ' ||</div>';
      }

      // Translations (name meanings per half)
      if (translations.length > 0) {
        html += '<div class="tl">' + esc(translations.join(' ')) + '</div>';
      }

      // Names breakdown
      if (nameNums.length > 0) {
        html += '<div class="names-section">';
        nameNums.forEach(function (nNum) {
          var name = namesMap[nNum];
          if (name) {
            html += '<div class="name-row">';
            html += '<span class="name-num">' + nNum + '.</span>';
            html += '<span class="name-iast">' + esc(name.name_iast || '') + '</span>';
            if (name.name_devanagari) {
              html += ' <span class="name-dev">' + esc(name.name_devanagari) + '</span>';
            }
            html += ' — <span class="name-meaning">' + esc(name.meaning) + '</span>';
            html += '</div>';
          }
        });
        html += '</div>';
      }

      html += '</div>';
    });

    // --- Post-Stotra / Phalashruti ---
    if (VISHNU_DATA.postStotra) {
      VISHNU_DATA.postStotra.forEach(function (section) {
        html += '<div class="sec">' + esc(section.label);
        if (section.label_sanskrit) html += '<span class="sk">' + esc(section.label_sanskrit) + '</span>';
        html += '</div>';

        if (section.speaker) {
          html += '<div class="speaker">' + esc(section.speaker);
          if (section.speaker_sanskrit) html += ' <span class="sk">' + esc(section.speaker_sanskrit) + '</span>';
          html += '</div>';
        }

        if (section.verses) {
          section.verses.forEach(function (v) {
            html += '<div class="verse-block">';
            if (v.devanagari) html += '<div class="dev">' + esc(v.devanagari) + '</div>';
            if (v.english) html += '<div class="eng">' + esc(v.english) + '</div>';
            if (v.translation) html += '<div class="tl">' + esc(v.translation) + '</div>';
            html += '</div>';
          });
        }
        if (section.prose) {
          section.prose.forEach(function (p) {
            html += '<div class="verse-block">';
            if (p.devanagari) html += '<div class="dev prose">' + esc(p.devanagari) + '</div>';
            if (p.english) html += '<div class="eng prose">' + esc(p.english) + '</div>';
            if (p.translation) html += '<div class="tl">' + esc(p.translation) + '</div>';
            html += '</div>';
          });
        }
      });
    }

    // Footer
    html += '<div class="ornament" style="margin-top:30px;">&#x2733;</div>';
    html += '<div class="subtitle">Om Namo Bhagavate Vasudevaya</div>';
    html += '<div class="subtitle" style="font-size:9pt;">Generated from paddyspeaks.com/vishnu-sahasranama</div>';

    html += '</body></html>';

    w.document.write(html);
    w.document.close();

    // Wait for fonts to load, then trigger print
    w.onload = function () {
      setTimeout(function () { w.print(); }, 500);
    };
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- IAST to Devanagari Converter ---
  var IAST_TO_DEVA = [
    // Vowels (long forms first to prevent partial matches)
    ['ā', 'ा'], ['ī', 'ी'], ['ū', 'ू'], ['ṝ', 'ॄ'], ['ṛ', 'ृ'], ['ḷ', 'ॢ'],
    ['ai', 'ै'], ['au', 'ौ'],
    ['ō', 'ो'], ['ē', 'े'],
    ['a', ''], ['i', 'ि'], ['u', 'ु'], ['e', 'े'], ['o', 'ो'],
    // Anusvara, Visarga, Chandrabindu
    ['ṃ', 'ं'], ['ṁ', 'ं'], ['ḥ', 'ः'], ['~', 'ँ'],
    // Consonants (conjuncts/aspirates first)
    ['kh', 'ख'], ['gh', 'घ'], ['ṅ', 'ङ'],
    ['ch', 'छ'], ['jh', 'झ'], ['ñ', 'ञ'],
    ['ṭh', 'ठ'], ['ḍh', 'ढ'], ['ṇ', 'ण'],
    ['th', 'थ'], ['dh', 'ध'], ['n', 'न'],
    ['ph', 'फ'], ['bh', 'भ'], ['m', 'म'],
    ['k', 'क'], ['g', 'ग'], ['c', 'च'], ['j', 'ज'],
    ['ṭ', 'ट'], ['ḍ', 'ड'], ['t', 'त'], ['d', 'द'],
    ['p', 'प'], ['b', 'ब'],
    ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'],
    ['ś', 'श'], ['ṣ', 'ष'], ['s', 'स'], ['h', 'ह']
  ];

  var DEVA_VOWELS_INDEPENDENT = {
    'ा': 'आ', 'ि': 'इ', 'ी': 'ई', 'ु': 'उ', 'ू': 'ऊ', 'ृ': 'ऋ', 'ॄ': 'ॠ',
    'े': 'ए', 'ै': 'ऐ', 'ो': 'ओ', 'ौ': 'औ', 'ॢ': 'ऌ',
    '': 'अ'
  };

  function iastToDevanagari(iast) {
    if (!iast) return '';
    var result = '';
    var i = 0;
    var src = iast.toLowerCase();
    var consonants = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';

    while (i < src.length) {
      // Skip spaces, punctuation, digits, pipes
      var ch = src[i];
      if (ch === ' ' || ch === '.' || ch === '|' || ch === '\n' || ch === '-' || ch === ',' || ch === ';' || ch === '(' || ch === ')') {
        if (ch === '.' && i + 1 < src.length && src[i + 1] === '.') {
          result += ' ॥';
          i += 2;
        } else if (ch === '.') {
          result += ' ।';
          i++;
        } else {
          result += ch;
          i++;
        }
        continue;
      }
      if (ch === '\'') {
        // Avagraha
        result += 'ऽ';
        i++;
        continue;
      }
      if (ch >= '0' && ch <= '9') {
        result += ch;
        i++;
        continue;
      }
      // Try matching longest IAST sequence
      var matched = false;
      for (var m = 0; m < IAST_TO_DEVA.length; m++) {
        var seq = IAST_TO_DEVA[m][0];
        var deva = IAST_TO_DEVA[m][1];
        if (src.substring(i, i + seq.length) === seq) {
          var isVowel = 'aāiīuūṛṝḷeēoōaiauṁṃḥ'.indexOf(seq[0]) >= 0 && 'khghṅchjhñṭhḍhṇthdhnphbhmyrlvśṣsh'.indexOf(seq) < 0;

          if (isVowel && seq !== 'ṁ' && seq !== 'ṃ' && seq !== 'ḥ') {
            var lastDeva = result.length > 0 ? result[result.length - 1] : '';
            // Check if last char is a consonant (needs matra) or start of word (needs independent vowel)
            // Note: must check lastDeva.length > 0 because ''.indexOf('') === 0 in JS
            if (lastDeva.length > 0 && (consonants.indexOf(lastDeva) >= 0 || lastDeva === '्')) {
              // After halant, remove halant and add matra
              if (lastDeva === '्') {
                result = result.substring(0, result.length - 1);
              }
              result += deva; // matra form (or empty for 'a')
            } else {
              // Independent vowel
              var indep = DEVA_VOWELS_INDEPENDENT[deva];
              result += indep !== undefined ? indep : deva;
            }
          } else if (seq === 'ṁ' || seq === 'ṃ' || seq === 'ḥ') {
            // Anusvara/Visarga - remove trailing halant if present
            if (result.length > 0 && result[result.length - 1] === '्') {
              result = result.substring(0, result.length - 1);
            }
            result += deva;
          } else {
            // Consonant - add halant after it
            result += deva + '्';
          }
          i += seq.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result += src[i];
        i++;
      }
    }

    // Remove halant before anusvara/visarga (they attach to the preceding consonant)
    result = result.replace(/्([ंः])/g, '$1');

    return result;
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

    VISHNU_DATA.verses.forEach(function (verse) {
      var verseNum = verse.num;
      var nameNums = VERSE_NAMES[verseNum] || [];
      var halves = verse.halves || [];

      // Build shloka text display: Devanagari first, then English
      var translations = verse.translations || [];
      var englishHalves = verse.english_halves || [];
      var shlokaHtml = '<div class="shloka-text">';

      // Devanagari (generated from IAST halves, split for easy pronunciation)
      if (halves.length > 0) {
        shlokaHtml += '<div class="shloka-devanagari">';
        halves.forEach(function (half, idx) {
          shlokaHtml += '<span class="shloka-line devanagari-line">' + escapeHtml(iastToDevanagari(half)) + '</span>';
          if (idx < halves.length - 1) {
            shlokaHtml += '<span class="shloka-separator devanagari-sep">।</span>';
          }
        });
        shlokaHtml += '<span class="shloka-separator devanagari-sep">॥ ' + verseNum + ' ॥</span>';
        shlokaHtml += '</div>';
      }

      // English transliteration (split for easy pronunciation)
      if (englishHalves.length > 0) {
        shlokaHtml += '<div class="shloka-english">';
        englishHalves.forEach(function (half, idx) {
          shlokaHtml += '<span class="shloka-line english-line">' + escapeHtml(half) + '</span>';
          if (idx < englishHalves.length - 1) {
            shlokaHtml += '<span class="shloka-separator">|</span>';
          }
        });
        shlokaHtml += '<span class="shloka-separator">|| ' + verseNum + ' ||</span>';
        shlokaHtml += '</div>';
      }

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

      // Build word cards (like Soundarya Lahari / Bhagavad Gita)
      var namesHtml = '';
      if (nameNums.length > 0) {
        namesHtml += '<div class="word-section-label">Divine Names in this Shloka</div>';
        namesHtml += '<div class="word-grid">';
        nameNums.forEach(function (nNum) {
          var name = namesMap[nNum];
          if (name) {
            namesHtml += '<div class="word-card">';
            if (name.name_devanagari) {
              namesHtml += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
            }
            namesHtml += '<div class="word-transliteration">' + escapeHtml(name.name_iast || '') + '</div>';
            namesHtml += '<div class="word-num">' + nNum + '</div>';
            namesHtml += '<div class="word-meaning">' + escapeHtml(name.meaning) + '</div>';
            namesHtml += '</div>';
          }
        });
        namesHtml += '</div>';
      }

      // Preview text (prefer English transliteration)
      var preview = englishHalves.length > 0 ? englishHalves[0] : (halves.length > 0 ? halves[0] : '');
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
    VISHNU_DATA.names.forEach(function (name) {
      html += '<div class="name-row">';
      html += '<span class="name-num">' + name.num + '.</span>';
      html += '<div class="name-details">';
      html += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
      if (name.name_devanagari) {
        html += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
      }
      html += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
      html += '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // --- Utility: Highlight search term in text ---
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  var searchTimer = null;

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
          results.innerHTML = '<p style="text-align:center;color:#4a5568;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = VISHNU_DATA.names.filter(function (name) {
          return (
            (name.name_devanagari || '').toLowerCase().includes(query) ||
            (name.name_iast || '').toLowerCase().includes(query) ||
            name.meaning.toLowerCase().includes(query) ||
            String(name.num) === query
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#4a5568;padding:2rem;">No names found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (name) {
          html += '<div class="name-row">';
          html += '<span class="name-num">' + name.num + '.</span>';
          html += '<div class="name-details">';
          html += '<span class="name-iast">' + highlightText(name.name_iast || '', query) + '</span>';
          if (name.name_devanagari) {
            html += '<span class="name-devanagari">' + highlightText(name.name_devanagari, query) + '</span>';
          }
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

        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        document.querySelectorAll('.view').forEach(function (v) {
          v.classList.remove('active');
        });
        document.getElementById(viewId + '-view').classList.add('active');
      });
    });
  }

  // --- Reading Progress & Scroll Buttons ---
  function setupProgressBar() {
    var scrollBtns = document.getElementById('scrollButtons');

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progress + '%';

      if (scrollBtns) {
        if (scrollTop > 300) {
          scrollBtns.classList.add('visible');
        } else {
          scrollBtns.classList.remove('visible');
        }
      }
    });

    var topBtn = document.getElementById('scrollTopBtn');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    var bottomBtn = document.getElementById('scrollBottomBtn');
    if (bottomBtn) {
      bottomBtn.addEventListener('click', function () {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    }
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
          if (next) {
            next.classList.add('expanded');
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (cards[0]) {
          cards[0].classList.add('expanded');
          cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('verse-card')) prev = prev.previousElementSibling;
          if (prev) {
            prev.classList.add('expanded');
            prev.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Initialize ---
  function init() {
    renderDhyana();
    renderStotram();
    renderPhalashruti();
    renderNames();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupKeyboardNav();

    // PDF download button
    var pdfBtn = document.getElementById('download-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', function () { generatePDF(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
