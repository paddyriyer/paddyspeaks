/**
 * People recommendations — "People Who Can Help You Grow".
 *
 * `match` is a weighted score over the `factors` listed on each person. Mutual
 * connections appear as one weak factor at most, never as the driver.
 */

export const matchBasis =
  'Match percentage is based on shared expertise, hiring activity, professional '
  + 'goals and demonstrated work — not profile popularity.';

export const notUsed = [
  'Ethnicity', 'Gender', 'Age', 'Personal appearance',
  'Unrelated social activity', 'Follower count', 'Photo quality',
];

export const people = [
  {
    id: 'renata-okafor',
    name: 'Renata Okafor',
    initials: 'RO',
    role: 'Technical Recruiter',
    company: 'Cedarpoint Data',
    location: 'San Francisco Bay Area',
    match: 94,
    confidence: 'High',
    intents: ['job-hunting', 'networking'],
    tag: 'Hiring now',
    reason:
      'Placed five data architects last quarter and is actively sourcing for two roles that match your target titles.',
    evidence: [
      'Filled 5 similar roles in 90 days',
      '96% candidate response rate',
      'Posts weekly about hiring process quality',
      'Both open roles are California, hybrid',
    ],
    factors: [
      { label: 'Active hiring for your target titles', weight: 'Primary' },
      { label: 'Role-to-skill overlap across her two open roles', weight: 'Primary' },
      { label: 'Track record of responding to candidates', weight: 'Supporting' },
      { label: 'Located in your preferred region', weight: 'Supporting' },
      { label: 'One trusted mutual connection', weight: 'Weak' },
    ],
    intro: {
      via: 'Nadia Rhee',
      viaRole: 'Principal Engineer, Ridgeline Health',
      note: 'Nadia was placed by Renata in 2024 and has offered introductions before.',
    },
    recruiterTrust: 'sofia-style',
  },
  {
    id: 'theo-marsh',
    name: 'Theo Marsh',
    initials: 'TM',
    role: 'Engineering Manager, AI Platform',
    company: 'Solstice Labs',
    location: 'Oakland, CA',
    match: 88,
    confidence: 'High',
    intents: ['job-hunting', 'networking', 'building'],
    tag: 'Hiring manager',
    reason:
      'Growing an AI platform team with three roles aligned to your recent projects.',
    evidence: [
      '3 open roles, two at your level',
      'Stack overlap: Kubernetes, Spark, Python',
      'Team grew from 4 to 11 this year',
      'Wrote about operational ownership two weeks ago',
    ],
    factors: [
      { label: 'Hiring three roles matching your profile', weight: 'Primary' },
      { label: '88% skill overlap with the posted requirements', weight: 'Primary' },
      { label: 'Published on your areas of interest', weight: 'Supporting' },
      { label: 'Within your preferred geography', weight: 'Supporting' },
      { label: 'Two trusted professional connections', weight: 'Weak' },
    ],
    intro: {
      via: 'Priya Ramaswami',
      viaRole: 'Senior Data Engineer, Northwind',
      note: 'Priya and Theo co-presented at DataEng Summit last year.',
    },
    draftContext: {
      why: 'He is hiring for the exact transition you are trying to make, and he writes publicly about how the team works.',
      shared: 'You have both written about operational ownership of data platforms in the last month.',
      recent: 'Post: "Who carries the pager for the platform?" — 12 days ago',
      appropriate: 'A peer-level conversation about the team\'s current priorities. Not a résumé submission.',
    },
  },
  {
    id: 'priya-ramaswami',
    name: 'Priya Ramaswami',
    initials: 'PR',
    role: 'Senior Data Engineer',
    company: 'Northwind',
    location: 'Berkeley, CA',
    match: 91,
    confidence: 'High',
    intents: ['networking', 'learning', 'building'],
    tag: 'Peer',
    reason:
      'You both published about lakehouse architecture during the same month, reaching different conclusions.',
    evidence: [
      'Shared research references across three sources',
      'Speaking at DataEng Summit — Infrastructure Track',
      'Active in two of your communities',
      'Her migration post disagrees with yours on partition strategy',
    ],
    factors: [
      { label: 'Overlapping published work on the same problem', weight: 'Primary' },
      { label: 'Shared technical stack and reading', weight: 'Primary' },
      { label: 'Speaking at an event you are considering', weight: 'Supporting' },
      { label: 'Two shared communities', weight: 'Supporting' },
    ],
    intro: null,
  },
  {
    id: 'jonas-ferreira',
    name: 'Jonas Ferreira',
    initials: 'JF',
    role: 'Founder',
    company: 'Tessellate',
    location: 'Remote (Lisbon / SF)',
    match: 85,
    confidence: 'Medium',
    intents: ['building', 'exploring', 'job-hunting'],
    tag: 'Building',
    reason:
      'Building event-driven lakehouse tooling closely related to your research.',
    evidence: [
      'Hiring a founding data engineer',
      'Recently raised seed funding',
      'Product thesis overlaps with your recent posts',
      'Small team — higher scope, higher risk than your other matches',
    ],
    factors: [
      { label: 'Product thesis overlaps your published research', weight: 'Primary' },
      { label: 'Open founding role at or above your level', weight: 'Primary' },
      { label: 'Remote-first, matches your work model', weight: 'Supporting' },
      { label: 'Confidence reduced: no mutual professional context yet', weight: 'Caveat' },
    ],
    intro: null,
  },
  {
    id: 'amara-osei',
    name: 'Amara Osei',
    initials: 'AO',
    role: 'VP Engineering',
    company: 'Fathom Health AI',
    location: 'San Francisco, CA',
    match: 90,
    confidence: 'High',
    intents: ['job-hunting', 'mentoring', 'networking'],
    tag: 'Hiring leader',
    reason:
      'Four of her last six hires had backgrounds similar to yours.',
    evidence: [
      'Frequently hires staff-level engineers from healthcare-adjacent data work',
      'Team supports remote work',
      'Known for transparent hiring loops — publishes the rubric in advance',
      'Wrote about promotion scope this month',
    ],
    factors: [
      { label: 'Hiring pattern closely matches your background', weight: 'Primary' },
      { label: 'Owns two open roles you match above 85%', weight: 'Primary' },
      { label: 'Healthcare technology — a stated industry preference', weight: 'Supporting' },
      { label: 'Writes publicly on the scope question limiting your level', weight: 'Supporting' },
    ],
    intro: {
      via: 'Wei Lin',
      viaRole: 'Staff Engineer, Meridian',
      note: 'Wei and Amara ran a shared reading group for a year.',
    },
  },
  {
    id: 'wei-lin',
    name: 'Wei Lin',
    initials: 'WL',
    role: 'Staff Engineer, Distributed Systems',
    company: 'Meridian',
    location: 'San Jose, CA',
    match: 92,
    confidence: 'High',
    intents: ['networking', 'learning', 'building'],
    tag: 'Peer',
    reason:
      'Strong overlap across Spark, dbt, Airflow, streaming and platform architecture.',
    evidence: [
      'Maintains a widely used dbt package',
      'Hosts a systems reading group you could join',
      'Published on similar architecture problems',
      'Has taken the exact career step you are considering',
    ],
    factors: [
      { label: '92% technical stack overlap', weight: 'Primary' },
      { label: 'Made the engineering-to-architecture transition you are targeting', weight: 'Primary' },
      { label: 'Maintains open-source work you already depend on', weight: 'Supporting' },
      { label: 'Hosts a recurring practitioner group', weight: 'Supporting' },
    ],
    intro: null,
  },
  {
    id: 'nadia-rhee',
    name: 'Nadia Rhee',
    initials: 'NR',
    role: 'Principal Engineer',
    company: 'Ridgeline Health',
    location: 'San Francisco, CA',
    match: 87,
    confidence: 'High',
    intents: ['mentoring', 'networking'],
    tag: 'Mentor',
    reason:
      'Moved from staff engineering into platform architecture at the same company, two years ahead of you.',
    evidence: [
      'Made the transition you are targeting, in your industry',
      'Has mentored four engineers to Principal',
      'Can validate the Kubernetes scope missing from your evidence',
    ],
    factors: [
      { label: 'Completed your target career transition', weight: 'Primary' },
      { label: 'Mentorship history with confirmed outcomes', weight: 'Primary' },
      { label: 'Direct knowledge of your actual work', weight: 'Supporting' },
    ],
    intro: null,
  },
  {
    id: 'sofia-bianchi',
    name: 'Sofia Bianchi',
    initials: 'SB',
    role: 'Talent Partner',
    company: 'Anchorline',
    location: 'Remote (California)',
    match: 83,
    confidence: 'Medium',
    intents: ['job-hunting'],
    tag: 'Recruiter',
    reason:
      'Reviews data engineering résumés at volume and publishes what actually passes her screen.',
    evidence: [
      '400+ résumé reviews documented publicly',
      'Two roles open in fintech data platform',
      'Response time averages 4 hours',
    ],
    factors: [
      { label: 'Two open roles in a stated target industry', weight: 'Primary' },
      { label: 'Strong measured candidate-response record', weight: 'Supporting' },
      { label: 'Confidence reduced: no stack-level detail in her postings yet', weight: 'Caveat' },
    ],
    intro: null,
    recruiterTrust: true,
  },
];

