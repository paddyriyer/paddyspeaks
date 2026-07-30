/**
 * Personas.
 *
 * The original build had a real defect: switching intent swapped the centre
 * column but left the identity alone, so the rail said "Staff Data Engineer,
 * open to Principal roles" while the workspace showed candidates to hire. The
 * persona contradicted itself and a reader could not tell whether the user was
 * hiring or being hired.
 *
 * The fix is that intent selects a whole persona — identity, badge, greeting,
 * search scope, rail composition and signal set — not just a content list.
 * Every intent below maps to exactly one coherent professional situation.
 *
 * Each persona is also a different person. Sharing one name across eight roles
 * was the second version of the same defect: a hiring manager and the candidate
 * he was assessing cannot be the same human, and a reader who sees one name
 * above two contradictory dashboards learns nothing from either. The eight
 * people below all already exist in this prototype's world — Wei Lin, Priya
 * Ramaswami, Nadia Rhee, Jonas Ferreira, Lena Vogt, Amara Osei and Renata
 * Okafor all appear in Alex Chen's network — so switching mode switches to
 * someone you can already see from here.
 *
 * `selfId` is the id this persona has in data/people.js, so the product never
 * recommends someone to themselves.
 *
 * Each persona's record — reputation, skills, evidence, communities — lives in
 * data/profiles.js, keyed by the persona id.
 */

