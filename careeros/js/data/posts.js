/**
 * Knowledge Feed content.
 *
 * Each post carries: the reason it surfaced, the quality attributes the ranker
 * actually rewarded, and metrics that describe usefulness rather than reach.
 */

export const feedTabs = [
  { id: 'for-you', label: 'For you' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'ai-engineering', label: 'AI Engineering' },
  { id: 'hiring', label: 'Hiring insights' },
  { id: 'career', label: 'Career lessons' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'saved', label: 'Saved' },
];

export const qualityFilters = [
  { id: 'original', label: 'Original analysis' },
  { id: 'evidence', label: 'Evidence included' },
  { id: 'practitioner', label: 'Practitioner experience' },
  { id: 'sourced', label: 'Peer-reviewed or sourced' },
  { id: 'hiring', label: 'Hiring relevance' },
  { id: 'depth', label: 'Technical depth' },
];

export const feedPriorities = [
  { id: 'opportunities', label: 'Career opportunities' },
  { id: 'depth', label: 'Technical depth' },
  { id: 'industry', label: 'Industry knowledge' },
  { id: 'network', label: 'Network activity' },
  { id: 'balanced', label: 'Balanced' },
];

export const reactions = [
  { id: 'helpful', label: 'Helpful' },
  { id: 'insightful', label: 'Insightful' },
  { id: 'experienced', label: 'Experienced this' },
  { id: 'challenge', label: 'Challenge this' },
];

