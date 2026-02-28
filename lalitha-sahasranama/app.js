// Sri Lalitha Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

  // --- Name-to-Verse Mapping ---
  // Traditional mapping of which divine names appear in each shloka
  // Based on the standard Brahmanda Purana text
    const VERSE_NAMES = {
      1: [1,2,3,4,5,6],
      2: [7,8,9,10],
      3: [11,12,13],
      4: [14,15],
      5: [16,17],
      6: [18,19],
      7: [20,21],
      8: [22,23],
      9: [24,25],
      10: [26,27],
      11: [28,29],
      12: [30,31],
      13: [32,33],
      14: [34,35],
      15: [36,37],
      16: [38,39],
      17: [40,41],
      18: [42,43,44],
      19: [45,46],
      20: [47,48,49],
      21: [50,51,52,53,54],
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
      37: [92,93,94,95,96,97,98,99],
      38: [100,101,102,103],
      39: [104,105,106,107],
      40: [108,109,110,111,112],
      41: [113,114,115,116,117],
      42: [118,119,120,121,122,123,124,125,126],
      43: [127,128,129,130,131,132,133,134,135],
      44: [136,137,138,139,140,141,142,143,144,145,146,147],
      45: [148,149,150,151,152,153,154,155,156],
      46: [157,158,159,160,161,162,163,164],
      47: [165,166,167,168,169,170,171,172,173],
      48: [174,175,176,177,178,179,180,181,182],
      49: [183,184,185,186,187,188,189,190,191],
      50: [192,193,194,195,196,197,198,199,200,201],
      51: [202,203,204,205,206,207],
      52: [208,209,210,211,212,213],
      53: [214,215,216,217,218,219],
      54: [220,221,222,223,224,225],
      55: [226,227,228,229,230],
      56: [231,232,233,234,235,236],
      57: [237,238,239],
      58: [240,241,242],
      59: [243,244,245,246,247,248],
      60: [249,250,251,252,253],
      61: [254,255,256,257,258],
      62: [259,260,261,262,263,264],
      63: [265,266,267,268,269,270,271,272,273],
      64: [274,275,276,277,278],
      65: [279,280,281,282,283,284],
      66: [285,286,287,288],
      67: [289,290,291,292],
      68: [293,294],
      69: [295,296,297,298,299,300],
      70: [301,302,303,304,305,306,307,308],
      71: [309,310,311,312,313,314,315,316,317],
      72: [318,319,320,321,322,323,324,325,326],
      73: [327,328,329,330,331,332],
      74: [333,334,335,336,337,338,339,340],
      75: [341,342,343,344,345,346,347,348],
      76: [349,350,351,352,353],
      77: [354,355,356,357,358,359,360,361],
      78: [362,363,364,365],
      79: [366,367,368,369,370],
      80: [371,372,373],
      81: [374,375,376,377,378,379,380,381],
      82: [382,383,384,385,386,387],
      83: [388,389,390,391],
      84: [392,393,394,395,396],
      85: [397,398,399,400,401],
      86: [402,403,404,405,406,407],
      87: [408,409,410,411],
      88: [412,413,414,415,416],
      89: [417,418,419,420,421,422,423,424],
      90: [425,426,427,428,429,430,431,432],
      91: [433,434,435,436,437,438],
      92: [439,440,441,442],
      93: [443,444,445,446,447,448],
      94: [449,450,451,452,453,454,455,456],
      95: [457,458,459,460,461,462,463,464],
      96: [465,466,467,468,469,470,471,472,473,474],
      97: [475,476,477,478,479,480,481,482],
      98: [483,484,485,486],
      99: [487,488,489,490,491],
      100: [492,493,494,495,496],
      101: [497,498,499,500],
      102: [501,502,503,504],
      103: [505,506,507,508,509],
      104: [510,511,512,513],
      105: [514,515,516,517,518],
      106: [519,520,521,522],
      107: [523,524,525,526,527],
      108: [528,529,530,531],
      109: [532,533,534,535,536],
      110: [537,538,539,540,541,542],
      111: [543,544,545,546,547,548],
      112: [549,550,551,552,553],
      113: [554,555,556,557,558],
      114: [559,560,561,562,563,564,565,566],
      115: [567,568,569,570,571],
      116: [572,573,574,575,576,577,578,579,580],
      117: [581,582,583,584],
      118: [585,586,587,588,589,590,591,592],
      119: [593,594,595,596],
      120: [597,598,599,600,601,602],
      121: [603,604,605,606],
      122: [607,608,609,610],
      123: [611,612,613,614],
      124: [615,616,617,618,619],
      125: [620,621,622,623,624,625,626,627],
      126: [628,629,630,631,632,633,634,635],
      127: [636,637,638,639,640,641],
      128: [642,643,644,645],
      129: [646,647,648,649,650,651,652,653,654,655],
      130: [656,657,658,659],
      131: [660,661,662,663,664,665],
      132: [666,667,668,669,670,671,672,673,674,675],
      133: [676,677,678,679,680,681,682,683,684],
      134: [685,686,687,688,689],
      135: [690,691,692,693,694,695],
      136: [696,697,698,699,700,701],
      137: [702,703,704,705,706,707,708,709],
      138: [710,711,712,713,714],
      139: [715,716,717,718,719,720,721,722,723,724],
      140: [725,726,727,728,729],
      141: [730,731,732,733,734,735],
      142: [736,737,738,739,740,741,742,743],
      143: [744,745,746,747],
      144: [748,749,750],
      145: [751,752,753,754,755,756,757,758],
      146: [759,760,761,762,763,764,765,766],
      147: [767,768,769,770,771,772,773,774],
      148: [775,776,777,778,779,780],
      149: [781,782,783,784,785,786,787,788,789],
      150: [790,791,792,793,794,795],
      151: [796,797,798,799,800,801],
      152: [802,803,804,805,806,807,808,809,810,811],
      153: [812,813,814,815,816,817,818,819],
      154: [820,821,822,823,824,825],
      155: [826,827,828,829,830,831,832,833,834],
      156: [835,836,837,838,839,840,841,842],
      157: [843,844,845,846,847,848],
      158: [849,850,851,852,853,854],
      159: [855,856,857],
      160: [858,859,860,861,862,863,864,865],
      161: [866,867,868,869],
      162: [870,871,872,873,874,875],
      163: [876,877,878,879,880,881,882,883,884],
      164: [885,886,887,888],
      165: [889,890,891,892,893,894],
      166: [895,896,897,898,899,900,901,902],
      167: [903,904,905,906,907,908,909,910,911],
      168: [912,913,914,915,916,917],
      169: [918,919,920,921,922,923],
      170: [924,925,926,927,928],
      171: [929,930,931],
      172: [932,933,934,935,936,937,938,939],
      173: [940,941,942,943,944,945,946,947,948],
      174: [949,950,951,952,953,954],
      175: [955,956,957,958,959,960,961],
      176: [962,963,964,965,966,967,968,969,970],
      177: [971,972,973,974,975,976,977],
      178: [978,979,980,981,982],
      179: [983,984,985,986,987],
      180: [988,989,990,991,992,993],
      181: [994,995,996],
      182: [997,998,999,1000]
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

      // Build shloka text display
      var shlokaHtml = '<div class="shloka-text">';
      halves.forEach(function (half, idx) {
        shlokaHtml += '<span class="shloka-line">' + escapeHtml(half) + '</span>';
        if (idx < halves.length - 1) {
          shlokaHtml += '<span class="shloka-separator">|</span>';
        }
      });
      shlokaHtml += '<span class="shloka-separator">|| ' + verseNum + ' ||</span>';
      shlokaHtml += '</div>';

      // Build names breakdown
      var namesHtml = '<div class="names-breakdown">';
      nameNums.forEach(function (nNum) {
        var name = namesMap[nNum];
        if (name) {
          namesHtml += '<div class="name-row">';
          namesHtml += '<span class="name-num">' + nNum + '.</span>';
          namesHtml += '<div class="name-details">';
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
