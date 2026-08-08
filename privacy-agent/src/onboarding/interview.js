/**
 * Guided onboarding (spec item 1).
 *
 * The requirement is explicit: no giant form. Ask in small groups, explain why
 * each item helps, and let the user skip anything.
 *
 * The "why" text is not decoration. Someone is being asked to type their home
 * address and their relatives' names into a program, which is a reasonable
 * thing to hesitate over. The honest answer to "why do you need this" is
 * usually "so I can tell you apart from the other 400 people with your name",
 * and saying so is what earns the answer. Where an item is genuinely optional
 * we say what degrades without it, rather than implying it is required.
 *
 * Groups are ordered by (value ÷ intrusiveness): the cheap, high-yield things
 * first, so a user who bails after two groups still gets a useful run.
 *
 * Pure data + pure helpers — no I/O, so the CLI, the dashboard and the tests
 * all drive the same script.
 */

export const GROUPS = [
  {
    id: 'identity',
    title: 'Who we are looking for',
    intro: 'Starting with the basics. Everything here is optional, but the more you give, the better the agent can tell your records apart from someone else with your name.',
    questions: [
      {
        key: 'fullName',
        prompt: 'Your full legal name',
        why: 'This is the anchor for the whole search. Records are filed under legal names far more often than the name people actually use.',
        type: 'text',
        required: true,
      },
      {
        key: 'nameVariations',
        prompt: 'Other names you go by',
        why: 'Nicknames, anglicised or shortened forms, a middle name used as a first name. Brokers store whatever they scraped, so a record under "Bob" will not surface from a search for "Robert".',
        type: 'list',
        example: 'Bob Smith, R.J. Smith',
      },
      {
        key: 'previousNames',
        prompt: 'Any previous names',
        why: 'Maiden names and names changed by marriage, divorce or deed poll. Old records keep the old name indefinitely, and these are often the listings people are most surprised to find.',
        type: 'list',
        sensitive: true,
      },
    ],
  },
  {
    id: 'contact',
    title: 'How you can be contacted',
    intro: 'Phone numbers and email addresses are the sharpest tools we have — they are close to unique, so a match on one is strong evidence a record is really yours.',
    questions: [
      {
        key: 'primaryEmail',
        prompt: 'Your main email address',
        why: 'Used two ways: to search for pages that publish it, and — with your permission, later — to find the confirmation emails that removal forms send.',
        type: 'email',
      },
      {
        key: 'alternateEmails',
        prompt: 'Other email addresses',
        why: 'Old work addresses and abandoned accounts are frequently attached to stale records that are still online.',
        type: 'list',
      },
      {
        key: 'phone',
        prompt: 'Your current phone number',
        why: 'A phone-number search finds listings that a name search never will, because they are indexed by number rather than by person.',
        type: 'phone',
      },
      {
        key: 'previousPhones',
        prompt: 'Previous phone numbers',
        why: 'Old numbers stay attached to old records long after the line is disconnected.',
        type: 'list',
      },
    ],
  },
  {
    id: 'location',
    title: 'Where you live, and where you have lived',
    intro: 'This is the most sensitive group, and the most useful. Address history is what data brokers organise their records around — it is also how we prove a listing is yours rather than a stranger’s.',
    questions: [
      {
        key: 'address',
        prompt: 'Your current address',
        why: 'The single strongest way to confirm a record is yours. It stays encrypted on this machine and is only ever typed into a removal form you can watch.',
        type: 'text',
        sensitive: true,
      },
      {
        key: 'previousAddresses',
        prompt: 'Addresses you have lived at before',
        why: 'Brokers list address history going back decades. Without these, records tied to where you lived in 2011 stay invisible to the search.',
        type: 'list',
        sensitive: true,
      },
      {
        key: 'cityState',
        prompt: 'City and state, if you would rather not give a street address',
        why: 'Much weaker than a full address, but still enough to separate you from same-named people in other parts of the country.',
        type: 'text',
        skipHint: 'A reasonable middle ground if the full address feels like too much.',
      },
    ],
  },
  {
    id: 'age',
    title: 'Roughly how old you are',
    intro: 'Almost every people-search record prints an age. It is the fastest way to rule *out* a wrong match.',
    questions: [
      {
        key: 'birthYear',
        prompt: 'Year of birth',
        why: 'Just the year — never the full date. A year is enough to discriminate between people and much less useful to anyone who might misuse it.',
        type: 'year',
      },
      {
        key: 'approxAge',
        prompt: 'Or your approximate age',
        why: 'If you would rather not give a year. We treat this as a range of a few years either way, so it corroborates without producing false conflicts.',
        type: 'number',
        skipHint: 'Skip if you gave a birth year.',
      },
    ],
  },
  {
    id: 'online',
    title: 'Your online presence',
    intro: 'Handles and profile links let us search sideways — from a username to the forums, directories and profile aggregators that reuse it.',
    questions: [
      {
        key: 'usernames',
        prompt: 'Usernames and handles you use',
        why: 'Anything reused across sites. One handle often unravels a whole set of profiles you had forgotten about.',
        type: 'list',
      },
      {
        key: 'profiles',
        prompt: 'Public profiles you know about',
        why: 'LinkedIn, GitHub, a personal site. Two reasons: they get searched as identifiers, and we mark them as *yours to edit* so the agent never files a removal against your own page.',
        type: 'list',
      },
    ],
  },
  {
    id: 'context',
    title: 'Work, school and family',
    intro: 'These are corroborating details. They rarely turn up new pages on their own, but they are often what settles whether an ambiguous listing is you.',
    questions: [
      {
        key: 'employers',
        prompt: 'Current and previous employers',
        why: 'Staff pages, press releases and conference listings. Also how brokers distinguish two people with the same name in the same city.',
        type: 'list',
      },
      {
        key: 'schools',
        prompt: 'Schools or universities',
        why: 'Alumni directories are a common and long-lived source of exposure.',
        type: 'list',
      },
      {
        key: 'relatives',
        prompt: 'Names of close relatives',
        why: 'Broker records almost always list relatives, and matching two of them is very strong evidence. We only ever use these names to *recognise* your record — we never search for your relatives on their own behalf, and never file anything about them.',
        type: 'list',
        sensitive: true,
      },
    ],
  },
];