export const posts = [
  {
    id: 'post-wei',
    author: 'Wei Lin',
    authorId: 'wei-lin',
    initials: 'WL',
    role: 'Staff Engineer, Distributed Systems',
    company: 'Meridian',
    posted: '2 days ago',
    readTime: '9 min',
    tabs: ['for-you', 'architecture'],
    topic: 'Distributed systems',
    title: 'Why most "real-time" pipelines are lying to you',
    summary:
      'A practical breakdown of the gap between advertised and actual freshness in streaming systems, '
      + 'including three instrumentation changes that expose hidden latency.',
    reason: 'Because you follow distributed systems',
    reasonDetail: [
      'You have read and saved four pieces on streaming freshness in the last 90 days',
      'The author\'s stack overlaps yours at 92%',
      'This post cites the same two papers your April article referenced',
    ],
    quality: ['original', 'evidence', 'practitioner', 'depth'],
    qualityNote: 'Ranked up: firsthand measurements from a production system, with the measurement method shown.',
    metrics: {
      helpful: 212,
      comments: 34,
      saved: 18,
      hiringViews: 7,
    },
    excerpt:
      'The dashboard said four seconds. The dashboard was measuring the time between two points that both sat '
      + 'inside the consumer. Nobody had instrumented the part where the event waited.',
  },
  {
    id: 'post-sofia',
    author: 'Sofia Bianchi',
    authorId: 'sofia-bianchi',
    initials: 'SB',
    role: 'Talent Partner',
    company: 'Anchorline',
    posted: '3 days ago',
    readTime: '6 min',
    tabs: ['for-you', 'hiring'],
    topic: 'Hiring',
    title: 'What actually gets a data engineering résumé past me',
    summary:
      'Lessons from more than 400 résumé reviews, including why vague claims such as "led migration" '
      + 'without measurable impact usually fail.',
    reason: 'Matches your job-hunting intent',
    reasonDetail: [
      'Your active intent is job hunting',
      'The author has two open roles in a stated target industry',
      'Her measured candidate-response rate is 92%, so the advice is from someone who replies',
    ],
    quality: ['practitioner', 'evidence', 'hiring'],
    qualityNote: 'Ranked up: a specific sample size and a named failure pattern, not general encouragement.',
    metrics: {
      helpful: 486,
      comments: 61,
      saved: 143,
      hiringViews: 12,
    },
    excerpt:
      '"Led the migration" tells me you were present. "Cut p95 freshness from 42 minutes to 9 across 40 '
      + 'pipelines, and here is what broke" tells me what you would do at my company.',
  },
  {
    id: 'post-priya',
    author: 'Priya Ramaswami',
    authorId: 'priya-ramaswami',
    initials: 'PR',
    role: 'Senior Data Engineer',
    company: 'Northwind',
    posted: '5 days ago',
    readTime: '12 min',
    tabs: ['for-you', 'architecture'],
    topic: 'Lakehouse architecture',
    title: 'Table format migrations: a decision framework, not a trend to chase',
    summary:
      'A framework for deciding whether a format migration will produce measurable value this year, '
      + 'including the three conditions under which it will not.',
    reason: 'You and the author write about lakehouse design',
    reasonDetail: [
      'You published on this topic in the same month',
      'She reaches a different conclusion on partition strategy than your June piece',
      'She works on a team with an open role you match at 84%',
    ],
    quality: ['original', 'evidence', 'practitioner', 'depth', 'sourced'],
    qualityNote: 'Ranked up: disagrees with the prevailing view and shows the numbers behind the disagreement.',
    metrics: {
      helpful: 174,
      comments: 42,
      saved: 91,
      hiringViews: 4,
    },
    excerpt:
      'Most migration decks open with the benchmark. Mine opens with the question nobody asks: what breaks '
      + 'for the analysts on the Tuesday after cutover?',
    disagreement: 'Directly contradicts your June conclusion on partition granularity. Worth reading for that reason.',
  },
  {
    id: 'post-amara',
    author: 'Amara Osei',
    authorId: 'amara-osei',
    initials: 'AO',
    role: 'VP Engineering',
    company: 'Fathom Health AI',
    posted: '1 week ago',
    readTime: '7 min',
    tabs: ['for-you', 'career', 'leadership'],
    topic: 'Career',
    title: 'The Staff promotion case I almost rejected',
    summary:
      'A story about why visible scope and actual organisational impact are not always the same, and what '
      + 'the packet was missing the first time.',
    reason: 'Career lesson from a hiring VP in your target industry',
    reasonDetail: [
      'She is the hiring manager on a role you match at 89%',
      'Directly addresses the leadership dimension currently limiting your Principal-level matches',
      'Healthcare technology — a stated industry preference',
    ],
    quality: ['practitioner', 'original', 'hiring'],
    qualityNote: 'Ranked up: firsthand decision-making from someone who holds the decision.',
    metrics: {
      helpful: 329,
      comments: 58,
      saved: 204,
      hiringViews: 3,
    },
    excerpt:
      'The packet listed eleven projects. What it never did was explain which decision, made by this engineer, '
      + 'would not have happened without them.',
  },
  {
    id: 'post-nadia',
    author: 'Nadia Rhee',
    authorId: 'nadia-rhee',
    initials: 'NR',
    role: 'Principal Engineer',
    company: 'Ridgeline Health',
    posted: '4 days ago',
    readTime: '11 min',
    tabs: ['for-you', 'ai-engineering', 'architecture'],
    topic: 'AI platforms',
    title: 'A feature store is a cache with a compliance problem',
    summary:
      'What changed when we put clinical features behind an audit boundary, and why the serving path was the '
      + 'easy part.',
    reason: 'Relevant to a skill gap affecting 9 of your job matches',
    reasonDetail: [
      'ML / feature infrastructure is your weakest signal at 41',
      'Nine roles you are targeting list it as a primary requirement',
      'The author is a colleague who could validate your own work in this area',
    ],
    quality: ['original', 'practitioner', 'depth', 'evidence'],
    qualityNote: 'Ranked up: covers the failure modes, including the design they had to abandon.',
    metrics: {
      helpful: 156,
      comments: 27,
      saved: 88,
      hiringViews: 6,
    },
    excerpt:
      'Serving a feature in eight milliseconds is a solved problem. Proving, two years later, which version of '
      + 'that feature a model saw is not.',
    gapLink: 'ml-infra',
  },
  {
    id: 'post-theo',
    author: 'Theo Marsh',
    authorId: 'theo-marsh',
    initials: 'TM',
    role: 'Engineering Manager, AI Platform',
    company: 'Solstice Labs',
    posted: '12 days ago',
    readTime: '5 min',
    tabs: ['for-you', 'leadership', 'hiring'],
    topic: 'Platform ownership',
    title: 'Who carries the pager for the platform?',
    summary:
      'We tripled the team and lost the answer to that question. How we rebuilt an ownership model without '
      + 'adding a process layer.',
    reason: 'Posted by a hiring manager in your target industry',
    reasonDetail: [
      'He has three open roles matching your profile',
      'You have both written about operational ownership this month',
      'This is a reasonable, non-transactional reason to start a conversation',
    ],
    quality: ['practitioner', 'original'],
    qualityNote: 'Ranked up: describes a real reorganisation, including what it cost.',
    metrics: {
      helpful: 98,
      comments: 19,
      saved: 41,
      hiringViews: 2,
    },
    excerpt:
      'Eleven engineers, three services, and a rotation that everybody assumed somebody else was on.',
    conversationHook: true,
  },
  {
    id: 'post-lena',
    author: 'Lena Vogt',
    authorId: 'cand-lena',
    initials: 'LV',
    role: 'Data Platform Lead',
    company: 'Cobalt Health',
    posted: '2 weeks ago',
    readTime: '8 min',
    tabs: ['ai-engineering', 'leadership'],
    topic: 'Team design',
    title: 'Growing a platform team from three to nine without becoming a service desk',
    summary:
      'The intake process we built, the two things we refused to take on, and the metric we used to decide.',
    reason: 'Relevant to your stated goal of platform leadership',
    reasonDetail: [
      'Your goal is data platform leadership within 6–9 months',
      'Leadership is your lowest reputation dimension at 61',
      'She works at a company with a role you match at 72%',
    ],
    quality: ['practitioner', 'original', 'evidence'],
    qualityNote: 'Ranked up: names the trade-offs and the things that did not work.',
    metrics: {
      helpful: 143,
      comments: 31,
      saved: 76,
      hiringViews: 5,
    },
    excerpt:
      'A platform team that says yes to everything is an understaffed operations team with a better title.',
  },
  {
    id: 'post-imani',
    author: 'Imani Brooks',
    authorId: 'cand-imani',
    initials: 'IB',
    role: 'Senior Data Engineer',
    company: 'Northwind',
    posted: '3 days ago',
    readTime: '14 min',
    tabs: ['architecture', 'ai-engineering'],
    topic: 'Streaming systems',
    title: 'Exactly-once, and the four places we were quietly wrong',
    summary:
      'A migration post-mortem with the benchmark harness attached, covering the duplicate-delivery path we '
      + 'did not find for six weeks.',
    reason: 'Cited by two people you follow',
    reasonDetail: [
      'Wei Lin and Priya Ramaswami both referenced this piece',
      'Covers the failure mode your own team encountered in April',
      'Benchmark harness is public and reproducible',
    ],
    quality: ['original', 'evidence', 'practitioner', 'depth', 'sourced'],
    qualityNote: 'Ranked up: published the harness, so the claims can be checked.',
    metrics: {
      helpful: 267,
      comments: 46,
      saved: 132,
      hiringViews: 9,
    },
    excerpt:
      'We had the word "idempotent" in three design documents and in none of the code paths that needed it.',
  },
];

