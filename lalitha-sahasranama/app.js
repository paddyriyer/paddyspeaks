// Sri Lalitha Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

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
        html += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
        html += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
        html += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
        html += '</div>';
        html += '</div>';
      });
      results.innerHTML = html;
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

  // --- Reading Progress ---
  function setupProgressBar() {
    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('progressBar').style.width = progress + '%';
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
    renderNyasa();
    renderDhyana();
    renderStotram();
    renderNames();
    setupSearch();
    setupNavigation();
    setupProgressBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
