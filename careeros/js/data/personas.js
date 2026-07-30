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
    greeting: 'Here are the professional signals worth your attention today.',
    searchPlaceholder:
      'Search roles, hiring managers, recruiters, skills…',
    railMode: 'career',
    sensitivityFloor: 'opportunities',
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
    name: 'Alex Chen',
    initials: 'AC',
    title: 'Staff Data Engineer',
    org: 'Ridgeline Health',
    location: 'San Francisco Bay Area',
    greeting: 'Here is what would move your understanding forward this week.',
    searchPlaceholder:
      'Search practitioners, writing, working groups, papers…',
    railMode: 'career',
    // Conversations are the point of this mode, so they are the floor.
    sensitivityFloor: 'conversations',
    focus: {
      label: 'Current focus',
      headline: 'Feature infrastructure and compliance boundaries',
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
  hiring: {
    id: 'hiring-manager',
    label: 'Hiring manager',
    badge: 'Hiring manager',
    badgeVariant: 'primary',
    name: 'Alex Chen',
    initials: 'AC',
    title: 'Engineering Manager',
    org: 'Ridgeline Health',
    location: 'San Francisco Bay Area',
    greeting: 'Here is your hiring command centre.',
    searchPlaceholder:
      'Search candidates, roles, skills, companies…',
    railMode: 'hiring',
    focus: {
      label: 'Active hiring focus',
      headline: 'Staff Data Engineer',
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
      { who: 'Priya N.', initials: 'PN', what: 'moved a candidate to On-site round', when: '2h ago' },
      { who: 'Jordan M.', initials: 'JM', what: 'added feedback on Imani Brooks', when: '5h ago' },
      { who: 'You', initials: 'AC', what: 'moved 2 candidates to Interview', when: '1d ago' },
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
    greeting: 'Here is your pipeline, and where it is leaking.',
    searchPlaceholder:
      'Search candidates by demonstrated work, not keywords…',
    railMode: 'recruiter',
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

/** Intents that do not define their own persona fall back to the professional. */
const FALLBACK = {
  networking: 'learning',
  mentoring: 'learning',
  building: 'learning',
  exploring: 'job-hunting',
};

export function personaFor(intentId, hiringView) {
  // Inside the Hiring intent, the recruiter workspace is a genuinely different
  // job with a different identity — not a filter on the same one.
  if (intentId === 'hiring' && hiringView === 'recruiter') return personas.recruiter;
  return personas[intentId] || personas[FALLBACK[intentId]] || personas['job-hunting'];
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
    detail: 'Rohan Mehta is an 89% evidence match for Staff Data Engineer, based on published work.',
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
    title: 'Staff Data Engineer compensation is up 6% in 60 days',
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
