/**
 * PaddySpeaks — the Sacred Library's three views (/sacred/).
 *
 * Moved unchanged from the homepage's inline script when the homepage became a
 * map (docs/HOMEPAGE-MAP-REDESIGN.md); only the hrefs became absolute. The
 * page is complete without it: the texts are also listed by the search index
 * and every card is a plain link once built.
 *
 *   mandala  — 23 nodes in four quadrants; first tap shows the detail panel
 *   timeline — the same texts along six eras
 *   cards    — the same texts as a grid (phones open here)
 */
(function () {
  var sacredTexts = [
          // ── Vedic Hymns (top quadrant, ~315° to 45°) ──
          { id:'rudram', href:'/rudramchamakam/', name:'Sri Rudram', sanskrit:'रुद्रम्', symbol:'रु', category:'vedic',
            desc:'The supreme Vedic hymn to Lord Rudra from the Krishna Yajurveda — 11 Anuvakas of Namakam and 11 of Chamakam.',
            quote:'The Vedas didn\'t whisper Rudra\'s name — they thundered it.' },
          { id:'mahanyasam', href:'/mahAnyAsam/', name:'Mahanyasam', sanskrit:'न्यासम्', symbol:'म', category:'vedic',
            desc:'The Great Vedic Self-Consecration — 21 sections of mantras from the Taittiriya tradition.',
            quote:'Before you pour sacred water on Shiva, the Vedas ask you to become the temple yourself.' },
          { id:'purusha', href:'/purusha-suktam/', name:'Purusha Suktam', sanskrit:'पुरुषः', symbol:'पु', category:'vedic',
            desc:'The Hymn of the Cosmic Being — 16 mantras from Rig Veda 10.90.',
            quote:'All beings are but one quarter of Him. Three quarters are immortal in heaven.' },
          { id:'sri-suktam', href:'/sri-suktam/', name:'Sri Suktam', sanskrit:'श्रीः', symbol:'श्री', category:'vedic',
            desc:'The Hymn of Divine Prosperity — 19 mantras from the Rig Veda Khilani invoking Goddess Lakshmi.',
            quote:'When you invoke Her, it is not wealth that arrives. It is the grace that makes you worthy of it.' },
          { id:'sandhya', href:'/sandhyavandanam/', name:'Sandhyavandanam', sanskrit:'सन्ध्या', symbol:'स', category:'vedic',
            desc:'A Forgotten Science — 50 curated Q&A exploring the Vedic daily practice.',
            quote:'The sun doesn\'t need your prayer to rise. But you need the prayer to rise with it.' },
          { id:'durga-suktam', href:'/durga-suktam/', name:'Durga Suktam', sanskrit:'दुर्गा', symbol:'दु', category:'vedic',
            desc:'The Hymn of the Invincible Goddess — 9 mantras from the Mahanarayana Upanishad invoking Agni-Durga.',
            quote:'The Veda does not promise the absence of storms — it promises a boat.' },
          { id:'medha-suktam', href:'/medha-suktam/', name:'Medha Suktam', sanskrit:'मेधा', symbol:'मे', category:'vedic',
            desc:'The Hymn of Divine Intelligence — 11 mantras from the Mahanarayana Upanishad invoking Medha.',
            quote:'The Veda\'s boldest claim: that the sharpest mind is not built — it is invoked.' },
          { id:'navagraha', href:'/navagraha/', name:'Navagraha Slokas', sanskrit:'नवग्रहस्तोत्राणि', symbol:'न', category:'vedic',
            desc:'Hymns to the Nine Celestial Bodies — Navagraha Suktam & Peedahara Stotram with word-by-word meanings.',
            quote:'The planets don\'t rule you — but the wise still bow to them, turning fate into grace.' },

          // ── Stotras (right quadrant, ~45° to 135°) ──
          { id:'lalitha', href:'/lalitha-sahasranama/', name:'Lalitha Sahasranama', sanskrit:'ललिता', symbol:'ल', category:'stotra',
            desc:'The Thousand Divine Names of the Supreme Goddess — interactive chanting guide from the Brahmanda Purana.',
            quote:'Each name is a vibration, a key that unlocks a dimension of the Divine Mother within you.' },
          { id:'vishnu', href:'/vishnu-sahasranama/', name:'Vishnu Sahasranama', sanskrit:'विष्णुः', symbol:'वि', category:'stotra',
            desc:'The Thousand Names of Lord Vishnu from the Mahabharata with Shankaracharya\'s Bhashya.',
            quote:'Bhishma lay on a bed of arrows, yet chose to gift the world a thousand names of peace.' },
          { id:'soundarya', href:'/soundarya-Lahari/', name:'Soundarya Lahari', sanskrit:'सौन्दर्य', symbol:'सौ', category:'stotra',
            desc:'The Wave of Beauty — all 103 verses by Adi Shankaracharya with Sri Vidya interpretations.',
            quote:'Even Advaita bows before the Mother.' },
          { id:'rama-raksha', href:'/rama-raksha-stotram/', name:'Rama Raksha Stotram', sanskrit:'राम', symbol:'रा', category:'stotra',
            desc:'The Vajra Panjara (Diamond Cage) of Lord Rama — 38 verses of divine protection.',
            quote:'Rama doesn\'t just protect — He becomes the fortress around you.' },
          { id:'aditya', href:'/aditya-hridayam/', name:'Aditya Hridayam', sanskrit:'आदित्य', symbol:'आ', category:'stotra',
            desc:'The Heart of the Sun God — 31 verses from the Valmiki Ramayana.',
            quote:'The gods sent a sage, not a weapon. Because the greatest weapon is the light you invoke from within.' },
          { id:'subramanya', href:'/subramanya-bhujangam/', name:'Subramanya Bhujangam', sanskrit:'सुब्रह्मण्य', symbol:'सु', category:'stotra',
            desc:'Adi Shankaracharya\'s serpentine hymn to Lord Subramanya — 33 verses with Sanskrit, transliteration and meaning.',
            quote:'I know not words, I know not their meanings … yet wondrous words flow from my mouth.' },

          // ── Devotional (bottom quadrant, ~135° to 225°) ──
          { id:'hanuman', href:'/hanumanchalisa/', name:'Hanuman Chalisa', sanskrit:'हनुमान', symbol:'ह', category:'devotional',
            desc:'The beloved 40 verses by Goswami Tulsidas praising Lord Hanuman.',
            quote:'Tulsidas didn\'t write a hymn. He wrote a hug for God.' },
          { id:'bajrang-baan', href:'/bajrang-baan/', name:'Bajrang Baan', sanskrit:'बजरंग', symbol:'ब', category:'devotional',
            desc:'The Arrow of Hanuman — Goswami Tulsidas\'s fierce and urgent prayer invoking Hanuman\'s immediate protection.',
            quote:'The Chalisa is a hug. The Bajrang Baan is an arrow — aimed straight at your suffering.' },
          { id:'abhirami', href:'/abhirami-andhadhi/', name:'Abhirami Andhadhi', sanskrit:'அபிராமி', symbol:'அ', category:'devotional',
            desc:'100 verses of devotion to Goddess Abhirami by Abhirami Bhattar.',
            quote:'Bhattar didn\'t compose these verses — he wept them.' },
          { id:'shashti', href:'/shashtikavacham/', name:'Kanda Shashti Kavacham', sanskrit:'கந்த', symbol:'க', category:'devotional',
            desc:'The protective armour of Lord Murugan by Devaraya Swamigal at Thiruchendur.',
            quote:'Every syllable is a spear of Murugan standing guard over your life.' },
          { id:'narayaneeyam', href:'/narayaneeyam/', name:'Narayaneeyam', sanskrit:'नारा', symbol:'ना', category:'devotional',
            desc:'1,034 verses condensing Srimad Bhagavatam — composed at Guruvayur Temple in 1586 CE.',
            quote:'A paralyzed poet condensed 18,000 verses into 1,034 — and walked out healed.' },
          { id:'apaduddharaka', href:'/ApaduddharakaStotram/', name:'Apaduddharaka Stotram', sanskrit:'आपदु', symbol:'आपु', category:'devotional',
            desc:'Prayer to Lord Rama for deliverance from calamities — two traditional versions compared.',
            quote:'Rama is already standing on the other side, holding the door open.' },

          // ── Philosophy & Ritual (left quadrant, ~225° to 315°) ──
          { id:'gita', href:'/bhagavad-gita/', name:'Srimad Bhagavad Gita', sanskrit:'गीता', symbol:'गी', category:'philosophy',
            desc:'The Song of the Supreme — with word-by-word breakdown, translations, and modern interpretations.',
            quote:'The Gita is not a book you finish. It is a book that finishes you.' },
          { id:'bhaja', href:'/bhaja-govindam/', name:'Bhaja Govindam', sanskrit:'भज', symbol:'भ', category:'philosophy',
            desc:'The Hammer that Shatters Delusion — Adi Shankaracharya\'s 31 verses of awakening.',
            quote:'He wrote it for the old man inside every scholar — the one still memorizing rules while life slips away.' },
          { id:'tharpanam', href:'/amavasya-tharpanam/', name:'Amavasya Tharpanam', sanskrit:'तर्पण', symbol:'त', category:'philosophy',
            desc:'The sacred Vedic ritual of offering water and sesame to ancestors on the new moon day.',
            quote:'A handful of water and sesame — this is how the living keep the departed alive.' }
      ];

  /* ═══════════════════════════════════════ */
  /* SACRED TEXTS MANDALA                    */
  /* ═══════════════════════════════════════ */
  (function() {
      var wheel = document.getElementById('mandala-wheel');
      var detail = document.getElementById('mandala-detail');
      var detailTitle = document.getElementById('mandala-detail-title');
      var detailSanskrit = document.getElementById('mandala-detail-sanskrit');
      var detailDesc = document.getElementById('mandala-detail-desc');
      var detailQuote = document.getElementById('mandala-detail-quote');
      var detailLink = document.getElementById('mandala-detail-link');
      var activeNode = null;

      // Group by category for quadrant positioning
      var categories = ['vedic', 'stotra', 'devotional', 'philosophy'];
      var quadrantStart = { vedic: -90, stotra: 0, devotional: 90, philosophy: 180 };

      // Create nodes
      sacredTexts.forEach(function(text) {
          var node = document.createElement('a');
          node.href = text.href;
          node.className = 'mandala-node';
          node.setAttribute('data-category', text.category);
          node.setAttribute('data-id', text.id);
          node.innerHTML =
              '<span class="mandala-node-sanskrit">' + text.symbol + '</span>' +
              '<span class="mandala-node-tooltip">' + text.name + '</span>';

          node.addEventListener('click', function(e) {
              e.preventDefault();
              if (activeNode === node) {
                  window.location.href = text.href;
                  return;
              }
              if (activeNode) activeNode.classList.remove('active');
              activeNode = node;
              node.classList.add('active');
              showDetail(text);
          });

          wheel.appendChild(node);
      });

      function showDetail(text) {
          detailSanskrit.textContent = text.sanskrit;
          detailTitle.textContent = text.name;
          detailDesc.textContent = text.desc;
          detailQuote.textContent = '"' + text.quote + '"';
          detailLink.href = text.href;
          detail.classList.add('visible');
      }

      // Close detail when clicking outside
      document.addEventListener('click', function(e) {
          if (!e.target.closest('.mandala-node') && !e.target.closest('.mandala-detail')) {
              if (activeNode) activeNode.classList.remove('active');
              activeNode = null;
              detail.classList.remove('visible');
          }
      });

      // Position nodes in a circle by category quadrant
      function layoutNodes() {
          var rect = wheel.getBoundingClientRect();
          var cx = wheel.offsetWidth / 2;
          var cy = wheel.offsetHeight / 2;
          var radius = Math.min(cx, cy) * 0.72;

          categories.forEach(function(cat) {
              var items = sacredTexts.filter(function(t) { return t.category === cat; });
              var startAngle = quadrantStart[cat];
              var spanAngle = 90;
              var step = spanAngle / (items.length + 1);

              items.forEach(function(text, i) {
                  var angle = startAngle + step * (i + 1);
                  var rad = angle * Math.PI / 180;
                  var x = cx + radius * Math.cos(rad);
                  var y = cy + radius * Math.sin(rad);
                  var node = wheel.querySelector('[data-id="' + text.id + '"]');
                  if (node) {
                      node.style.left = x + 'px';
                      node.style.top = y + 'px';
                  }
              });
          });
      }

      layoutNodes();
      window.addEventListener('resize', layoutNodes);
  })();

  /* ═══════════════════════════════════════ */
  /* SACRED TEXTS TIMELINE                   */
  /* ═══════════════════════════════════════ */
  (function() {
      var eras = [
          { label: 'Vedic Era', date: '~1500–800 BCE', ids: ['rudram','mahanyasam','purusha','sri-suktam','sandhya','durga-suktam','medha-suktam','navagraha'] },
          { label: 'Epic Era', date: '~500 BCE – 200 CE', ids: ['vishnu','gita','aditya','rama-raksha'] },
          { label: 'Puranic Era', date: '~300–700 CE', ids: ['lalitha'] },
          { label: 'Advaita Era', date: '~8th Century CE', ids: ['soundarya','bhaja','subramanya'] },
          { label: 'Bhakti Era', date: '~1400–1700 CE', ids: ['hanuman','bajrang-baan','abhirami','narayaneeyam','shashti','apaduddharaka'] },
          { label: 'Living Traditions', date: 'Timeless', ids: ['tharpanam'] }
      ];

      var textMap = {};
      sacredTexts.forEach(function(t) { textMap[t.id] = t; });

      var river = document.getElementById('timeline-river');
      var side = 0; // alternates 0=left, 1=right

      eras.forEach(function(era) {
          // Era marker
          var eraDiv = document.createElement('div');
          eraDiv.className = 'timeline-era';
          eraDiv.innerHTML = '<span class="timeline-era-label">' + era.label + '<span class="timeline-era-date">' + era.date + '</span></span>';
          river.appendChild(eraDiv);

          // Text items in this era
          era.ids.forEach(function(id) {
              var t = textMap[id];
              if (!t) return;
              var dir = side % 2 === 0 ? 'left' : 'right';
              side++;

              var item = document.createElement('a');
              item.href = t.href;
              item.className = 'timeline-item ' + dir;
              item.innerHTML =
                  '<div class="timeline-dot"></div>' +
                  '<div class="timeline-card">' +
                      '<div class="timeline-card-symbol ' + t.category + '">' + t.symbol + '</div>' +
                      '<div class="timeline-card-name">' + t.name + '</div>' +
                      '<div class="timeline-card-sanskrit">' + t.sanskrit + '</div>' +
                      '<div class="timeline-card-desc">' + t.desc + '</div>' +
                      '<div class="timeline-card-quote">"' + t.quote + '"</div>' +
                      '<span class="timeline-card-explore">Explore</span>' +
                  '</div>';
              river.appendChild(item);
          });
      });

      // End marker
      var endDiv = document.createElement('div');
      endDiv.className = 'timeline-end';
      endDiv.innerHTML = '<div class="timeline-end-diamond"></div><div class="timeline-end-text">You are here</div>';
      river.appendChild(endDiv);
  })();

  /* ═══════════════════════════════════════ */
  /* SACRED TEXTS CARDS VIEW                 */
  /* ═══════════════════════════════════════ */
  (function() {
      var grid = document.getElementById('sacred-cards-grid');
      if (!grid) return;
      var categoryLabels = { vedic: 'Vedic Hymns', stotra: 'Stotras', devotional: 'Devotional', philosophy: 'Philosophy & Ritual' };
      sacredTexts.forEach(function(t) {
          var card = document.createElement('a');
          card.href = t.href;
          card.className = 'sacred-card sacred-card-' + t.category;
          card.innerHTML =
              '<div class="sacred-card-symbol">' + t.symbol + '</div>' +
              '<div class="sacred-card-category">' + (categoryLabels[t.category] || t.category) + '</div>' +
              '<h4 class="sacred-card-name">' + t.name + '</h4>' +
              '<div class="sacred-card-sanskrit">' + t.sanskrit + '</div>' +
              '<p class="sacred-card-desc">' + t.desc + '</p>' +
              '<p class="sacred-card-quote">&ldquo;' + t.quote + '&rdquo;</p>';
          grid.appendChild(card);
      });
  })();

  /* ═══════════════════════════════════════ */
  /* VIEW TOGGLE LOGIC                       */
  /* ═══════════════════════════════════════ */
  (function() {
      var btns = document.querySelectorAll('.sacred-view-btn');
      var views = document.querySelectorAll('.sacred-view');
      btns.forEach(function(btn) {
          btn.addEventListener('click', function() {
              var target = btn.getAttribute('data-view');
              btns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
              btn.classList.add('active');
              btn.setAttribute('aria-pressed', 'true');
              views.forEach(function(v) {
                  v.style.display = v.id === 'sacred-view-' + target ? '' : 'none';
              });
          });
      });
      // On a phone the 23-node wheel is too small to read or tap, so it opens on
      // Cards; the mandala is still one tap away.
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
          var cardsBtn = document.querySelector('.sacred-view-btn[data-view="cards"]');
          if (cardsBtn) cardsBtn.click();
      }
  })();

})();