/** The one field without which there is nothing to search for. */
export const REQUIRED_KEYS = ['fullName'];

/**
 * Ask-time helper: what to show for one group. Kept separate from the data so
 * the CLI and the web dashboard render the same script differently without
 * either owning the copy.
 */
export function groupById(id) {
  return GROUPS.find((g) => g.id === id) || null;
}

export function nextGroup(answeredGroupIds = []) {
  return GROUPS.find((g) => !answeredGroupIds.includes(g.id)) || null;
}

/**
 * Coerce raw answers into the shape buildProfile expects.
 *
 * Skipped answers are *absent*, never empty strings — the difference matters
 * downstream, where a present-but-empty value would be treated as a real
 * attribute that nothing can match.
 */
export function normalizeAnswers(raw = {}) {
  const out = {};
  for (const group of GROUPS) {
    for (const q of group.questions) {
      const value = raw[q.key];
      if (value == null) continue;

      if (q.type === 'list') {
        const list = Array.isArray(value)
          ? value
          : String(value).split(/[,;\n]/);
        const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
        if (cleaned.length) out[q.key] = cleaned;
        continue;
      }

      const s = String(value).trim();
      if (!s) continue;

      if (q.type === 'year' || q.type === 'number') {
        const n = Number(s.replace(/\D/g, ''));
        if (Number.isFinite(n) && n > 0) out[q.key] = n;
        continue;
      }
      out[q.key] = s;
    }
  }
  return out;
}

/**
 * Tell the user what their answers can and cannot do, before the run starts.
 *
 * This exists so nobody discovers after an hour that skipping the address is
 * why half their results came back "ambiguous". Better to say it up front.
 */
export function assessCoverage(answers = {}) {
  const has = (k) => answers[k] != null && (!Array.isArray(answers[k]) || answers[k].length > 0);
  const gaps = [];
  let strength = 0;

  if (!has('fullName')) {
    return {
      ok: false,
      strength: 0,
      gaps: ['We need at least a name to search for.'],
      summary: 'Not enough to start.',
    };
  }
  strength += 25;

  if (has('address') || has('previousAddresses')) strength += 25;
  else if (has('cityState')) { strength += 12; gaps.push('Without a street address, listings that print one can only be matched at city level — expect more "is this you?" questions.'); }
  else gaps.push('With no location at all, we cannot separate you from same-named people. This is the single biggest thing you can add.');

  if (has('phone') || has('previousPhones')) strength += 15;
  else gaps.push('Phone-number searches find listings that name searches miss entirely.');

  if (has('primaryEmail') || has('alternateEmails')) strength += 15;
  else gaps.push('Without an email address we cannot search for it, or pick up the confirmation emails that removal forms send.');

  if (has('birthYear') || has('approxAge')) strength += 10;
  else gaps.push('Age is how we rule out wrong matches. Without it, more results land as ambiguous.');

  if (has('relatives')) strength += 5;
  if (has('usernames') || has('profiles')) strength += 5;

  return {
    ok: true,
    strength: Math.min(100, strength),
    gaps,
    summary: strength >= 75
      ? 'Good coverage — the agent should be able to confirm most matches on its own.'
      : strength >= 50
        ? 'Workable. Expect to be asked about a few ambiguous records.'
        : 'Sparse. The search will run, but a lot will come back as "might be you".',
  };
}