export function personById(id) {
  return people.find((p) => p.id === id);
}

/** Recruiter trust metrics — aggregated, never presented as a public shaming score. */
export const recruiters = [
  {
    id: 'sofia-bianchi',
    name: 'Sofia Bianchi',
    initials: 'SB',
    role: 'Talent Partner at Anchorline',
    sample: 'Based on 142 verified candidate interactions over 12 months',
    metrics: [
      { label: 'Average response time', value: '4 hours', band: 'strong', range: '3–7 hours' },
      { label: 'Candidate response rate', value: '92%', band: 'strong', range: '±4 points' },
      { label: 'Ghosting rate', value: 'Very low', band: 'strong', range: 'Under 3% of conversations' },
      { label: 'Interview transparency', value: 'Excellent', band: 'strong', range: 'Shares loop and rubric up front' },
      { label: 'Offer acceptance', value: 'Above company average', band: 'strong', range: 'Confidence: medium' },
      { label: 'Role accuracy', value: 'High', band: 'strong', range: 'Posted scope matched actual scope in 9 of 10 cases' },
      { label: 'Candidate satisfaction', value: '4.5 / 5', band: 'strong', range: '86 responses' },
      { label: 'Hiring manager satisfaction', value: '4.3 / 5', band: 'strong', range: '19 responses' },
    ],
  },
  {
    id: 'renata-okafor',
    name: 'Renata Okafor',
    initials: 'RO',
    role: 'Technical Recruiter at Cedarpoint Data',
    sample: 'Based on 96 verified candidate interactions over 9 months',
    metrics: [
      { label: 'Average response time', value: '6 hours', band: 'strong', range: '4–11 hours' },
      { label: 'Candidate response rate', value: '96%', band: 'strong', range: '±3 points' },
      { label: 'Ghosting rate', value: 'Low', band: 'strong', range: 'Under 6% of conversations' },
      { label: 'Interview transparency', value: 'Good', band: 'medium', range: 'Loop shared, rubric on request' },
      { label: 'Offer acceptance', value: 'At company average', band: 'medium', range: 'Confidence: medium' },
      { label: 'Role accuracy', value: 'High', band: 'strong', range: '5 of 5 placements matched posted scope' },
      { label: 'Candidate satisfaction', value: '4.4 / 5', band: 'strong', range: '61 responses' },
      { label: 'Hiring manager satisfaction', value: 'Not enough data', band: 'unknown', range: 'Fewer than 10 responses' },
    ],
  },
  {
    id: 'dev-kapoor',
    name: 'Dev Kapoor',
    initials: 'DK',
    role: 'Agency Recruiter at Northgate Search',
    sample: 'Based on 210 verified candidate interactions over 12 months',
    metrics: [
      { label: 'Average response time', value: '3 days', band: 'weak', range: '1–9 days' },
      { label: 'Candidate response rate', value: '54%', band: 'weak', range: '±6 points' },
      { label: 'Ghosting rate', value: 'Elevated', band: 'weak', range: '22–29% of conversations' },
      { label: 'Interview transparency', value: 'Limited', band: 'weak', range: 'Company name often withheld until screen' },
      { label: 'Offer acceptance', value: 'Below average', band: 'weak', range: 'Confidence: high' },
      { label: 'Role accuracy', value: 'Mixed', band: 'medium', range: 'Level mismatch reported in 4 of 12 cases' },
      { label: 'Candidate satisfaction', value: '2.9 / 5', band: 'weak', range: '118 responses' },
      { label: 'Hiring manager satisfaction', value: '3.6 / 5', band: 'medium', range: '24 responses' },
    ],
    note:
      'Shown so you can set your own expectations, not to penalise an individual. '
      + 'Agency recruiters often carry roles they do not control. Metrics update monthly and can improve.',
  },
];

