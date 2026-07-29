/**
 * "Signal, Not Noise" — notifications, career agent insights, events,
 * and the sensitivity control that governs what gets through.
 */

export const sensitivityLevels = [
  { id: 'critical', label: 'Critical only', note: 'Time-bound things you would regret missing.' },
  { id: 'opportunities', label: 'Career opportunities', note: 'Roles, hiring activity and recruiter movement.' },
  { id: 'conversations', label: 'Professional conversations', note: 'Adds discussions where your perspective was asked for.' },
  { id: 'everything', label: 'Everything relevant', note: 'Everything the system can justify. Still no birthdays.' },
];

const RANK = { critical: 0, opportunities: 1, conversations: 2, everything: 3 };

export const signals = [
  {
    id: 'sig-search',
    tier: 'opportunities',
    kind: 'Hiring interest',
    when: '2 hours ago',
    title: 'A hiring manager searched for expertise matching your profile',
    detail:
      'Three searches this week for "AI platform + Spark + healthcare" surfaced your profile. Two came from '
      + 'Fathom Health AI, one from Cobalt Health.',
    why: 'You are job hunting, and this is direct evidence of demand for your exact combination of skills.',
    action: { label: 'See what they saw', route: 'profile' },
  },
  {
    id: 'sig-citation',
    tier: 'conversations',
    kind: 'Your work',
    when: '5 hours ago',
    title: 'Your article was cited in a hiring discussion',
    detail:
      'Your table-format piece was linked by an engineer arguing for a platform hire in the Data Architecture '
      + 'Leadership community.',
    why: 'Your writing is being used as an argument by someone else. That is reputation compounding without you present.',
    action: { label: 'Read the discussion', route: 'knowledge' },
  },
  {
    id: 'sig-role',
    tier: 'critical',
    kind: 'New role',
    when: 'Yesterday',
    title: 'A newly opened role matches your recent work at 87%',
    detail:
      'Staff Data Engineer, Risk Platform at Halcyon Financial — the streaming estate you built. Posted 1 day ago, '
      + '19 applicants already.',
    why: 'Time-sensitive: this recruiter historically shortlists within five days.',
    action: { label: 'View role', route: 'jobs' },
  },
  {
    id: 'sig-skill',
    tier: 'opportunities',
    kind: 'Skill impact',
    when: 'Yesterday',
    title: 'Closing one evidence gap would qualify you for 12 more roles',
    detail:
      'Kubernetes is your weakest visible signal. Twelve roles currently below your 85% threshold would cross it '
      + 'with published evidence of the operator work you already led.',
    why: 'This is the highest-leverage change available to you this month.',
    action: { label: 'View skill gap', route: 'profile' },
  },
  {
    id: 'sig-speaking',
    tier: 'conversations',
    kind: 'Event',
    when: '2 days ago',
    title: 'Two people you follow are speaking at DataEng Summit',
    detail: 'Priya Ramaswami and Wei Lin both have Infrastructure Track sessions on 14 September.',
    why: 'You have read four pieces by each of them. A conference session is the cheapest way to have a real conversation.',
    action: { label: 'View event', route: 'network' },
  },
  {
    id: 'sig-recruiter',
    tier: 'opportunities',
    kind: 'Trusted recruiter',
    when: '2 days ago',
    title: 'A trusted recruiter posted a role similar to your saved search',
    detail:
      'Renata Okafor posted Data Platform Lead, remote in California. She has filled five comparable roles in 90 days '
      + 'with a 96% response rate.',
    why: 'Matches your saved search, and the recruiter has a measured record of replying.',
    action: { label: 'View role', route: 'jobs' },
  },
  {
    id: 'sig-question',
    tier: 'conversations',
    kind: 'Asked for you',
    when: '3 days ago',
    title: 'A peer asked for your perspective on a partitioning decision',
    detail:
      'In Distributed Systems Practitioners, an engineer named you specifically as someone who had written about '
      + 'this trade-off.',
    why: 'Someone asked for you by name. This is the mentorship dimension where your score is below peers at your level.',
    action: { label: 'Read the question', route: 'knowledge' },
  },
  {
    id: 'sig-response',
    tier: 'conversations',
    kind: 'Discussion',
    when: '4 days ago',
    title: 'A hiring manager responded to a discussion you joined',
    detail: 'Theo Marsh replied to your comment on operational ownership, and agreed with the pager argument.',
    why: 'He is hiring three roles you match. An existing exchange is a far better opening than a cold message.',
    action: { label: 'Draft a reply', route: 'messages' },
  },
  {
    id: 'sig-verify',
    tier: 'everything',
    kind: 'Housekeeping',
    when: '5 days ago',
    title: 'Two saved roles were re-verified as active, one expired',
    detail:
      'Principal Data Platform Engineer and Staff Engineer, AI Platform are both still open. A third saved role at '
      + 'Vantage Grid has been closed for 11 days and has been archived.',
    why: 'You should not spend an evening preparing an application for a role that no longer exists.',
    action: { label: 'Review saved roles', route: 'jobs' },
  },
];

