/** The signed-in professional, their goals, and their reputation evidence. */

export const user = {
  name: 'Alex Chen',
  firstName: 'Alex',
  initials: 'AC',
  headline: 'Staff Data Engineer',
  company: 'Ridgeline Health',
  location: 'San Francisco Bay Area',
  thesis:
    'Data platforms earn their keep when the people using them stop thinking about them. '
    + 'I build lakehouse and streaming infrastructure that holds up under audit, cost review and 3 a.m. paging.',
  currentFocus: [
    'Migrating a 40-pipeline Spark estate onto an open table format',
    'Writing a monthly series on lakehouse decision-making',
    'Mentoring three senior engineers toward staff scope',
  ],
  goal: {
    title: 'AI infrastructure or data platform leadership',
    horizon: 'Next 6–9 months',
    openTo: [
      'Staff Data Engineer',
      'Principal Data Engineer',
      'AI Platform Architect',
      'Data Platform Lead',
    ],
    industries: ['Healthcare technology', 'Fintech', 'Enterprise AI'],
    workModel: 'Hybrid or remote',
    geography: 'California',
    level: 'Senior / Staff',
  },
  interests: [
    'Distributed systems',
    'AI platforms',
    'Lakehouse architecture',
    'Mentoring',
    'Technical writing',
  ],
};

/**
 * Career intents. Each one reframes the whole product: the dashboard sections,
 * the ranking emphasis, the right rail, and the language the agent uses.
 */
export const intents = [
  {
    id: 'job-hunting',
    label: 'Job hunting',
    short: 'Job hunting',
    ranking: 'Roles, hiring managers and recruiters first. Knowledge second.',
    briefing: 'Here are the professional signals worth your attention today.',
  },
  {
    id: 'hiring',
    label: 'Hiring',
    short: 'Hiring',
    ranking: 'Candidate evidence, referral paths and pipeline health first.',
    briefing: 'Here is where your open roles stand, and who is worth your time.',
  },
  {
    id: 'learning',
    label: 'Learning',
    short: 'Learning',
    ranking: 'Depth over recency. Practitioner writing, courses and reading groups.',
    briefing: 'Here is what would move your understanding forward this week.',
  },
  {
    id: 'networking',
    label: 'Networking',
    short: 'Networking',
    ranking: 'Peers, communities and events where a real conversation is likely.',
    briefing: 'Here are the conversations most likely to be useful to both sides.',
  },
  {
    id: 'mentoring',
    label: 'Mentoring',
    short: 'Mentoring',
    ranking: 'People asking questions you have already answered in practice.',
    briefing: 'Here is where your experience would save someone months.',
  },
  {
    id: 'building',
    label: 'Building',
    short: 'Building',
    ranking: 'Collaborators, founders, open-source work and technical problems.',
    briefing: 'Here is who is building near the problems you are working on.',
  },
  {
    id: 'exploring',
    label: 'Exploring',
    short: 'Exploring',
    ranking: 'Adjacent fields, career transitions and unfamiliar-but-relevant work.',
    briefing: 'Here is what sits one step outside your current field.',
  },
];

export function intentById(id) {
  return intents.find((i) => i.id === id) || intents[0];
}

/**
 * The reputation model. Every dimension carries its own inputs, so a score can
 * always be traced back to work that actually happened.
 */
