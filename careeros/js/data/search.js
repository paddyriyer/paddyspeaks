/**
 * Conversational search. The result is a research workspace: an interpretation
 * of the question, grouped findings, and the ranking logic in plain language.
 */

export const exampleQueries = [
  'Find recruiters hiring Staff Data Engineers in California',
  'Show engineering managers building AI platform teams',
  'Find people writing about lakehouse architecture',
  'Show roles where my current skill match is above 85%',
  'Find mentors who moved from engineering into architecture',
  'Show events attended by senior data leaders this month',
];

export const defaultQuery =
  'I am a Staff Data Engineer in California looking to move into AI infrastructure in healthcare. '
  + 'Show companies hiring, relevant leaders, recruiters with strong response records, and professionals '
  + 'who made a similar transition.';

export const searchResult = {
  interpretation: {
    role: 'Staff Data Engineer (current) → AI infrastructure (target)',
    level: 'Staff / Principal',
    geography: 'California, remote or hybrid',
    industry: 'Healthcare technology, weighted first',
    intent: 'Job hunting, with a transition rather than a lateral move',
    assumed: [
      'You want roles that use your existing Spark and lakehouse depth, not entry-level ML roles',
      '"AI infrastructure" read as platform and serving infrastructure, not model research',
      'Compensation floor inferred from your current level: roughly $195,000',
    ],
    notAssumed: [
      'No inference about willingness to relocate outside California',
      'No inference from your demographic data — none was used',
    ],
  },
  summary: [
    'Eleven roles across nine companies fit the transition you described. Four are strong matches today; five more become strong matches if you publish two pieces of evidence you already have.',
    'Healthcare technology has the shallowest applicant pools of your three target industries, and the highest requirement overlap with your existing work.',
    'The binding constraint is not skill. It is that two of your strongest skills — Kubernetes and cost optimisation — exist on your résumé but not in any form a hiring manager can read.',
  ],
  ranking: [
    'Demonstrated skill overlap with the posted requirements, weighted highest',
    'Whether the role is verified active and the hiring manager is responsive',
    'Stated industry, geography and work-model preferences',
    'Whether someone who can speak to your work is already inside',
    'Recruiter response record, where a recruiter is involved',
    'Applicant volume relative to your standing in the pool',
  ],
  notRanked: [
    'Company size or brand recognition',
    'Follower counts, of the company or the people',
    'How recently you were active on the platform',
    'Anything paid for by an employer — this ranking is not for sale',
  ],
  groups: [
    {
      id: 'companies',
      title: 'Companies hiring for this transition',
      items: [
        { primary: 'Fathom Health AI', secondary: 'Healthcare AI · 2 open roles · you match 89% on the stronger one', meta: 'Amara Osei hires staff-level engineers from your exact background' },
        { primary: 'Cobalt Health', secondary: 'Healthcare · 1 open role · 72% today, 91% with two evidence gaps closed', meta: 'Remote, California' },
        { primary: 'Solstice Labs', secondary: 'Enterprise AI · 3 open roles · you match 88%', meta: 'Team grew 4 → 11 this year' },
        { primary: 'Anchorline', secondary: 'Fintech · 1 open role · 82% · band above your target', meta: 'Recruiter responds in 4 hours' },
      ],
    },
    {
      id: 'leaders',
      title: 'Leaders worth knowing in this space',
      items: [
        { primary: 'Amara Osei — VP Engineering, Fathom Health AI', secondary: '4 of her last 6 hires had your background', meta: 'Publishes her hiring rubric in advance' },
        { primary: 'Theo Marsh — EM, AI Platform, Solstice Labs', secondary: 'Hiring 3 roles; you have an existing exchange with him', meta: 'Writes about operational ownership' },
        { primary: 'Nadia Rhee — Principal Engineer, Ridgeline Health', secondary: 'Made this transition two years ahead of you, at your company', meta: 'Can validate your Kubernetes scope' },
      ],
    },
    {
      id: 'recruiters',
      title: 'Recruiters with strong measured records',
      items: [
        { primary: 'Renata Okafor — Cedarpoint Data', secondary: '96% response rate · low ghosting · 5 comparable placements in 90 days', meta: '2 open roles matching your titles' },
        { primary: 'Sofia Bianchi — Anchorline', secondary: '4 hour median response · excellent interview transparency', meta: 'Shares loop and rubric up front' },
      ],
      excluded: 'One recruiter with two matching roles was ranked down: 54% response rate and elevated ghosting. Shown on the Jobs page with the metrics, not hidden.',
    },
    {
      id: 'transitions',
      title: 'Professionals who made a similar transition',
      items: [
        { primary: 'Wei Lin — Staff Engineer, Distributed Systems, Meridian', secondary: 'Data engineering → distributed systems architecture, 2023', meta: 'Hosts a reading group you could join' },
        { primary: 'Nadia Rhee — Principal Engineer, Ridgeline Health', secondary: 'Staff data engineering → platform architecture, 2024', meta: 'Same industry, same company' },
        { primary: 'Lena Vogt — Data Platform Lead, Cobalt Health', secondary: 'Senior engineer → platform lead, healthcare, 2023', meta: 'Grew a team from 3 to 9' },
      ],
    },
    {
      id: 'knowledge',
      title: 'Reading that closes the gap',
      items: [
        { primary: 'A feature store is a cache with a compliance problem — Nadia Rhee', secondary: 'Addresses your weakest skill signal (41)', meta: '11 min · evidence included' },
        { primary: 'Exactly-once, and the four places we were quietly wrong — Imani Brooks', secondary: 'Benchmark harness published', meta: '14 min · reproducible' },
      ],
    },
    {
      id: 'events',
      title: 'Events and communities',
      items: [
        { primary: 'DataEng Summit — Infrastructure Track, 14 September', secondary: '2 target companies attending, 4 relevant recruiters registered', meta: 'San Francisco' },
        { primary: 'AI Platform Engineering — working session, 3 August', secondary: 'Covers the gap limiting 9 of your matches', meta: 'Remote, members only' },
      ],
    },
  ],
  actions: [
    { id: 'sa-alert', label: 'Alert me when a healthcare AI platform role above 85% appears', kind: 'alert' },
    { id: 'sa-save', label: 'Save this search', kind: 'save' },
    { id: 'sa-gap', label: 'Show me exactly what to publish to close both gaps', kind: 'agent' },
    { id: 'sa-intro', label: 'Find introduction paths into Fathom and Solstice', kind: 'intro' },
  ],
  filters: [
    { id: 'sf-verified', label: 'Verified active only', on: true },
    { id: 'sf-band', label: 'Published salary band', on: true },
    { id: 'sf-remote', label: 'Remote or hybrid', on: true },
    { id: 'sf-recruiter', label: 'Responsive recruiters only', on: false },
    { id: 'sf-stretch', label: 'Include stretch roles', on: false },
  ],
};