export function visibleSignals(sensitivity) {
  const max = RANK[sensitivity] ?? 1;
  return signals.filter((s) => RANK[s.tier] <= max);
}

export const notShown = [
  'Birthday reminders',
  'Work anniversaries, unless you have a working relationship',
  'Someone liked something',
  'Generic profile views with no hiring context',
  '"Someone in your network posted"',
  'Bulk network updates',
];

/** Career Agent insights. Each one is an evidence chain, not advice. */
export const insights = [
  {
    id: 'ins-kubernetes',
    priority: 'Act this week',
    happened:
      'Three hiring managers viewed your profile after searching for AI platform experience. All three '
      + 'left within 40 seconds of reaching your skills section.',
    matters:
      'Your Kubernetes work is not visible. It is the first requirement listed in two of the three roles '
      + 'those managers are hiring for.',
    evidence: [
      'Search terms recorded: "AI platform", "Kubernetes", "Spark" (aggregated, no individual identified)',
      'Your Kubernetes evidence strength: Medium, last demonstrated 18 months ago',
      'Your résumé names the Ridgeline operator work; your evidence section does not',
      '12 roles currently sit between 72% and 84% because of this single gap',
    ],
    action: { label: 'Add Kubernetes evidence', route: 'profile', anchor: 'kubernetes' },
    benefit: '12 roles cross your 85% threshold. Two of them are roles you have already saved.',
    effort: 'About 40 minutes — the material exists, it is not published.',
  },
  {
    id: 'ins-onesskill',
    priority: 'Act this month',
    happened:
      'You match 87% of Staff Data Engineering roles at your ten target companies, but only 61% of the '
      + 'Architect-titled roles you say you want.',
    matters:
      'The difference is one skill family: production ML and feature infrastructure. It appears in nine of '
      + 'your target roles as a primary requirement.',
    evidence: [
      'ML / feature infrastructure evidence strength: Emerging (41)',
      'You built an embedding pipeline at Ridgeline that is not documented anywhere public',
      'Nadia Rhee, a colleague, has published on exactly this and could validate your work',
      'Two target companies weight this above Kubernetes',
    ],
    action: { label: 'View the missing skill', route: 'profile', anchor: 'ml-infra' },
    benefit: 'Moves Architect-titled roles from 61% to an estimated 84% median match.',
    effort: 'One write-up plus one peer validation. Roughly two evenings.',
  },
  {
    id: 'ins-article',
    priority: 'Quick win',
    happened:
      'Your lakehouse article generated 7 recruiter profile visits in June. Your profile summary generated 1.',
    matters:
      'The strongest thing you have written is buried three clicks from your profile, while the weakest '
      + 'paragraph is at the top of it.',
    evidence: [
      'Article: "Table format migrations: what the benchmarks do not tell you" — 7 hiring-manager reads',
      'Read-through rate 74%, well above the 31% median for the topic',
      'Cited by two other practitioners in their own writing',
      'Your profile summary has not changed in 14 months',
    ],
    action: { label: 'Feature the article on your profile', route: 'profile', anchor: 'articles' },
    benefit: 'Puts your best evidence where the 40-second visitors actually look.',
    effort: 'Two minutes.',
  },
  {
    id: 'ins-conversations',
    priority: 'Act this week',
    happened:
      'Two hiring managers in healthcare AI posted this month about problems directly related to your '
      + 'recent work.',
    matters:
      'Both are hiring. An informed reply to a public post is a better first contact than an application, '
      + 'and you already have something specific to say.',
    evidence: [
      'Theo Marsh, "Who carries the pager for the platform?" — you commented, he replied and agreed',
      'Amara Osei, "The Staff promotion case I almost rejected" — she is the hiring manager on your 89% match',
      'Your April freshness article addresses the measurement problem Theo describes',
      'Neither post has a reply from anyone with your operational background',
    ],
    action: { label: 'Review conversation opportunities', route: 'messages' },
    benefit: 'Two warm openings instead of two cold applications.',
    effort: 'One considered reply each. No template will do this well.',
  },
  {
    id: 'ins-leadership',
    priority: 'Longer arc',
    happened:
      'Your leadership dimension has moved 2 points in 90 days while your technical credibility moved 4.',
    matters:
      'Your stated goal is platform leadership. Every Director- and Principal-titled role you have viewed '
      + 'weights leadership evidence above technical depth, and yours is your lowest score.',
    evidence: [
      'Leadership: 61. Technical credibility: 88',
      'Technical lead on 2 multi-team migrations, but no public example of setting direction beyond your team',
      'The Data Architecture Leadership community is staff-and-above and you are not a member',
      'Meridian\'s Director role lists this as the primary requirement',
    ],
    action: { label: 'See what moves this dimension', route: 'career-agent', anchor: 'leadership' },
    benefit: 'This is the constraint on the tier above your current search, not on your current search.',
    effort: 'Months, not evenings. Worth starting now for that reason.',
  },
];

