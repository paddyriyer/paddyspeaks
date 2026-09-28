# FlightDeck — Multi-Persona AI Operating System for Work

`/ic-flightdeck/` is a self-contained static demo (no build step, no backend,
no network calls beyond Chart.js and Google Fonts). It is **not** rendered by
`pages.py` and it does not use `style.css` — everything it needs is in its own
files.

```
ic-flightdeck/
  index.html      core shell: tokens, CSS, visual primitives, router,
                  the demo dataset and the IC (Individual Contributor) deck
  p-team.js       Team FlightDeck        — Daniel Kim, Engineering Manager
  p-workforce.js  Workforce FlightDeck   — People & Skills / workforce planning
  p-tower.js      Agent Control Tower    — AI platform / AgentOps
  p-exec.js       Executive Briefing     — leadership, business signals only
```

## The one rule that shapes everything

**Four personas, four different cockpits — never four copies of one dashboard.**
Each deck is built around the decision its persona actually makes:

| Persona | Question it answers |
|---|---|
| IC — *My FlightDeck* | Am I working on the right things, and ready for what comes next? |
| Manager — *Team FlightDeck* | Is my team succeeding, and where do they need me? |
| Workforce — *Workforce FlightDeck* | Do we have the capabilities the company will need tomorrow? |
| AI Platform — *Agent Control Tower* | Are our human and agent workflows delivering safely and on time? |
| Executive — *Executive Briefing* | What should leadership know, and decide? |

If a module would read the same in two decks, it belongs in one of them.
The Manager deck's centrepiece is *"Where does my team need me?"* — specific
asks with named next actions — not eight miniature copies of Maya's cockpit.
The Executive deck is deliberately the smallest file in the directory.

## Privacy architecture — the non-negotiable

**Higher organizational authority must NOT automatically mean greater personal
data access.** Seniority moves you *outward* (more people, more aggregation),
never *inward* (more intimate detail). The layers:

```
PRIVATE EMPLOYEE DATA   → only the employee (vault, notes, career anxiety, AI chats)
EMPLOYEE-SHARED DATA    → what the employee explicitly shared with their manager
TEAM OPERATIONAL DATA   → work, blockers, delivery — never private feelings
AGGREGATED WORKFORCE    → cohorts and capabilities — never a named individual
EXECUTIVE SIGNALS       → business outcomes only
```

- A VP cannot open Maya's private cockpit. There is no path in the UI, because
  there is no such path in the model.
- The Team deck marks shared material **SHARED ONLY** and every drawer lists
  *what this view does not contain*.
- The Workforce deck is aggregated-only and states *what this deck will never
  produce*.
- The Executive briefing carries an explicit *"what this briefing deliberately
  does not contain"* panel.
- The persona menu footer says it plainly: switching cockpit never widens what
  anyone can see.

## AI guardrails (carried into every deck)

Never automatically: rank employees, build leaderboards, predict layoffs, or
recommend termination, salary, bonus or promotion. Never assess personality or
infer loyalty, health, disability, pregnancy, religion, politics, union
activity or emotional stability. Never infer productivity from hours online,
keystrokes, commit count, ticket volume or lines of code.

The AI distinguishes **ACTIVITY / OUTPUT / OUTCOME / IMPACT** and says which it
is looking at. Exposure is always framed as *task change*, never human worth —
no one is "replaceable", "obsolete" or "at risk". Skill maps are labelled
**NOT A RANKING** because that is what they are.

## How the personas load

`index.html` holds a registry; each extra deck is a lazily injected classic
script (not an ES module — those are CORS-blocked under `file://`).

```js
PERSONAS  // id, deck name, who, role, org, initials, tone, src, question
registerDeck(id, {nav, views, strip, home, charts})
setPersona(id, wantedView)   // loads the module on first switch
```

Routing is `#persona/view`; a bare `#view` means the IC deck, so every old
link still works. A module that fails to load degrades to an honest
"this cockpit could not load" panel rather than crashing the shell.

Because top-level `const`/`function` in classic scripts share one global
lexical environment, persona modules use the core's primitives directly and
prefix their own symbols (`TEAM_*`, `WF_*`, `TW_*`, `EX_*`) to avoid
collisions.

## Visual language

Graphics carry the meaning; text supports it. Some information whispers, some
shouts — deliberately, through size, colour and position rather than through
more words. Shared primitives live in `index.html`: `spark`, `heroStrip`,
`timeline`, `flowMap`, `riskMatrix`, `radar`, `covMatrix`, `pulse`, `ribbon`,
`miniBar`, `donut`, `meter`, `chip`, `tag`, `provRow`, `aiNote`, `emptyState`.

Two rules that are easy to break and were broken more than once:

- **Text wears text tokens, never the series colour.** Chart hues are tuned to
  sit on a surface as a *mark*; as small text they fall under 4.5:1. Anything
  that prints a number in a series colour must map it through `textInk()`
  first.
- **Dimming is not a state signal.** Use a border, a label or a shape.

The deck honours `prefers-reduced-motion`, and `markScrollables()` gives a tab
stop, a role and a label to any container that actually overflows (and removes
them when it does not).

## Before you push a change here

```bash
node  /tmp/smoke/all-personas.js     # if you still have it: 55 views, 5 personas, 1500px + 400px
python3 scripts/platform_build/build.py check
python3 .github/scripts/validate_content.py
```

`build.py check` is the real CI gate — `validate_content.py` alone is not
enough (that lesson cost a red run on #883). Everything under `/ic-flightdeck/`
is demo data about a fictional employee at a fictional company; there is no
real person's information anywhere in it.