export const reputation = {
  total: 782,
  outOf: 1000,
  basis:
    'Based on demonstrated work, peer validation, professional contributions and '
    + 'consistency over time. Never based on follower count alone.',
  dimensions: [
    {
      id: 'technical-credibility',
      label: 'Technical credibility',
      score: 88,
      trend: '+4 in 90 days',
      inputs: [
        '3 architecture articles with reproducible detail',
        '2 peer endorsements from engineers who reviewed the work',
        '1 conference presentation (DataEng Summit, 2025)',
        '4 verified project outcomes with named metrics',
        'Recent activity weighted more heavily than older work',
      ],
    },
    {
      id: 'writing-quality',
      label: 'Writing quality',
      score: 92,
      trend: '+7 in 90 days',
      inputs: [
        'Median read-through of 74% across 11 published pieces',
        '3 pieces cited by other practitioners in their own writing',
        'Claims consistently paired with numbers a reader can check',
        'No recycled or template-generated content detected',
      ],
    },
    {
      id: 'mentorship',
      label: 'Mentorship',
      score: 74,
      trend: 'flat',
      inputs: [
        '6 engineers mentored, 4 confirmed by the mentee',
        '2 mentees promoted during the mentoring period',
        'Consistent responses in the Staff+ Engineering Forum',
        'Lower than peers at your level, who average 9 mentees',
      ],
    },
    {
      id: 'leadership',
      label: 'Leadership',
      score: 61,
      trend: '+2 in 90 days',
      inputs: [
        'Technical lead on 2 multi-team migrations',
        'No public example of setting direction beyond your own team',
        'Peer validation strong on execution, thinner on org influence',
        'This is the dimension most limiting your Principal-level matches',
      ],
    },
    {
      id: 'community',
      label: 'Community contribution',
      score: 69,
      trend: '+5 in 90 days',
      inputs: [
        'Active in 2 practitioner communities',
        '14 substantive answers to other people\'s architecture questions',
        '1 reading group co-hosted',
      ],
    },
    {
      id: 'collaboration',
      label: 'Collaboration',
      score: 81,
      trend: '+3 in 90 days',
      inputs: [
        'Cross-functional work with analytics, security and clinical data teams',
        '5 colleagues described your review comments as materially useful',
        'Design documents co-authored with 3 different teams',
      ],
    },
    {
      id: 'hiring-influence',
      label: 'Hiring influence',
      score: 58,
      trend: 'new',
      inputs: [
        '11 interviews conducted, feedback rated consistent by the panel',
        'No hiring-loop design or rubric authorship on record',
        'Low sample size — treat this number as provisional',
      ],
    },
    {
      id: 'open-source',
      label: 'Open-source contribution',
      score: 64,
      trend: '+1 in 90 days',
      inputs: [
        '2 merged contributions to a streaming connector',
        '1 small library published, 40 dependents',
        'No maintainer role on record',
      ],
    },
  ],
};

/** Skills, each one carrying its evidence and the honest gaps. */
export const skills = [
  {
    id: 'spark',
    name: 'Apache Spark',
    strength: 'Strong',
    level: 92,
    lastDemonstrated: 'This quarter',
    evidence: [
      'Led a 40-pipeline migration with published before/after cost figures',
      'Two architecture articles reference specific tuning decisions',
      'Peer-reviewed by two engineers who worked on the same estate',
    ],
    gaps: [],
  },
  {
    id: 'lakehouse',
    name: 'Lakehouse architecture',
    strength: 'Strong',
    level: 90,
    lastDemonstrated: 'This month',
    evidence: [
      'Decision framework published and adopted by three teams',
      'Conference session on table-format trade-offs',
      'Cited by two other practitioners writing on the same topic',
    ],
    gaps: [],
  },
  {
    id: 'streaming',
    name: 'Streaming systems',
    strength: 'Strong',
    level: 85,
    lastDemonstrated: 'This quarter',
    evidence: [
      'Migration supporting 8 billion daily events',
      'Instrumentation work on end-to-end freshness',
    ],
    gaps: ['No public writing on exactly-once semantics'],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    strength: 'Medium',
    level: 54,
    lastDemonstrated: '18 months ago',
    blocking: 12,
    evidence: [
      'Mentioned in two project descriptions',
    ],
    gaps: [
      'No public leadership example',
      'No operator, autoscaling or multi-tenancy work visible',
      'Last demonstrated 18 months ago',
    ],
    strengthen: [
      'Add the Ridgeline operator work you led — it is on your résumé but not in your evidence',
      'Publish the node-pool sizing analysis you shared internally in March',
      'Ask Nadia Rhee to validate the platform-migration scope',
    ],
  },
  {
    id: 'cost',
    name: 'Infrastructure cost optimisation',
    strength: 'Medium',
    level: 58,
    lastDemonstrated: '6 months ago',
    blocking: 7,
    evidence: [
      'Reduced pipeline cost by 34% at Ridgeline Health',
      'Internal review deck, not public',
    ],
    gaps: [
      'The 34% result has no public write-up a hiring manager could read',
      'No unit-economics framework on record',
    ],
    strengthen: [
      'Turn the internal review deck into a public post with the method, not just the number',
    ],
  },
  {
    id: 'dbt',
    name: 'dbt / analytics engineering',
    strength: 'Medium',
    level: 66,
    lastDemonstrated: 'This year',
    evidence: [
      'Owned a 300-model project',
      'Two merged upstream contributions',
    ],
    gaps: ['No public writing'],
  },
  {
    id: 'python',
    name: 'Python',
    strength: 'Strong',
    level: 88,
    lastDemonstrated: 'This month',
    evidence: [
      'Primary language across 6 years of shipped work',
      'Library published, 40 dependents',
    ],
    gaps: [],
  },
  {
    id: 'ml-infra',
    name: 'ML / feature infrastructure',
    strength: 'Emerging',
    level: 41,
    lastDemonstrated: '2 years ago',
    blocking: 9,
    evidence: [
      'Built a feature store prototype that did not reach production',
    ],
    gaps: [
      'No production ML serving path on record',
      'This is the most common requirement in AI Platform Architect roles you are targeting',
    ],
    strengthen: [
      'The Ridgeline embedding pipeline counts — document it',
      'Two of your target companies weight this above Kubernetes',
    ],
  },
];