export function insightById(id) {
  return insights.find((i) => i.id === id);
}

/** Events — "Worth Your Time". */
export const events = [
  {
    id: 'evt-dataeng',
    name: 'DataEng Summit — Infrastructure Track',
    date: '14 September',
    location: 'San Francisco',
    format: 'In person, single track',
    cost: '$450, or free with a speaker referral',
    match: 'High value',
    why: [
      'Three people you follow are speaking, including Wei Lin and Priya Ramaswami',
      'Two of your target companies are attending, both with hiring managers on the list',
      'Sessions match your AI platform goal, not just your current job',
      'Four recruiters hiring your skill set have registered',
    ],
    attendees: [
      { name: 'Wei Lin', role: 'Speaking — Infrastructure Track', id: 'wei-lin' },
      { name: 'Priya Ramaswami', role: 'Speaking — Table formats in practice', id: 'priya-ramaswami' },
      { name: 'Renata Okafor', role: 'Recruiting — 2 open roles you match', id: 'renata-okafor' },
      { name: 'Theo Marsh', role: 'Attending — hiring 3 roles', id: 'theo-marsh' },
    ],
    prep: [
      'Priya\'s session disagrees with your June partition conclusion — that is your opening',
      'Theo replied to your comment on operational ownership two weeks ago',
      'Skip the keynote. Two of your four useful contacts will be in the hallway during it.',
    ],
  },
  {
    id: 'evt-reading',
    name: 'Systems Reading Group — Consensus papers',
    date: 'Every second Thursday',
    location: 'Remote',
    format: 'Small group, 12 people, papers read in advance',
    cost: 'Free, but attendance is expected',
    match: 'High value',
    why: [
      'Hosted by Wei Lin, whose stack overlaps yours at 92%',
      'Twelve people, so a real conversation is possible',
      'Directly serves your learning intent rather than your job search',
    ],
    attendees: [
      { name: 'Wei Lin', role: 'Host', id: 'wei-lin' },
      { name: 'Amara Osei', role: 'Regular attendee', id: 'amara-osei' },
    ],
    prep: ['Next paper is on Raft membership changes. Reading it beforehand is the price of entry.'],
  },
  {
    id: 'evt-platform',
    name: 'AI Platform Engineering — Working session',
    date: '3 August',
    location: 'Remote',
    format: 'Working session, not a talk. Bring a problem.',
    cost: 'Free for community members',
    match: 'Worth considering',
    why: [
      'Covers the feature-infrastructure gap limiting nine of your job matches',
      'You are already a member of this community but have not contributed',
      'Your Ridgeline embedding work would be new information to this group',
    ],
    attendees: [
      { name: 'Nadia Rhee', role: 'Presenting a problem', id: 'nadia-rhee' },
    ],
    prep: ['This is the lowest-risk place to first describe the embedding pipeline work publicly.'],
  },
];

