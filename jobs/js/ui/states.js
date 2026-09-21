/**
 * JobSignal — empty, zero-result and ambiguous states.
 *
 * A search never silently broadens. When nothing matches, each option says
 * exactly what it would add and how many roles that is, and the user chooses.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, F = global.JSFormat;

  function boardEmpty() {
    return el('div', { class: 'jsEmpty' }, [
      el('h2', { text: 'The board is still filling.' }),
      el('p', { text: 'No roles have been ingested yet. JobSignal will not show a job it cannot currently reach at the employer, so it shows nothing rather than filling the page with samples.' }),
      el('div', { class: 'jsEmpty-acts' }, [
        el('a', { class: 'jsBtn jsBtn--ghost', href: '/jobs/methodology/', text: 'How verification works' })
      ])
    ]);
  }

  function failed() {
    return el('div', { class: 'jsEmpty' }, [
      el('h2', { text: 'The board could not be loaded.' }),
      el('p', { text: 'The job index did not load. Please try again in a moment.' })
    ]);
  }

  /**
   * Zero results. `broadenings` is [{label, count, apply}] — each already
   * counted against the real index, so no option promises results it cannot
   * deliver, and nothing widens on its own.
   */
  /** "No verified Data Engineering roles in Pittsburgh."

      A family label is a field, not a noun phrase, so joining it straight into
      the sentence produced "No verified Data Engineering found in Pittsburgh."
      The noun goes in, and an unrecognised query is quoted as something the
      search matched against rather than dressed up as a job family. */
  function headline(intent) {
    var lvl = intent.level ? F.level(intent.level) + ' ' : '';
    if (intent.family) {
      var fam = global.JSSearch.FAMILY_LABEL[intent.family] || intent.family;
      return 'No verified ' + lvl + fam + ' roles';
    }
    if (intent.raw) {
      return 'No verified ' + lvl + 'roles matching “' + intent.raw + '”';
    }
    return 'No verified ' + lvl + 'roles';
  }

  function noResults(intent, broadenings) {
    var where = intent.location
      ? ' in ' + (intent.location.city || intent.location.region || intent.location.country)
      : intent.remote === 'remote' ? ' that are remote' : '';

    var acts = (broadenings || []).filter(function (b) { return b.count > 0; }).map(function (b) {
      var btn = el('button', { class: 'jsBtn jsBtn--ghost', type: 'button' }, [
        el('span', { text: b.label }),
        el('span', { style: 'color:var(--ink-3);font-weight:500', text: '(' + b.count + ')' })
      ]);
      btn.addEventListener('click', b.apply);
      return btn;
    });

    return el('div', { class: 'jsEmpty' }, [
      el('h2', { text: headline(intent) + where + '.' }),
      el('p', { text: acts.length
        ? 'Nothing here is broadened automatically. Each option below says exactly what it adds.'
        : 'Every role here has to be confirmed at the employer before it is shown, so a narrow search can legitimately come back empty.' }),
      acts.length ? el('div', { class: 'jsEmpty-acts' }, acts) : null
    ]);
  }

  /** A bare role word spans several families — ask rather than dump the board. */
  function ambiguous(word, families, onPick) {
    var chips = Object.keys(families)
      .sort(function (a, b) { return families[b] - families[a]; })
      .slice(0, 6)
      .map(function (f) {
        var btn = el('button', { class: 'jsChip', type: 'button' }, [
          el('span', { text: global.JSSearch.FAMILY_LABEL[f] || f }),
          el('span', { style: 'color:var(--ink-3)', text: String(families[f]) })
        ]);
        btn.addEventListener('click', function () { onPick(f); });
        return btn;
      });

    return el('div', { class: 'jsEmpty', style: 'text-align:left' }, [
      el('h2', { text: '“' + word + '” spans several kinds of job.' }),
      el('p', { style: 'margin-left:0', text: 'Rather than return every one of them, pick the kind you mean:' }),
      el('div', { class: 'jsChips', style: 'margin-top:16px' }, chips)
    ]);
  }

  function skeletonList(n) {
    var wrap = el('div', { class: 'jsResults' });
    for (var i = 0; i < (n || 4); i++) wrap.appendChild(global.JSCard.skeleton());
    return wrap;
  }

  global.JSStates = {
    boardEmpty: boardEmpty, failed: failed, noResults: noResults,
    ambiguous: ambiguous, skeletonList: skeletonList
  };
})(window);