export const personas = {
  /* ---------------------------------------------------------------- */
  'job-hunting': {
    id: 'candidate',
    label: 'Candidate',
    badge: 'Open to roles',
    badgeVariant: 'accent',
    name: 'Alex Chen',
    initials: 'AC',
    title: 'Staff Data Engineer',
    org: 'Ridgeline Health',
    location: 'San Francisco Bay Area',
    selfId: null,
    greeting: 'Here are the professional signals worth your attention today.',
    searchPlaceholder:
      'Search roles, hiring managers, recruiters, skills…',
    railMode: 'career',
    sensitivityFloor: 'opportunities',
    layout: {
      left: ['identity', 'reputation', 'career-goal', 'agent-teaser'],
      center: ['summary', 'agent', 'jobs', 'skill-gaps', 'feed'],
      right: ['signals', 'people', 'events', 'recruiters', 'next-actions', 'feed-priority'],
    },
    // What this person is measured on.
    focus: {
      label: 'Career goal',
      headline: 'AI infrastructure or data platform leadership',
      meta: [
        { icon: 'briefcase', text: '12 strong role matches' },
        { icon: 'target', text: '2 skill gaps affecting matches' },
      ],
      cta: 'Adjust career goal',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Search overview',
      period: 'This month',
      rows: [
        { label: 'Strong role matches', value: '12' },
        { label: 'Hiring managers who viewed you', value: '7' },
        { label: 'Roles saved', value: '4' },
        { label: 'Median profile dwell time', value: '41s' },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  learning: {
    id: 'professional',
    label: 'Professional',
    badge: 'Not looking',
    badgeVariant: '',
    name: 'Wei Lin',
    initials: 'WL',
    title: 'Staff Engineer, Distributed Systems',
    org: 'Meridian',
    location: 'San Jose, CA',
    selfId: 'wei-lin',
    greeting: 'Here is what would move your understanding forward this week.',
    searchPlaceholder:
      'Search practitioners, writing, working groups, papers…',
    railMode: 'career',
    // Conversations are the point of this mode, so they are the floor.
    sensitivityFloor: 'conversations',
    layout: {
      left: ['identity', 'overview', 'reputation', 'agent-teaser'],
      center: ['summary', 'skill-gaps', 'feed'],
      right: ['signals', 'events', 'people', 'next-actions', 'feed-priority'],
    },
    focus: {
      label: 'Current focus',
      headline: 'Compliance boundaries, and what they do to platform design',
      meta: [
        { icon: 'book', text: '6 pieces worth your evening' },
        { icon: 'users', text: '3 working groups accepting members' },
      ],
      cta: 'Change what you are working on',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Practice overview',
      period: 'This month',
      rows: [
        { label: 'Read to the end', value: '11' },
        { label: 'Saved for reference', value: '18' },
        { label: 'Questions you answered', value: '14' },
        { label: 'Drafts reviewed for others', value: '3' },
      ],
    },
    note: 'No job-search signals are collected in this mode, and none are shown to recruiters.',
  },


  /* ---------------------------------------------------------------- */
  networking: {
    id: 'connector',
    label: 'Connector',
    badge: 'Open to conversations',
    badgeVariant: '',
    name: 'Priya Ramaswami',
    initials: 'PR',
    title: 'Senior Data Engineer',
    org: 'Northwind',
    location: 'Berkeley, CA',
    selfId: 'priya-ramaswami',
    greeting: 'Here are the conversations most likely to be useful to both sides.',
    searchPlaceholder: 'Search peers, communities, events, people who write about…',
    railMode: 'career',
    sensitivityFloor: 'conversations',
    layout: {
      left: ['identity', 'overview', 'agent-teaser'],
      center: ['summary', 'feed'],
      right: ['events', 'people', 'signals', 'next-actions'],
    },
    focus: {
      label: 'What you want from a conversation',
      headline: 'Practitioners solving the problem you are solving',
      meta: [
        { icon: 'users', text: '5 conversations with a real opening' },
        { icon: 'calendar', text: '3 events worth the time' },
      ],
      cta: 'Change what you are looking for',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Connection quality',
      period: 'This quarter',
      rows: [
        { label: 'First messages that got a reply', value: '9 of 11' },
        { label: 'Conversations still going', value: '6' },
        { label: 'Introductions you made for others', value: '4' },
        { label: 'Introductions made for you', value: '2' },
      ],
      note: 'Connection count is not tracked. A contact you never speak to is not a connection.',
    },
  },

  /* ---------------------------------------------------------------- */
  mentoring: {
    id: 'mentor',
    label: 'Mentor',
    badge: 'Mentoring',
    badgeVariant: 'accent',
    name: 'Nadia Rhee',
    initials: 'NR',
    title: 'Principal Engineer',
    org: 'Ridgeline Health',
    location: 'San Francisco, CA',
    selfId: 'nadia-rhee',
    greeting: 'Here is where your experience would save someone months.',
    searchPlaceholder: 'Search questions, mentees, topics you have solved…',
    railMode: 'career',
    sensitivityFloor: 'conversations',
    layout: {
      left: ['identity', 'overview', 'reputation', 'agent-teaser'],
      center: ['summary', 'feed'],
      right: ['signals', 'people', 'next-actions', 'events'],
    },
    focus: {
      label: 'Where you can help',
      headline: 'Staff-scope cases, and the platform move you made first',
      meta: [
        { icon: 'message', text: '3 questions you were named in' },
        { icon: 'users', text: '19 engineers mentored, 15 confirmed' },
      ],
      cta: 'Change what you mentor on',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Mentorship record',
      period: 'All time',
      rows: [
        { label: 'Engineers mentored', value: '19' },
        { label: 'Confirmed by the mentee', value: '15' },
        { label: 'Reached Staff or Principal', value: '11' },
        { label: 'Questions answered in full', value: '22' },
      ],
      note: 'Only mentees who confirmed the relationship are counted. Claims do not count themselves.',
    },
  },

  /* ---------------------------------------------------------------- */
  building: {
    id: 'builder',
    label: 'Builder',
    badge: 'Building',
    badgeVariant: 'primary',
    name: 'Jonas Ferreira',
    initials: 'JF',
    title: 'Founder',
    org: 'Tessellate',
    location: 'Remote (Lisbon / SF)',
    selfId: 'jonas-ferreira',
    greeting: 'Here is who is building near the problems you are working on.',
    searchPlaceholder: 'Search collaborators, open source, founders, problems…',
    railMode: 'career',
    sensitivityFloor: 'conversations',
    layout: {
      left: ['identity', 'overview', 'agent-teaser'],
      center: ['summary', 'jobs', 'feed'],
      right: ['people', 'signals', 'next-actions', 'events'],
    },
    focus: {
      label: 'What you are building',
      headline: 'Event-driven lakehouse tooling, in the open',
      meta: [
        { icon: 'layers', text: '4 potential collaborators' },
        { icon: 'link', text: '9 first-time contributors this year' },
      ],
      cta: 'Change what you are building',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Build activity',
      period: 'This year',
      rows: [
        { label: 'Dependent projects', value: '63' },
        { label: 'First-time contributors merged', value: '9' },
        { label: 'Who came back and did it again', value: '6' },
        { label: 'Median issue response', value: 'Under 24h' },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  exploring: {
    id: 'explorer',
    label: 'Explorer',
    badge: 'Exploring',
    badgeVariant: '',
    name: 'Lena Vogt',
    initials: 'LV',
    title: 'Data Platform Lead',
    org: 'Cobalt Health',
    location: 'Seattle, WA',
    selfId: 'cand-lena',
    greeting: 'Here is what sits one step outside your current field.',
    searchPlaceholder: 'Search adjacent fields, transitions, unfamiliar work…',
    railMode: 'career',
    sensitivityFloor: 'opportunities',
    layout: {
      left: ['identity', 'career-goal', 'overview', 'agent-teaser'],
      center: ['summary', 'jobs', 'skill-gaps', 'feed'],
      right: ['people', 'signals', 'next-actions', 'events'],
    },
    focus: {
      label: 'What you are exploring',
      headline: 'ML platform, not data platform',
      meta: [
        { icon: 'compass', text: '9 roles in adjacent fields' },
        { icon: 'trend', text: '2 skills that transfer further than you think' },
      ],
      cta: 'Change what you are exploring',
      ctaAction: 'adjust-goal',
    },
    overview: {
      title: 'Exploration',
      period: 'This month',
      rows: [
        { label: 'Adjacent roles read', value: '9' },
        { label: 'Transition stories read', value: '3' },
        { label: 'Fields sampled', value: '2' },
        { label: 'Nothing signalled to recruiters', value: 'Confirmed' },
      ],
      note: 'Exploring is private. No employer or recruiter is told you are looking around.',
    },
  },

  /* ---------------------------------------------------------------- */
  hiring: {
    id: 'hiring-manager',
    label: 'Hiring manager',
    badge: 'Hiring manager',
    badgeVariant: 'primary',
    name: 'Amara Osei',
    initials: 'AO',
    title: 'VP Engineering',
    org: 'Fathom Health AI',
    location: 'San Francisco, CA',
    selfId: 'amara-osei',
    greeting: 'Here is your hiring command centre.',
    searchPlaceholder:
      'Search candidates, roles, skills, companies…',
    railMode: 'hiring',
    layout: {
      left: ['identity', 'overview', 'team-activity', 'agent-teaser'],
      center: ['summary', 'mode-switch', 'candidates', 'bottlenecks', 'feed'],
      right: ['signals', 'candidate-rail', 'events', 'pipeline', 'next-actions'],
    },
    focus: {
      label: 'Active hiring focus',
      headline: 'Principal Data Platform Engineer',
      meta: [
        { icon: 'briefcase', text: '3 open roles' },
        { icon: 'users', text: '12 active candidates' },
      ],
      cta: 'Manage role',
      ctaAction: 'hiring-action',
      secondaryCta: 'Go to recruiter workspace',
      secondaryAction: 'set-hiring-view',
    },
    overview: {
      title: 'Hiring overview',
      period: 'This month',
      rows: [
        { label: 'New qualified candidates', value: '23' },
        { label: 'Interviews scheduled', value: '7' },
        { label: 'Strong pipeline', value: '18' },
        { label: 'Avg. time to first interview', value: '3.2 days' },
      ],
    },
    teamActivity: [
      { who: 'Kofi A.', initials: 'KA', what: 'moved a candidate to On-site round', when: '2h ago' },
      { who: 'Jordan M.', initials: 'JM', what: 'added feedback on Imani Brooks', when: '5h ago' },
      { who: 'You', initials: 'AO', what: 'moved 2 candidates to Interview', when: '1d ago' },
    ],
  },

  /* ---------------------------------------------------------------- */
  recruiter: {
    id: 'recruiter',
    label: 'Recruiter',
    badge: 'Recruiter',
    badgeVariant: 'primary',
    name: 'Renata Okafor',
    initials: 'RO',
    title: 'Technical Recruiter',
    org: 'Cedarpoint Data',
    location: 'San Francisco Bay Area',
    selfId: 'renata-okafor',
    greeting: 'Here is your pipeline, and where it is leaking.',
    searchPlaceholder:
      'Search candidates by demonstrated work, not keywords…',
    railMode: 'recruiter',
    layout: {
      left: ['identity', 'overview', 'team-activity'],
      center: ['summary', 'mode-switch', 'candidates', 'feed'],
      right: ['signals', 'candidate-rail', 'pipeline', 'next-actions'],
    },
    focus: {
      label: 'Active requisitions',
      headline: '5 roles across 3 companies',
      meta: [
        { icon: 'briefcase', text: '2 roles closing this week' },
        { icon: 'clock', text: '6h median response time' },
      ],
      cta: 'Manage requisitions',
      ctaAction: 'hiring-action',
    },
    overview: {
      title: 'Your measured record',
      period: 'Rolling 90 days',
      rows: [
        { label: 'Candidate response rate', value: '96%' },
        { label: 'Ghosting rate', value: 'Low' },
        { label: 'Placements', value: '5' },
        { label: 'Role accuracy', value: '5 of 5' },
      ],
      note: 'Candidates can see these figures before they reply to you.',
    },
    teamActivity: [
      { who: 'Imani B.', initials: 'IB', what: 'replied within 40 minutes', when: '1h ago' },
      { who: 'Marcus O.', initials: 'MO', what: 'opened your role, no reply yet', when: '2d ago' },
      { who: 'Rafael D.', initials: 'RD', what: 'rediscovered from a 2025 loop', when: '3d ago' },
    ],
  },
};

export function personaFor(intentId, hiringView) {
  // Inside the Hiring intent, the recruiter workspace is a genuinely different
  // job with a different identity — not a filter on the same one.
  if (intentId === 'hiring' && hiringView === 'recruiter') return personas.recruiter;
  return personas[intentId] || personas['job-hunting'];
}

/** Hiring-side signals. The candidate signal set is in data/signals.js. */
export const hiringSignals = [
  {
    id: 'hs-imani',
    tier: 'critical',
    kind: 'High priority',
    when: '2 hours ago',
    title: 'Imani Brooks is moving forward',
    detail: 'Completed take-home assessment with 94% score. The panel is recommending an on-site.',
    why: 'She is your strongest candidate on demonstrated work, and the loop stalls if you do not confirm.',
    action: { label: 'View assessment summary', route: 'network' },
  },
  {
    id: 'hs-match',
    tier: 'opportunities',
    kind: 'New match',
    when: 'Yesterday',
    title: 'A strong candidate matches your open role',
    detail: 'Rohan Mehta is an 89% evidence match for Principal Data Platform Engineer, based on published work.',
    why: 'Surfaced on demonstrated stack overlap, not on keywords in a résumé.',
    action: { label: 'View candidate', route: 'network' },
  },
  {
    id: 'hs-team',
    tier: 'conversations',
    kind: 'Team update',
    when: 'Yesterday',
    title: 'Jordan left feedback on 2 candidates',
    detail: 'Two strong signals. Both are waiting on your review before they can move.',
    why: 'Your team is blocked on you, which is the most common cause of a stalled loop.',
    action: { label: 'Review feedback', route: 'career-agent' },
  },
  {
    id: 'hs-band',
    tier: 'opportunities',
    kind: 'Market insight',
    when: '2 days ago',
    title: 'Principal platform compensation is up 6% in 60 days',
    detail: 'Your posted band now sits below three of your five strongest candidates.',
    why: 'This is the most likely reason your last two finalists declined.',
    action: { label: 'View benchmark', route: 'career-agent' },
  },
  {
    id: 'hs-sched',
    tier: 'everything',
    kind: 'Reminder',
    when: '2 days ago',
    title: '3 interviews scheduled this week',
    detail: 'Two of your four interviewers have declined more than half their requests this month.',
    why: 'Candidates in the technical stage are 3× more likely to withdraw after day seven.',
    action: { label: 'View schedule', route: 'career-agent' },
  },
];