export function eventById(id) {
  return events.find((e) => e.id === id);
}

/** Suggested next actions for the right rail — ordered by leverage, not recency. */
export const nextActions = {
  'job-hunting': [
    { id: 'na-k8s', label: 'Publish the Kubernetes operator work', effort: '40 min', payoff: 'Unlocks 12 roles' },
    { id: 'na-halcyon', label: 'Apply to Halcyon before the shortlist closes', effort: '1 hr', payoff: '87% match, favourable odds' },
    { id: 'na-theo', label: 'Reply to Theo Marsh\'s thread', effort: '15 min', payoff: 'Warm path to 3 open roles' },
    { id: 'na-feature', label: 'Feature your lakehouse article on your profile', effort: '2 min', payoff: 'Best evidence, front page' },
  ],
  hiring: [
    { id: 'na-band', label: 'Review the posted band against market', effort: '30 min', payoff: 'Addresses 2 declined finalists' },
    { id: 'na-jd', label: 'Rewrite the Kubernetes requirement', effort: '20 min', payoff: 'Stops filtering out good candidates' },
    { id: 'na-imani', label: 'Contact Imani Brooks', effort: '15 min', payoff: '93% match, publicly open' },
    { id: 'na-panel', label: 'Rebalance the interviewer pool', effort: '15 min', payoff: 'Cuts 9-day scheduling delay' },
  ],
  learning: [
    { id: 'na-paper', label: 'Read the Raft membership paper before Thursday', effort: '1 hr', payoff: 'Entry to Wei Lin\'s group' },
    { id: 'na-imanipost', label: 'Read Imani\'s exactly-once post-mortem', effort: '14 min', payoff: 'Covers your April failure mode' },
    { id: 'na-mlgap', label: 'Work through the feature-store compliance piece', effort: '11 min', payoff: 'Your weakest skill signal' },
  ],
  networking: [
    { id: 'na-priya', label: 'Message Priya about the partition disagreement', effort: '15 min', payoff: 'Substantive opening, not a pitch' },
    { id: 'na-summit', label: 'Decide on DataEng Summit', effort: '5 min', payoff: '4 useful contacts in one day' },
    { id: 'na-dal', label: 'Request Data Architecture Leadership membership', effort: '10 min', payoff: 'Staff+ only, verified' },
  ],
  mentoring: [
    { id: 'na-question', label: 'Answer the partitioning question you were named in', effort: '20 min', payoff: 'Asked for by name' },
    { id: 'na-mentee', label: 'Confirm two unconfirmed mentee relationships', effort: '5 min', payoff: 'Evidence, not claims' },
    { id: 'na-office', label: 'Open two office-hour slots in Staff+ Forum', effort: '10 min', payoff: 'Your lowest-effort mentorship signal' },
  ],
  building: [
    { id: 'na-jonas', label: 'Read Tessellate\'s product thesis', effort: '20 min', payoff: 'Overlaps your published research' },
    { id: 'na-oss', label: 'Finish the connector PR you left open in March', effort: '2 hrs', payoff: 'Open-source signal is 64' },
    { id: 'na-wei', label: 'Ask Wei Lin about the dbt package roadmap', effort: '10 min', payoff: 'You already depend on it' },
  ],
  exploring: [
    { id: 'na-transition', label: 'Read the three engineer-to-architect transitions', effort: '25 min', payoff: 'People who did what you want' },
    { id: 'na-adjacent', label: 'Look at ML platform roles, not data platform roles', effort: '15 min', payoff: 'Adjacent field, 9 roles' },
    { id: 'na-nadia', label: 'Ask Nadia Rhee how she made the move', effort: '15 min', payoff: 'Same company, two years ahead' },
  ],
};