export const recruiterNote =
  'These metrics are aggregated, privacy-preserving and based on verified candidate '
  + 'interactions. Individual conversations are never shown to anyone. Figures carry '
  + 'confidence ranges and are suppressed below ten responses.';

/** Candidates surfaced under the Hiring intent. */
export const candidates = [
  {
    id: 'cand-imani',
    name: 'Imani Brooks',
    initials: 'IB',
    role: 'Senior Data Engineer',
    company: 'Northwind',
    match: 93,
    availability: 'Open to conversations',
    availabilityBasis: 'Publicly stated on her profile',
    surfaced:
      'Published a detailed exactly-once migration post three days before your role opened, covering the failure mode your team hit in April.',
    strengths: [
      { label: 'Demonstrated work', detail: 'Migration write-up with reproducible benchmarks' },
      { label: 'Architecture thinking', detail: 'Documents trade-offs, not just outcomes' },
      { label: 'Peer validation', detail: 'Two engineers publicly verified her results' },
      { label: 'Learning velocity', detail: 'Moved from batch to streaming ownership in 14 months' },
    ],
    gaps: ['No people-leadership evidence — relevant if this is a lead role'],
    referral: { via: 'Priya Ramaswami', note: 'Same team, would speak to the work directly' },
  },
  {
    id: 'cand-marcus',
    name: 'Marcus Oyelaran',
    initials: 'MO',
    role: 'Staff Engineer, Platform',
    company: 'Kestrel Systems',
    match: 89,
    availability: 'Not marked open',
    availabilityBasis:
      'No public availability signal. Surfaced on skill evidence alone — his browsing is not visible to you and never will be.',
    surfaced:
      'His demonstrated stack matches 91% of the role requirements, including the multi-tenancy work your last two hires lacked.',
    strengths: [
      { label: 'Relevant projects', detail: 'Built the tenant isolation layer for a 200-team platform' },
      { label: 'Technical writing', detail: 'Three internal RFCs published externally with permission' },
      { label: 'Collaboration', detail: 'Named by four teams as their platform partner' },
    ],
    gaps: ['Has not signalled any interest in moving — approach accordingly'],
    referral: null,
  },
  {
    id: 'cand-lena',
    name: 'Lena Vogt',
    initials: 'LV',
    role: 'Data Platform Lead',
    company: 'Cobalt Health',
    match: 87,
    availability: 'Exploring',
    availabilityBasis: 'Saved two roles in your category this month',
    surfaced:
      'Responded well to two roles with a similar scope and compensation band, and her healthcare data background matches your compliance constraints.',
    strengths: [
      { label: 'Leadership evidence', detail: 'Grew a platform team from 3 to 9' },
      { label: 'Demonstrated work', detail: 'HIPAA-scoped lakehouse in production for three years' },
      { label: 'Architecture thinking', detail: 'Public talk on modelling clinical event data' },
    ],
    gaps: ['Compensation expectation likely above your posted band'],
    referral: { via: 'Amara Osei', note: 'Former colleague' },
  },
  {
    id: 'cand-alex-r',
    name: 'Rafael Duarte',
    initials: 'RD',
    role: 'Senior Engineer, Streaming',
    company: 'Halcyon Financial',
    match: 84,
    availability: 'Rediscovered',
    availabilityBasis: 'Interviewed for a similar role 14 months ago, reached final round',
    surfaced:
      'Previously reached your final round and has since shipped the streaming ownership your panel said he was missing.',
    strengths: [
      { label: 'Learning velocity', detail: 'Closed the exact gap your panel flagged' },
      { label: 'Peer validation', detail: 'Two of your engineers already interviewed him favourably' },
    ],
    gaps: ['Rejected once — the panel feedback should be re-read before contact'],
    referral: { via: 'Your own hiring history', note: 'Panel notes from March 2025 are on file' },
  },
  {
    id: 'cand-yusuf',
    name: 'Yusuf Karim',
    initials: 'YK',
    role: 'Infrastructure Engineer',
    company: 'Independent / contract',
    match: 81,
    availability: 'Available now',
    availabilityBasis: 'Contract ending, stated publicly',
    surfaced:
      'Maintains two of the open-source tools your platform depends on, which is direct evidence of the ownership this role needs.',
    strengths: [
      { label: 'Open-source work', detail: 'Maintainer on a connector in your production path' },
      { label: 'Demonstrated work', detail: 'Public issue history shows how he debugs' },
    ],
    gaps: ['Contract-to-hire history — retention risk worth discussing early'],
    referral: null,
  },
];

