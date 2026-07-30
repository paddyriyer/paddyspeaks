/**
 * Panel registry.
 *
 * The dashboard is assembled from this list rather than hardcoded, which is
 * what makes it customisable: a layout is just an ordered array of panel ids
 * per region, and the customiser edits that array.
 *
 * `regions` declares where a panel is allowed to live. Some panels only make
 * sense in a rail; the wide ones only make sense in the centre.
 */

export const panels = {
  /* ---- identity and rails ---- */
  identity: {
    label: 'Identity and focus',
    description: 'Who you are right now, and what you are working toward.',
    regions: ['left'],
    required: true,
  },
  reputation: {
    label: 'Professional reputation',
    description: 'Eight dimensions, each traceable to the work behind it.',
    regions: ['left', 'right'],
  },
  'career-goal': {
    label: 'Career goal',
    description: 'Target titles, industries, work model and geography.',
    regions: ['left', 'right'],
    // Only the people who actually have a goal on record. Wei Lin is not
    // looking and Nadia Rhee is not moving; an empty goal card under their
    // name would be a fabrication.
    personas: ['candidate', 'explorer'],
  },
  overview: {
    label: 'Role overview',
    description: 'The numbers that matter to this particular job.',
    regions: ['left', 'right'],
  },
  'team-activity': {
    label: 'Team activity',
    description: 'What your colleagues moved while you were away.',
    regions: ['left', 'right'],
    personas: ['hiring-manager', 'recruiter'],
  },
  'agent-teaser': {
    label: 'Agent summary',
    description: 'A one-line entry point into the agent findings.',
    regions: ['left', 'right'],
  },

  /* ---- centre column ---- */
  summary: {
    label: 'Summary cards',
    description: 'Four counts that lead into a workflow, not a vanity number.',
    regions: ['center'],
  },
  agent: {
    label: 'Career Agent findings',
    description: 'Evidence-chain insights with an action and a cost.',
    regions: ['center'],
  },
  jobs: {
    label: 'Role matches',
    description: 'Verified-active roles with the match reasoning shown.',
    regions: ['center'],
  },
  'skill-gaps': {
    label: 'Skill gaps',
    description: 'What is missing, expressed as the roles it is costing you.',
    regions: ['center'],
  },
  feed: {
    label: 'Knowledge feed',
    description: 'Ranked on usefulness, with a reason on every item.',
    regions: ['center'],
  },
  'mode-switch': {
    label: 'Workspace mode',
    description: 'Switch between the hiring-manager and recruiter workspace.',
    regions: ['center'],
    personas: ['hiring-manager', 'recruiter'],
  },
  candidates: {
    label: 'Candidates',
    description: 'Surfaced on demonstrated work, never on keyword density.',
    regions: ['center'],
    personas: ['hiring-manager', 'recruiter'],
  },
  bottlenecks: {
    label: 'Hiring bottlenecks',
    description: 'Where your loop is stalling — usually on your side.',
    regions: ['center'],
    personas: ['hiring-manager', 'recruiter'],
  },

  /* ---- right rail ---- */
  signals: {
    label: 'Signal, not noise',
    description: 'Alerts that state their professional consequence.',
    regions: ['right', 'left'],
  },
  people: {
    label: 'People who can help you grow',
    description: 'Ranked on what they are doing, not who you both know.',
    regions: ['right', 'left'],
  },
  'candidate-rail': {
    label: 'Candidates to look at',
    description: 'A short list with the reason each one surfaced.',
    regions: ['right', 'left'],
    personas: ['hiring-manager', 'recruiter'],
  },
  events: {
    label: 'Worth your time',
    description: 'Events recommended on professional value, not attendance.',
    regions: ['right', 'left'],
  },
  recruiters: {
    label: 'Recruiters active in your category',
    description: 'With their measured response records attached.',
    regions: ['right', 'left'],
    personas: ['candidate', 'explorer'],
  },
  pipeline: {
    label: 'Interview pipeline',
    description: 'Stage counts, with the slow stage called out.',
    regions: ['right', 'left'],
    personas: ['hiring-manager', 'recruiter'],
  },
  'next-actions': {
    label: 'Suggested next actions',
    description: 'Ordered by benefit per hour, not by recency.',
    regions: ['right', 'left'],
  },
  'feed-priority': {
    label: 'Feed priority',
    description: 'What the feed should optimise for. No "most popular" option.',
    regions: ['right', 'left'],
  },
};

export const regionLabels = {
  left: 'Left rail',
  center: 'Main column',
  right: 'Right rail',
};

/** Panels this persona is allowed to place, for a given region. */
export function availablePanels(personaId, region) {
  return Object.entries(panels)
    .filter(([, meta]) => meta.regions.includes(region))
    .filter(([, meta]) => !meta.personas || meta.personas.includes(personaId))
    .map(([id]) => id);
}

/** Strip anything the persona cannot use, so a stored layout never breaks. */
export function sanitiseLayout(layout, personaId) {
  const out = {};
  for (const region of ['left', 'center', 'right']) {
    const allowed = new Set(availablePanels(personaId, region));
    out[region] = (layout?.[region] || []).filter((id) => allowed.has(id));
  }
  // A required panel can be reordered but never removed.
  for (const [id, meta] of Object.entries(panels)) {
    if (meta.required && !out.left.includes(id)) out.left.unshift(id);
  }
  return out;
}