/** Summary cards, per intent. */
export const summaryCards = {
  'job-hunting': [
    { id: 'sc-matches', value: '12', label: 'Strong role matches', note: '4 added this week', route: 'jobs' },
    { id: 'sc-managers', value: '7', label: 'Relevant hiring managers', note: '3 recently viewed profiles like yours', route: 'network' },
    { id: 'sc-gaps', value: '2', label: 'Skill gaps affecting matches', note: 'Kubernetes visibility and cost optimisation', route: 'profile' },
    { id: 'sc-convos', value: '5', label: 'High-value conversations', note: 'People discussing your core expertise', route: 'knowledge' },
  ],
  hiring: [
    { id: 'sc-cands', value: '9', label: 'High-potential candidates', note: '5 surfaced on evidence, not keywords', route: 'network' },
    { id: 'sc-referrals', value: '4', label: 'Warm referral paths', note: 'Someone on your team can vouch', route: 'network' },
    { id: 'sc-pipeline', value: '11', label: 'Candidates in process', note: '1 offer out, 3 at final panel', route: 'career-agent' },
    { id: 'sc-blockers', value: '3', label: 'Hiring bottlenecks', note: 'Scheduling, band, and the job description', route: 'career-agent' },
  ],
  learning: [
    { id: 'sc-depth', value: '6', label: 'Pieces worth your evening', note: 'Filtered from 240 candidates', route: 'knowledge' },
    { id: 'sc-gap2', value: '2', label: 'Gaps with material published this week', note: 'Feature infrastructure and Kubernetes', route: 'profile' },
    { id: 'sc-groups', value: '3', label: 'Working groups accepting members', note: 'Contribution expected, not optional', route: 'network' },
    { id: 'sc-people', value: '4', label: 'Practitioners ahead of you on this path', note: 'Made the transition you are considering', route: 'network' },
  ],
  networking: [
    { id: 'sc-convo', value: '5', label: 'Conversations with a real opening', note: 'You have something specific to say', route: 'network' },
    { id: 'sc-events', value: '3', label: 'Events worth the time', note: 'Filtered from 47 in your area', route: 'network' },
    { id: 'sc-intros', value: '4', label: 'Introduction paths available', note: 'Through people who know your work', route: 'network' },
    { id: 'sc-comm', value: '2', label: 'Communities matching your practice', note: 'Verified membership, not open sign-up', route: 'network' },
  ],
  mentoring: [
    { id: 'sc-asked', value: '3', label: 'Questions you were named in', note: 'People asked for you specifically', route: 'knowledge' },
    { id: 'sc-mentees', value: '6', label: 'Engineers you have mentored', note: '4 confirmed, 2 pending confirmation', route: 'profile' },
    { id: 'sc-seekers', value: '7', label: 'People seeking your exact experience', note: 'Batch-to-streaming transitions', route: 'network' },
    { id: 'sc-mdim', value: '74', label: 'Mentorship reputation', note: 'Below peers at your level, who average 9 mentees', route: 'career-agent' },
  ],
  building: [
    { id: 'sc-collab', value: '4', label: 'Potential collaborators', note: 'Working on adjacent problems', route: 'network' },
    { id: 'sc-oss', value: '2', label: 'Open contributions awaiting you', note: 'One PR open since March', route: 'profile' },
    { id: 'sc-founders', value: '3', label: 'Founders in your problem space', note: 'Hiring or looking for technical partners', route: 'network' },
    { id: 'sc-probs', value: '5', label: 'Problems being discussed publicly', note: 'You have solved three of them', route: 'knowledge' },
  ],
  exploring: [
    { id: 'sc-adj', value: '9', label: 'Roles in adjacent fields', note: 'ML platform, not data platform', route: 'jobs' },
    { id: 'sc-trans', value: '3', label: 'Transition stories worth reading', note: 'Engineering into architecture', route: 'knowledge' },
    { id: 'sc-unfam', value: '4', label: 'Unfamiliar but relevant practitioners', note: 'Outside your current field', route: 'network' },
    { id: 'sc-skillmap', value: '2', label: 'Skills that transfer further than you think', note: 'Streaming and cost modelling', route: 'profile' },
  ],
};