export const pipeline = [
  { stage: 'Sourced', count: 24, health: 'ok', note: '9 from evidence-based surfacing, 15 inbound' },
  { stage: 'Screened', count: 11, health: 'ok', note: 'Median 2 days from sourced' },
  { stage: 'Technical', count: 6, health: 'slow', note: 'Median 9 days — scheduling is the bottleneck' },
  { stage: 'Final panel', count: 3, health: 'ok', note: 'All three within your posted band' },
  { stage: 'Offer', count: 1, health: 'ok', note: 'Verbal accepted, paperwork pending' },
];

export const hiringBottlenecks = [
  {
    id: 'bn-scheduling',
    title: 'Technical interviews are taking 9 days to schedule',
    detail:
      'Two of your four interviewers have declined more than half their requests this month. '
      + 'Candidates in the technical stage are 3× more likely to withdraw after day 7.',
    action: 'Rebalance the interviewer pool',
  },
  {
    id: 'bn-band',
    title: 'Your posted band is below three of your five strongest candidates',
    detail:
      'Lena Vogt, Marcus Oyelaran and one inbound candidate have comparable roles paying 8–14% above your ceiling. '
      + 'This is the most likely reason your last two finalists declined.',
    action: 'Review the band against market',
  },
  {
    id: 'bn-jd',
    title: 'Your job description asks for Kubernetes but the work is 80% Spark',
    detail:
      'Candidate questions in the screen stage cluster on this mismatch. It is filtering out '
      + 'people who would succeed and attracting people who would not.',
    action: 'Rewrite the requirements from the actual work',
  },
];