export function postById(id) {
  return posts.find((p) => p.id === id);
}

/**
 * What the ranker demotes and rewards. Shown to the user rather than hidden,
 * because a filter nobody can inspect is just a different kind of black box.
 */
export const noiseFilter = {
  demoted: [
    'Engagement bait and "comment ALGORITHM to receive my framework"',
    'Copy-paste motivational posts',
    'Generic AI-generated content with no firsthand detail',
    'Fake or expired hiring announcements',
    'Recycled viral stories with the names changed',
    'Political arguments unrelated to professional practice',
    'Vacation posts with a forced professional lesson attached',
    'Low-effort polls',
    'Excessive self-promotion',
    'Comment farming',
    'Repeated reposts of the same content',
    'Claimed expertise with no demonstrated work behind it',
    'Empty thought leadership',
  ],
  rewarded: [
    'Original thinking',
    'Firsthand experience',
    'Measurable outcomes',
    'Technical depth',
    'Useful frameworks',
    'Respectful disagreement',
    'High-quality questions',
    'Credible sources',
    'Helpful comments',
    'Professional generosity',
  ],
  suppressedToday: [
    { count: 34, label: 'engagement-bait posts', example: '"Agree? 👇" with no substance attached' },
    { count: 21, label: 'template-generated posts', example: 'Same six-paragraph structure, different author' },
    { count: 9, label: 'expired or unverifiable job announcements', example: 'Role closed 40+ days ago' },
    { count: 6, label: 'recycled viral anecdotes', example: 'Previously published under two other names' },
  ],
};