/** Profile content beyond the résumé. */
export const evidenceOfWork = [
  {
    id: 'ev-cost',
    claim: 'Reduced pipeline cost by 34%',
    detail: 'Ridgeline Health, 2025. Verified against six months of billing data by the platform finance team.',
    verified: 'Verified by employer',
  },
  {
    id: 'ev-migration',
    claim: 'Led migration supporting 8 billion daily events',
    detail: 'Kafka to a partitioned lakehouse sink, zero-downtime cutover across 40 pipelines.',
    verified: 'Peer-validated by 2 engineers',
  },
  {
    id: 'ev-framework',
    claim: 'Published architecture framework used by three teams',
    detail: 'Table-format decision framework. Adoption confirmed by two teams outside your company.',
    verified: 'External adoption confirmed',
  },
  {
    id: 'ev-mentor',
    claim: 'Mentored six senior engineers',
    detail: 'Four confirmed by the mentee; two were promoted during the mentoring period.',
    verified: '4 of 6 confirmed',
  },
  {
    id: 'ev-platform',
    claim: 'Built an interview preparation platform with 1,500+ questions',
    detail: 'Side project. 2,400 monthly practitioners, open question bank.',
    verified: 'Public artefact',
  },
];

export const timeline = [
  {
    period: '2023 — present',
    role: 'Staff Data Engineer',
    org: 'Ridgeline Health',
    outcome: 'Owns the lakehouse platform used by 9 product teams. Cut cost 34%, cut p95 freshness from 42 to 9 minutes.',
  },
  {
    period: '2020 — 2023',
    role: 'Senior Data Engineer',
    org: 'Halcyon Financial',
    outcome: 'Built the streaming estate behind fraud scoring. 8 billion daily events at cutover.',
  },
  {
    period: '2017 — 2020',
    role: 'Data Engineer',
    org: 'Meridian Retail Group',
    outcome: 'First warehouse rebuild. Learned what happens when modelling decisions are made in a hurry.',
  },
];

export const articles = [
  {
    id: 'art-tableformat',
    title: 'Table format migrations: what the benchmarks do not tell you',
    date: 'June 2026',
    signal: 'Read by 7 hiring managers in your target companies',
  },
  {
    id: 'art-freshness',
    title: 'Freshness is a promise, not a metric',
    date: 'April 2026',
    signal: 'Cited by 2 practitioners in their own writing',
  },
  {
    id: 'art-cost',
    title: 'The three line items that dominate a lakehouse bill',
    date: 'February 2026',
    signal: 'Most-saved of your pieces',
  },
];

export const communities = [
  {
    id: 'com-ds',
    name: 'Distributed Systems Practitioners',
    members: '4,100 practitioners',
    basis: 'Membership requires a demonstrated systems contribution. No open sign-up.',
    yourRole: 'Member · 14 substantive answers',
  },
  {
    id: 'com-aip',
    name: 'AI Platform Engineering',
    members: '2,600 practitioners',
    basis: 'Weekly working session on serving, feature stores and evaluation infrastructure.',
    yourRole: 'Member · reading, not yet contributing',
    suggestion: 'Your embedding-pipeline work would be new information to this group.',
  },
  {
    id: 'com-dal',
    name: 'Data Architecture Leadership',
    members: '900 practitioners',
    basis: 'Staff-and-above only, verified by role history. Discussion of org design, not tools.',
    yourRole: 'Not a member',
    suggestion: 'Directly relevant to the leadership dimension limiting your Principal matches.',
  },
  {
    id: 'com-tw',
    name: 'Technical Writing for Engineers',
    members: '1,800 practitioners',
    basis: 'Draft exchange and structured critique. Contribution expected, not optional.',
    yourRole: 'Member · 3 drafts reviewed for others',
  },
  {
    id: 'com-staff',
    name: 'Staff+ Engineering Forum',
    members: '3,200 practitioners',
    basis: 'Scope, influence and promotion cases. Moderated; self-promotion removed.',
    yourRole: 'Member · active',
  },
];
