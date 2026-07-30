/**
 * Profiles.
 *
 * A persona is an identity; a profile is that identity's record. Keeping the
 * two apart matters, because the original build had one record — Alex Chen's —
 * and rendered it underneath whichever name happened to be in force. A recruiter
 * saw a candidate's reputation score. A hiring manager saw a job seeker's skill
 * gaps. The product contradicted itself.
 *
 * Every persona now carries their own record, and the people are the people who
 * already exist in this prototype's world: Wei Lin, Priya Ramaswami, Nadia Rhee,
 * Jonas Ferreira, Lena Vogt, Amara Osei and Renata Okafor all appear in Alex's
 * network. Switching mode switches to a person you can already see from here.
 *
 * Identity — name, title, employer, location — lives in personas.js and is not
 * repeated below. This file holds only the evidence.
 */

import { state } from '../store.js';
import { personaFor } from './personas.js';

const OUT_OF = 1000;

const BASIS =
  'Based on demonstrated work, peer validation, professional contributions and '
  + 'consistency over time. Never based on follower count alone.';

export const profiles = {
  /* ================================================================
     Alex Chen — Staff Data Engineer, Ridgeline Health
     ================================================================ */
  candidate: {
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
    reputation: {
      total: 782,
      outOf: OUT_OF,
      basis: BASIS,
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
    },
    skills: [
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
        evidence: ['Mentioned in two project descriptions'],
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
        evidence: ['Owned a 300-model project', 'Two merged upstream contributions'],
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
        evidence: ['Built a feature store prototype that did not reach production'],
        gaps: [
          'No production ML serving path on record',
          'This is the most common requirement in AI Platform Architect roles you are targeting',
        ],
        strengthen: [
          'The Ridgeline embedding pipeline counts — document it',
          'Two of your target companies weight this above Kubernetes',
        ],
      },
    ],
    evidenceOfWork: [
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
    ],
    timeline: [
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
    ],
    articles: [
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
    ],
    articleNudge: {
      reason:
        'Your strongest piece drew seven times more hiring-manager attention than your profile summary, '
        + 'and it currently sits three clicks below it.',
      cta: 'Feature the lakehouse article at the top',
    },
    mentorship: [
      '6 engineers mentored — 4 confirmed by the mentee, 2 awaiting confirmation',
      '2 mentees promoted during the mentoring period',
      '14 substantive answers to other people\'s architecture questions',
      '3 drafts reviewed for others in Technical Writing for Engineers',
    ],
    mentorshipNote:
      'Two mentee relationships are unconfirmed. Unconfirmed claims are shown to you but not to '
      + 'anyone else, and they do not count toward your mentorship score.',
    communities: [
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
    ],
    visitors: [
      '3 hiring managers arrived from a search for "AI platform + Spark + healthcare"',
      '7 recruiters arrived from your lakehouse article',
      '2 peers arrived from the Distributed Systems community',
    ],
    visitorNote:
      'Median time on your profile: 41 seconds. Most visitors leave at your skills section, which is '
      + 'where your Kubernetes evidence should be.',
  },

  /* ================================================================
     Wei Lin — Staff Engineer, Distributed Systems, Meridian
     ================================================================ */
  professional: {
    thesis:
      'A platform is judged on the week nobody notices it. I work on the unglamorous guarantees — '
      + 'isolation, rollback, and a cost model a team can predict before it ships anything.',
    currentFocus: [
      'Reading the compliance boundary problem properly before designing around it',
      'Hosting the Thursday systems reading group, now in its third year',
      'Maintaining a dbt package used well beyond the team that wrote it',
    ],
    goal: null,
    reputation: {
      total: 814,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 91,
          trend: '+3 in 90 days',
          inputs: [
            '4 design documents adopted outside the team that wrote them',
            'Incident write-ups published with the timeline intact, not sanitised',
            'Peer endorsements from engineers who ran the migration alongside you',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 79,
          trend: '+6 in 90 days',
          inputs: [
            'Median read-through of 68% across 7 published pieces',
            'Two pieces referenced in other companies\' design documents',
            'Shorter and denser than your peers, which reads well and shares badly',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 71,
          trend: '+4 in 90 days',
          inputs: [
            '4 engineers mentored, 3 confirmed by the mentee',
            'Reading group run for 34 consecutive months',
            'No mentoring on record outside your employer',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 77,
          trend: '+5 in 90 days',
          inputs: [
            'Set the multi-tenancy direction for three product groups',
            'Chaired the platform review board for two quarters',
            'Influence is strong internally and thin in public — the reverse of the usual pattern',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 58,
          trend: 'flat',
          inputs: [
            'Active in 1 practitioner community',
            '6 substantive answers this quarter',
            'No talks or working groups on record',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 88,
          trend: '+2 in 90 days',
          inputs: [
            'Design documents co-authored with security and SRE',
            '7 colleagues described your review comments as materially useful',
            'Incident reviews run without a named cause',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 66,
          trend: '+3 in 90 days',
          inputs: [
            '19 interviews conducted, panel feedback rated consistent',
            'Authored the rubric for the platform loop',
            'No end-to-end loop redesign on record',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 83,
          trend: '+4 in 90 days',
          inputs: [
            'Maintainer of a dbt package with 310 dependent projects',
            '3 merged contributions to an admission-controller project',
            'Issue response median under 48 hours across two years',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'wl-multitenancy',
        name: 'Multi-tenant platform design',
        strength: 'Strong',
        level: 90,
        lastDemonstrated: 'This month',
        evidence: [
          'Isolation model in production across 60 services',
          'Design document adopted by three product groups',
        ],
        gaps: [],
      },
      {
        id: 'wl-dbt',
        name: 'dbt / analytics engineering',
        strength: 'Strong',
        level: 87,
        lastDemonstrated: 'This month',
        evidence: [
          'Maintainer of a package with 310 dependent projects',
          'Two years of issue triage with a published response median',
        ],
        gaps: [],
      },
      {
        id: 'wl-compliance',
        name: 'Compliance-boundary design',
        strength: 'Medium',
        level: 62,
        lastDemonstrated: '8 months ago',
        evidence: ['One data-residency partition shipped, under legal review'],
        gaps: [
          'You have read more about this than you have built',
          'No write-up that another team could follow',
        ],
        strengthen: [
          'The residency partition is the strongest thing you have here and it is entirely undocumented',
        ],
      },
      {
        id: 'wl-tracing',
        name: 'Distributed tracing',
        strength: 'Medium',
        level: 59,
        lastDemonstrated: 'This year',
        evidence: ['Instrumented the platform ingress path'],
        gaps: ['Instrumentation stops at the service boundary, which is where the questions start'],
      },
      {
        id: 'wl-writing',
        name: 'Technical writing',
        strength: 'Strong',
        level: 81,
        lastDemonstrated: 'This quarter',
        evidence: ['7 published pieces', 'Two cited in external design documents'],
        gaps: [],
      },
    ],
    evidenceOfWork: [
      {
        id: 'wl-ev-incidents',
        claim: 'Cut platform incident minutes by 61%',
        detail: 'Meridian, 2025. Measured across four quarters of incident data by the reliability group.',
        verified: 'Verified by employer',
      },
      {
        id: 'wl-ev-package',
        claim: 'Maintains a dbt package with 310 dependent projects',
        detail: 'Two years of maintenance with a published issue-response median under 48 hours.',
        verified: 'Public artefact',
      },
      {
        id: 'wl-ev-group',
        claim: 'Runs a systems reading group in its 34th month',
        detail: 'Open to practitioners outside Meridian. Eleven regulars from six companies.',
        verified: 'External participation confirmed',
      },
    ],
    timeline: [
      {
        period: '2022 — present',
        role: 'Staff Engineer, Distributed Systems',
        org: 'Meridian',
        outcome: 'Owns the internal platform behind 60 services. Incident minutes down 61%, cost per service down 22%.',
      },
      {
        period: '2018 — 2022',
        role: 'Senior Infrastructure Engineer',
        org: 'Alder & Finch',
        outcome: 'Built the container platform. Learned what happens when isolation is an afterthought.',
      },
      {
        period: '2015 — 2018',
        role: 'Systems Engineer',
        org: 'Kestrel Systems',
        outcome: 'On-call for a fleet that made the case for a boring release process better than any document could.',
      },
    ],
    articles: [
      {
        id: 'wl-art-tenancy',
        title: 'The multi-tenancy failures you only find in year two',
        date: 'May 2026',
        signal: 'Referenced in two external design documents',
      },
      {
        id: 'wl-art-cost',
        title: 'Cost per service is a design decision, not a finance report',
        date: 'January 2026',
        signal: 'Most-saved of your pieces',
      },
    ],
    articleNudge: {
      reason:
        'Your multi-tenancy piece is the only thing you have written that other companies cite, and it is '
        + 'the fourth item on your profile.',
      cta: 'Move the multi-tenancy piece to the top',
    },
    mentorship: [
      '4 engineers mentored — 3 confirmed by the mentee',
      'Systems reading group run for 34 consecutive months',
      '6 substantive answers in the Distributed Systems community this quarter',
    ],
    mentorshipNote:
      'One mentee relationship is unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'wl-com-ds',
        name: 'Distributed Systems Practitioners',
        members: '4,100 practitioners',
        basis: 'Membership requires a demonstrated systems contribution. No open sign-up.',
        yourRole: 'Member · hosts the Thursday reading group',
      },
      {
        id: 'wl-com-plat',
        name: 'Platform Engineering Forum',
        members: '3,400 practitioners',
        basis: 'Working sessions on isolation, tenancy and internal developer platforms.',
        yourRole: 'Member · reading, not yet contributing',
        suggestion: 'Your residency-partition work would be new information to this group.',
      },
      {
        id: 'wl-com-tw',
        name: 'Technical Writing for Engineers',
        members: '1,800 practitioners',
        basis: 'Draft exchange and structured critique. Contribution expected, not optional.',
        yourRole: 'Not a member',
        suggestion: 'The compliance write-up you keep postponing is exactly what this group is for.',
      },
    ],
    visitors: [
      '4 engineers arrived from your multi-tenancy write-up',
      '3 practitioners arrived from the dbt package repository',
      '2 peers arrived from the Distributed Systems community',
    ],
    visitorNote:
      'Median time on your profile: 1 minute 12 seconds. No recruiter traffic — job-search signals are '
      + 'switched off in this mode, and nothing here is offered to them.',
  },

  /* ================================================================
     Priya Ramaswami — Senior Data Engineer, Northwind
     ================================================================ */
  connector: {
    thesis:
      'Most of what I know came from someone willing to disagree with me in public. I try to be that '
      + 'person for other people, which mostly means writing down the argument rather than the conclusion.',
    currentFocus: [
      'Preparing the DataEng Summit infrastructure-track session',
      'A follow-up to the partition-strategy post, this time with the counter-argument',
      'Introducing practitioners who are solving the same problem in different industries',
    ],
    goal: null,
    reputation: {
      total: 768,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 79,
          trend: '+3 in 90 days',
          inputs: [
            '2 lakehouse migrations shipped end to end',
            'Published partition-strategy analysis with the benchmark harness attached',
            'Depth is in modelling decisions rather than systems internals',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 86,
          trend: '+9 in 90 days',
          inputs: [
            'Median read-through of 71% across 9 published pieces',
            '3 pieces cited by practitioners outside your company',
            'You publish the disagreement, not only the conclusion',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 70,
          trend: '+3 in 90 days',
          inputs: [
            '5 people mentored, 3 confirmed by the mentee',
            'Two moved into data platform roles during the period',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 66,
          trend: '+4 in 90 days',
          inputs: [
            'Technical lead on one cross-team migration',
            'Chairs a cross-company practitioner exchange',
            'No org-level direction-setting on record',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 94,
          trend: '+8 in 90 days',
          inputs: [
            'Active in 4 practitioner communities, contributing in all four',
            '31 introductions made between people who had not met',
            'Answers questions well outside your own stack',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 89,
          trend: '+3 in 90 days',
          inputs: [
            'Works across analytics, platform and product data teams',
            '9 colleagues described your facilitation as materially useful',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 48,
          trend: 'new',
          inputs: [
            '6 interviews conducted',
            'Low sample size — treat this number as provisional',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 44,
          trend: 'flat',
          inputs: [
            '1 documentation contribution merged',
            'This dimension carries little weight for your work, and is shown rather than hidden',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'pr-lakehouse',
        name: 'Lakehouse architecture',
        strength: 'Strong',
        level: 84,
        lastDemonstrated: 'This quarter',
        evidence: [
          'Two migrations shipped end to end',
          'Partition-strategy analysis published with the harness',
        ],
        gaps: [],
      },
      {
        id: 'pr-facilitation',
        name: 'Technical facilitation',
        strength: 'Strong',
        level: 91,
        lastDemonstrated: 'This month',
        evidence: [
          'Chairs a cross-company practitioner exchange',
          '31 introductions made between people who had not met',
        ],
        gaps: [],
      },
      {
        id: 'pr-speaking',
        name: 'Conference speaking',
        strength: 'Medium',
        level: 64,
        lastDemonstrated: 'Upcoming',
        evidence: ['Accepted for the DataEng Summit infrastructure track'],
        gaps: ['First talk at this scale — no recording on record yet'],
      },
      {
        id: 'pr-modelling',
        name: 'Dimensional modelling',
        strength: 'Strong',
        level: 82,
        lastDemonstrated: 'This year',
        evidence: ['Owns the shared model layer at Northwind'],
        gaps: [],
      },
    ],
    evidenceOfWork: [
      {
        id: 'pr-ev-partition',
        claim: 'Published a partition-strategy analysis with a reproducible harness',
        detail: 'Reached the opposite conclusion to a widely shared piece, and showed the working.',
        verified: 'Public artefact',
      },
      {
        id: 'pr-ev-exchange',
        claim: 'Runs a 900-member cross-company practitioner exchange',
        detail: 'Four companies, monthly. Attendance is invitation-based on contribution, not seniority.',
        verified: 'External participation confirmed',
      },
      {
        id: 'pr-ev-intros',
        claim: '31 introductions between people who had not met',
        detail: 'Fourteen of the thirty-one are still in contact a year later.',
        verified: '14 confirmed ongoing',
      },
    ],
    timeline: [
      {
        period: '2023 — present',
        role: 'Senior Data Engineer',
        org: 'Northwind',
        outcome: 'Owns the shared model layer. Cut duplicate metric definitions from 140 to 31.',
      },
      {
        period: '2020 — 2023',
        role: 'Data Engineer',
        org: 'Bellhaven Retail',
        outcome: 'Built the first warehouse. Learned how much of the job is disagreement management.',
      },
      {
        period: '2018 — 2020',
        role: 'Analytics Engineer',
        org: 'Corvus Media',
        outcome: 'Reporting layer for a newsroom, where being wrong was visible the same day.',
      },
    ],
    articles: [
      {
        id: 'pr-art-partition',
        title: 'Partition strategy: why I think the popular answer is wrong',
        date: 'June 2026',
        signal: 'Cited by 3 practitioners, contradicted by 1',
      },
      {
        id: 'pr-art-metrics',
        title: 'A hundred and forty definitions of "active customer"',
        date: 'March 2026',
        signal: 'Most-shared of your pieces',
      },
    ],
    articleNudge: {
      reason:
        'The piece that drew disagreement drew four times the readers of the piece that did not. '
        + 'Your profile leads with the one nobody argued about.',
      cta: 'Lead with the partition-strategy piece',
    },
    mentorship: [
      '5 people mentored — 3 confirmed by the mentee',
      '2 mentees moved into data platform roles during the period',
      '31 introductions made between people who had not met',
    ],
    mentorshipNote:
      'Two mentee relationships are unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'pr-com-ds',
        name: 'Distributed Systems Practitioners',
        members: '4,100 practitioners',
        basis: 'Membership requires a demonstrated systems contribution. No open sign-up.',
        yourRole: 'Member · active',
      },
      {
        id: 'pr-com-exchange',
        name: 'Cross-Company Data Exchange',
        members: '900 practitioners',
        basis: 'Invitation based on contribution, not seniority. Four companies, monthly sessions.',
        yourRole: 'Chair',
      },
      {
        id: 'pr-com-tw',
        name: 'Technical Writing for Engineers',
        members: '1,800 practitioners',
        basis: 'Draft exchange and structured critique. Contribution expected, not optional.',
        yourRole: 'Member · 7 drafts reviewed for others',
      },
    ],
    visitors: [
      '9 practitioners arrived from the partition-strategy post',
      '4 people arrived from the DataEng Summit programme',
      '2 peers arrived from the practitioner exchange',
    ],
    visitorNote:
      'Median time on your profile: 1 minute 4 seconds. Most visitors arrive from an argument rather '
      + 'than a search, which is the pattern you would expect and rarely the one people design for.',
  },

  /* ================================================================
     Nadia Rhee — Principal Engineer, Ridgeline Health
     ================================================================ */
  mentor: {
    thesis:
      'Almost nothing that blocks a staff engineer is technical. It is usually that nobody has written '
      + 'down what they already did. I help people write it down, and then they get promoted.',
    currentFocus: [
      'Three promotion cases in progress, two at staff, one at principal',
      'A rubric for platform scope that survives contact with a calibration meeting',
      'Answering the questions in the Staff+ forum that nobody else wants to take',
    ],
    goal: null,
    reputation: {
      total: 861,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 93,
          trend: '+2 in 90 days',
          inputs: [
            'Led the platform migration the current architecture rests on',
            '5 verified project outcomes with named metrics',
            'Two conference sessions on clinical data modelling',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 84,
          trend: '+3 in 90 days',
          inputs: [
            'Median read-through of 69% across 6 published pieces',
            'Your promotion-case piece is quoted in other companies\' calibration guidance',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 96,
          trend: '+4 in 90 days',
          inputs: [
            '19 engineers mentored, 15 confirmed by the mentee',
            '4 mentees reached Principal, 7 reached Staff',
            'Highest mentorship score in your organisation, by a distance',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 88,
          trend: '+5 in 90 days',
          inputs: [
            'Set the platform direction for an organisation of 140 engineers',
            'Authored the staff-scope rubric now used by three orgs',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 76,
          trend: '+4 in 90 days',
          inputs: [
            'Active in 2 practitioner communities',
            '22 substantive answers on scope and promotion cases',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 90,
          trend: 'flat',
          inputs: [
            'Design reviews across clinical, security and platform teams',
            '11 colleagues described your review comments as materially useful',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 81,
          trend: '+6 in 90 days',
          inputs: [
            '46 interviews conducted, calibration lead for the staff loop',
            'Rewrote the architecture interview after measuring its false-negative rate',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 52,
          trend: 'flat',
          inputs: [
            '1 merged contribution in the last two years',
            'Your work is nearly all internal, and this number says so rather than hiding it',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'nr-platform',
        name: 'Platform architecture',
        strength: 'Strong',
        level: 93,
        lastDemonstrated: 'This month',
        evidence: [
          'Led the migration the current Ridgeline architecture rests on',
          'Direction-setting for an organisation of 140 engineers',
        ],
        gaps: [],
      },
      {
        id: 'nr-mentoring',
        name: 'Technical mentoring',
        strength: 'Strong',
        level: 95,
        lastDemonstrated: 'This week',
        evidence: [
          '19 engineers mentored, 15 confirmed',
          '4 mentees reached Principal during the period',
        ],
        gaps: [],
      },
      {
        id: 'nr-scope',
        name: 'Scope and promotion cases',
        strength: 'Strong',
        level: 89,
        lastDemonstrated: 'This month',
        evidence: ['Authored the staff-scope rubric used by three organisations'],
        gaps: [],
      },
      {
        id: 'nr-clinical',
        name: 'Clinical data modelling',
        strength: 'Strong',
        level: 85,
        lastDemonstrated: 'This quarter',
        evidence: ['Two conference sessions', 'Six years inside the constraint'],
        gaps: [],
      },
      {
        id: 'nr-orgdesign',
        name: 'Org design for platform teams',
        strength: 'Medium',
        level: 64,
        lastDemonstrated: 'This year',
        evidence: ['Split one platform team into three with a stated interface between them'],
        gaps: ['One attempt, one company — the sample is too small to generalise from'],
      },
    ],
    evidenceOfWork: [
      {
        id: 'nr-ev-mentees',
        claim: 'Mentored 19 engineers; 4 reached Principal',
        detail: 'Fifteen of the nineteen confirmed the relationship. Promotions are dated and checkable.',
        verified: '15 of 19 confirmed',
      },
      {
        id: 'nr-ev-rubric',
        claim: 'Authored a staff-scope rubric used by three organisations',
        detail: 'Two of the three are outside Ridgeline Health and adopted it unchanged.',
        verified: 'External adoption confirmed',
      },
      {
        id: 'nr-ev-interview',
        claim: 'Cut the architecture interview\'s false-negative rate by measuring it',
        detail: 'Re-interviewed 30 rejected candidates blind. Nine would now pass. The loop changed.',
        verified: 'Verified by employer',
      },
    ],
    timeline: [
      {
        period: '2021 — present',
        role: 'Principal Engineer',
        org: 'Ridgeline Health',
        outcome: 'Platform direction for 140 engineers. Nineteen mentees, four of them now Principal.',
      },
      {
        period: '2016 — 2021',
        role: 'Staff Engineer',
        org: 'Halcyon Financial',
        outcome: 'Made the staff-to-architecture move that half the people who ask you about it are trying to make.',
      },
      {
        period: '2012 — 2016',
        role: 'Senior Engineer',
        org: 'Kestrel Systems',
        outcome: 'Six years of on-call that shaped every opinion you now hold about interfaces.',
      },
    ],
    articles: [
      {
        id: 'nr-art-scope',
        title: 'What staff scope actually looks like on a Tuesday',
        date: 'April 2026',
        signal: 'Quoted in three companies\' calibration guidance',
      },
      {
        id: 'nr-art-featurestore',
        title: 'A feature store is a cache with a compliance problem',
        date: 'February 2026',
        signal: 'Read by 4 engineers who then asked you to mentor them',
      },
    ],
    articleNudge: {
      reason:
        'Four of your last six mentoring requests came from one article. It is not linked anywhere on your profile.',
      cta: 'Feature the staff-scope piece at the top',
    },
    mentorship: [
      '19 engineers mentored — 15 confirmed by the mentee',
      '4 mentees reached Principal, 7 reached Staff, during the mentoring period',
      '22 substantive answers on scope and promotion cases in the Staff+ forum',
      'Calibration lead for the staff interview loop',
    ],
    mentorshipNote:
      'Four mentee relationships are unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'nr-com-staff',
        name: 'Staff+ Engineering Forum',
        members: '3,200 practitioners',
        basis: 'Scope, influence and promotion cases. Moderated; self-promotion removed.',
        yourRole: 'Moderator · 22 answers this quarter',
      },
      {
        id: 'nr-com-dal',
        name: 'Data Architecture Leadership',
        members: '900 practitioners',
        basis: 'Staff-and-above only, verified by role history. Discussion of org design, not tools.',
        yourRole: 'Member · active',
      },
      {
        id: 'nr-com-ds',
        name: 'Distributed Systems Practitioners',
        members: '4,100 practitioners',
        basis: 'Membership requires a demonstrated systems contribution. No open sign-up.',
        yourRole: 'Member · reading, not yet contributing',
      },
    ],
    visitors: [
      '11 engineers arrived from your staff-scope article',
      '3 hiring managers arrived from the Staff+ forum',
      '2 peers arrived from a mentee\'s promotion announcement',
    ],
    visitorNote:
      'Median time on your profile: 2 minutes 3 seconds — the longest of anyone in your organisation. '
      + 'Most visitors are reading the mentorship section, not the timeline.',
  },

  /* ================================================================
     Jonas Ferreira — Founder, Tessellate
     ================================================================ */
  builder: {
    thesis:
      'I would rather ship a small tool three teams depend on than a large one nobody can read. '
      + 'Tessellate is eleven thousand lines and I have deleted more than I have written.',
    currentFocus: [
      'Event-driven lakehouse tooling, in the open, with the roadmap public',
      'Hiring a founding data engineer without pretending the risk is lower than it is',
      'Working out which parts of this should never be commercial',
    ],
    goal: null,
    reputation: {
      total: 741,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 86,
          trend: '+6 in 90 days',
          inputs: [
            'Query planner you can read, and 63 dependent projects that do',
            'Benchmarks published with the losing cases included',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 72,
          trend: '+4 in 90 days',
          inputs: [
            'Median read-through of 61% across 5 published pieces',
            'Your changelogs are read more carefully than your posts',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 49,
          trend: 'new',
          inputs: [
            '2 contributors mentored through their first merged change',
            'Low sample size — treat this number as provisional',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 68,
          trend: '+7 in 90 days',
          inputs: [
            'Set and published a roadmap that contributors actually follow',
            'No experience leading anyone who is not a volunteer',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 81,
          trend: '+5 in 90 days',
          inputs: [
            'Issue response median under 24 hours',
            '9 first-time contributors merged in the last year',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 74,
          trend: '+3 in 90 days',
          inputs: [
            'Design discussions held in public issues rather than private channels',
            'Two contested design decisions resolved without losing the contributor',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 31,
          trend: 'new',
          inputs: [
            '4 interviews conducted, all for the same open role',
            'Low sample size — treat this number as provisional',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 93,
          trend: '+3 in 90 days',
          inputs: [
            'Maintainer of Tessellate: 1,900 stars, 63 dependent projects',
            'Contributions merged into two upstream connectors',
            'Three years of sustained maintenance, not a single-push repository',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'jf-query',
        name: 'Query engine internals',
        strength: 'Strong',
        level: 88,
        lastDemonstrated: 'This week',
        evidence: ['Wrote the planner', 'Benchmarks published with the losing cases included'],
        gaps: [],
      },
      {
        id: 'jf-rust',
        name: 'Rust',
        strength: 'Strong',
        level: 84,
        lastDemonstrated: 'This week',
        evidence: ['Three years of primary-language work on Tessellate'],
        gaps: [],
      },
      {
        id: 'jf-maintenance',
        name: 'Open-source maintenance',
        strength: 'Strong',
        level: 90,
        lastDemonstrated: 'This week',
        evidence: [
          'Issue response median under 24 hours over three years',
          '9 first-time contributors merged in the last year',
        ],
        gaps: [],
      },
      {
        id: 'jf-commercial',
        name: 'Commercial packaging',
        strength: 'Emerging',
        level: 34,
        lastDemonstrated: 'In progress',
        evidence: ['One paid pilot, unsigned'],
        gaps: [
          'No pricing model on record',
          'The thing you are least good at is currently the thing that decides whether this survives',
        ],
        strengthen: [
          'Two of your 63 dependent projects are companies. Ask them what they would pay for and why.',
        ],
      },
    ],
    evidenceOfWork: [
      {
        id: 'jf-ev-tessellate',
        claim: 'Tessellate: 1,900 stars, 63 dependent projects',
        detail: 'Three years of sustained maintenance with a published issue-response median under 24 hours.',
        verified: 'Public artefact',
      },
      {
        id: 'jf-ev-contributors',
        claim: 'Merged first contributions from 9 new people in a year',
        detail: 'Six of the nine contributed again. That ratio is the number you actually optimise for.',
        verified: 'Public artefact',
      },
      {
        id: 'jf-ev-seed',
        claim: 'Raised a seed round on the open-source traction',
        detail: 'Pre-revenue. The commercial model is genuinely unresolved, and the deck said so.',
        verified: 'Publicly announced',
      },
    ],
    timeline: [
      {
        period: '2023 — present',
        role: 'Founder',
        org: 'Tessellate',
        outcome: 'Built and maintains an event-driven lakehouse toolkit with 63 dependent projects.',
      },
      {
        period: '2019 — 2023',
        role: 'Staff Engineer, Storage',
        org: 'Corvus Media',
        outcome: 'Owned the object-store layer. Left because the interesting part had finished.',
      },
      {
        period: '2016 — 2019',
        role: 'Backend Engineer',
        org: 'Alder & Finch',
        outcome: 'Learned distributed systems the way most people do: by breaking one in production.',
      },
    ],
    articles: [
      {
        id: 'jf-art-delete',
        title: 'I deleted more of this than I wrote, and it got faster',
        date: 'May 2026',
        signal: 'Most-shared of your pieces',
      },
      {
        id: 'jf-art-bench',
        title: 'Benchmarks with the losing cases left in',
        date: 'December 2025',
        signal: 'Referenced by 2 competing projects',
      },
    ],
    articleNudge: {
      reason:
        'Your changelog gets read more carefully than anything on your profile, and it is not linked from it.',
      cta: 'Link the Tessellate changelog from your profile',
    },
    mentorship: [
      '2 contributors mentored through their first merged change',
      '9 first-time contributors merged in the last year, 6 of whom came back',
      'Design discussions held in public issues rather than private channels',
    ],
    mentorshipNote:
      'Mentorship here is mostly review, not formal mentoring, and the score reflects that rather than '
      + 'flattering it.',
    communities: [
      {
        id: 'jf-com-oss',
        name: 'Open Data Infrastructure',
        members: '2,200 practitioners',
        basis: 'Maintainers and contributors only, verified by merged work.',
        yourRole: 'Member · maintainer track',
      },
      {
        id: 'jf-com-founders',
        name: 'Technical Founders, Pre-Revenue',
        members: '600 practitioners',
        basis: 'Companies without a revenue model yet. Discussion is unusually honest as a result.',
        yourRole: 'Member · active',
      },
      {
        id: 'jf-com-ds',
        name: 'Distributed Systems Practitioners',
        members: '4,100 practitioners',
        basis: 'Membership requires a demonstrated systems contribution. No open sign-up.',
        yourRole: 'Member · reading, not yet contributing',
      },
    ],
    visitors: [
      '14 engineers arrived from the Tessellate repository',
      '5 investors arrived from the seed announcement',
      '3 candidates arrived from the founding-engineer posting',
    ],
    visitorNote:
      'Median time on your profile: 38 seconds. Almost everyone leaves for the repository, which is '
      + 'arguably the correct behaviour and still worth knowing.',
  },

  /* ================================================================
     Lena Vogt — Data Platform Lead, Cobalt Health
     ================================================================ */
  explorer: {
    thesis:
      'I built a platform team from three people to nine inside a compliance boundary most engineers '
      + 'would rather not read about. I am trying to work out how much of that transfers.',
    currentFocus: [
      'Reading job descriptions in ML platform work to find out what the words mean',
      'A public write-up of the clinical event model, which has never left the company',
      'Deciding whether the next move is a title change or a field change',
    ],
    goal: {
      title: 'Platform leadership in ML infrastructure rather than analytics',
      horizon: 'Next 9–12 months',
      openTo: [
        'ML Platform Lead',
        'Data Platform Lead',
        'Principal Engineer, Platform',
      ],
      industries: ['Healthcare technology', 'Climate', 'Public-sector data'],
      workModel: 'Remote or hybrid',
      geography: 'Open, with a preference for the current time zone',
      level: 'Staff / Lead',
    },
    reputation: {
      total: 703,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 80,
          trend: '+2 in 90 days',
          inputs: [
            'HIPAA-scoped lakehouse in production for three years',
            'Public talk on modelling clinical event data',
            'Nearly all of your strongest work is behind a compliance boundary',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 58,
          trend: 'flat',
          inputs: [
            '2 published pieces, both over a year old',
            'The work is there; the account of it is not',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 77,
          trend: '+3 in 90 days',
          inputs: [
            '7 engineers mentored, 5 confirmed by the mentee',
            'Three of your nine hires were internal moves you sponsored',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 84,
          trend: '+4 in 90 days',
          inputs: [
            'Grew a platform team from 3 to 9 and kept the attrition at zero',
            'Set the data-retention position the whole company now works to',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 46,
          trend: 'flat',
          inputs: [
            'Member of 1 practitioner community, reading only',
            'One conference talk, two years ago',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 86,
          trend: '+2 in 90 days',
          inputs: [
            'Standing work with clinical, legal and security teams',
            '8 colleagues described your review comments as materially useful',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 72,
          trend: '+5 in 90 days',
          inputs: [
            '38 interviews conducted, 6 hires made',
            'Wrote the take-home your team still uses',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 28,
          trend: 'flat',
          inputs: [
            'No contributions on record',
            'Shown rather than hidden — it is a real gap for the roles you are reading',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'lv-lakehouse',
        name: 'Lakehouse architecture',
        strength: 'Strong',
        level: 89,
        lastDemonstrated: 'This month',
        evidence: [
          'HIPAA-scoped lakehouse in production for three years',
          'Retention and residency model adopted company-wide',
        ],
        gaps: [],
      },
      {
        id: 'lv-leadership',
        name: 'Platform team leadership',
        strength: 'Strong',
        level: 85,
        lastDemonstrated: 'This month',
        evidence: ['Grew the team from 3 to 9 with zero attrition'],
        gaps: [],
      },
      {
        id: 'lv-mlplatform',
        name: 'ML platform infrastructure',
        strength: 'Emerging',
        level: 33,
        lastDemonstrated: 'Never, in production',
        blocking: 9,
        evidence: ['One evaluation pipeline built for a model your team did not own'],
        gaps: [
          'No serving path, feature store or model registry on record',
          'This is the single requirement in nearly every role you have saved',
        ],
        strengthen: [
          'The evaluation pipeline is closer to this than you think — write down what it actually did',
          'Two of your saved roles weight platform leadership above ML specifics. Read those first.',
        ],
      },
      {
        id: 'lv-experiments',
        name: 'Experiment infrastructure',
        strength: 'Medium',
        level: 55,
        lastDemonstrated: 'This year',
        blocking: 4,
        evidence: ['Built the assignment service for a clinical trial dashboard'],
        gaps: ['Clinical trial design is not what these roles mean by experimentation'],
      },
      {
        id: 'lv-python',
        name: 'Python',
        strength: 'Strong',
        level: 87,
        lastDemonstrated: 'This month',
        evidence: ['Primary language across eight years'],
        gaps: [],
      },
    ],
    evidenceOfWork: [
      {
        id: 'lv-ev-team',
        claim: 'Grew a platform team from 3 to 9 with zero attrition',
        detail: 'Cobalt Health, 2022–2026. Three of the six hires were internal moves you sponsored.',
        verified: 'Verified by employer',
      },
      {
        id: 'lv-ev-lakehouse',
        claim: 'HIPAA-scoped lakehouse in production for three years',
        detail: 'Passed two external audits without a finding against the data layer.',
        verified: 'Externally audited',
      },
      {
        id: 'lv-ev-talk',
        claim: 'Conference talk on modelling clinical event data',
        detail: 'The only part of your strongest work that is publicly readable.',
        verified: 'Public artefact',
      },
    ],
    timeline: [
      {
        period: '2022 — present',
        role: 'Data Platform Lead',
        org: 'Cobalt Health',
        outcome: 'Built the team and the platform. Two clean audits, zero attrition, one very narrow domain.',
      },
      {
        period: '2019 — 2022',
        role: 'Senior Data Engineer',
        org: 'Bellhaven Retail',
        outcome: 'Warehouse and reporting layer. Left for a harder constraint on purpose.',
      },
      {
        period: '2016 — 2019',
        role: 'Data Engineer',
        org: 'Corvus Media',
        outcome: 'First pipelines, first outage, first opinion about schema ownership.',
      },
    ],
    articles: [
      {
        id: 'lv-art-clinical',
        title: 'Modelling clinical events without modelling the patient',
        date: 'September 2024',
        signal: 'Your only public account of your strongest work',
      },
    ],
    articleNudge: {
      reason:
        'You have one public piece and it is eighteen months old. Every role you have saved asks for '
        + 'evidence you have and have not written down.',
      cta: 'Draft the evaluation-pipeline write-up',
    },
    mentorship: [
      '7 engineers mentored — 5 confirmed by the mentee',
      '3 internal moves sponsored into the platform team',
      'Wrote the take-home your team still interviews with',
    ],
    mentorshipNote:
      'Two mentee relationships are unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'lv-com-health',
        name: 'Health Data Platforms',
        members: '1,100 practitioners',
        basis: 'Practitioners working inside a regulated data boundary. Verified by employer domain.',
        yourRole: 'Member · reading, not yet contributing',
      },
      {
        id: 'lv-com-aip',
        name: 'AI Platform Engineering',
        members: '2,600 practitioners',
        basis: 'Weekly working session on serving, feature stores and evaluation infrastructure.',
        yourRole: 'Not a member',
        suggestion: 'This is where the vocabulary in your saved job descriptions comes from.',
      },
      {
        id: 'lv-com-dal',
        name: 'Data Architecture Leadership',
        members: '900 practitioners',
        basis: 'Staff-and-above only, verified by role history. Discussion of org design, not tools.',
        yourRole: 'Member · active',
      },
    ],
    visitors: [
      '2 peers arrived from the Health Data Platforms community',
      '1 conference organiser arrived from your 2024 talk',
      'No recruiter traffic — exploring is private, and nothing here is offered to them',
    ],
    visitorNote:
      'Median time on your profile: 52 seconds. Exploring generates no outbound signal at all, so this '
      + 'traffic is people who already knew where to look.',
  },

  /* ================================================================
     Amara Osei — VP Engineering, Fathom Health AI
     ================================================================ */
  'hiring-manager': {
    thesis:
      'I have hired sixty engineers and rejected many more, and the mistakes were nearly always mine: '
      + 'a vague rubric, a slow loop, or a band I would not have accepted myself.',
    currentFocus: [
      'Three open platform roles, filled without moving the bar or the band',
      'Publishing the rubric before the interview rather than defending it afterwards',
      'Reporting the loop\'s own numbers back to the team every month',
    ],
    goal: null,
    reputation: {
      total: 795,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 74,
          trend: 'flat',
          inputs: [
            'Nine years of engineering before management, none of it recent',
            'Judgement is current; hands-on evidence deliberately is not',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 88,
          trend: '+5 in 90 days',
          inputs: [
            'Median read-through of 77% across 12 published pieces',
            'Your promotion-scope piece is the most-shared thing you have written',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 83,
          trend: '+3 in 90 days',
          inputs: [
            '12 engineers mentored, 9 confirmed by the mentee',
            '5 mentees now manage teams of their own',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 91,
          trend: '+2 in 90 days',
          inputs: [
            'Runs an engineering organisation of 90',
            'Two reorganisations completed without regretted attrition above baseline',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 69,
          trend: '+4 in 90 days',
          inputs: [
            'Regular at the Data Architecture Leadership sessions',
            'Publishes hiring rubrics other companies reuse',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 85,
          trend: 'flat',
          inputs: [
            'Standing work with product, clinical and recruiting',
            '6 peers described your written feedback as materially useful',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 94,
          trend: '+4 in 90 days',
          inputs: [
            '60 hires across three companies, with retention measured at two years',
            'Designed the loop your company now uses everywhere',
            'Publishes the rubric in advance, which is rarer than it should be',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 22,
          trend: 'flat',
          inputs: [
            'No contributions on record',
            'Carries almost no weight for your work, and is shown rather than hidden',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'ao-loop',
        name: 'Interview loop design',
        strength: 'Strong',
        level: 92,
        lastDemonstrated: 'This month',
        evidence: [
          'Designed the loop used across three engineering orgs',
          'False-negative rate measured, published internally, and acted on',
        ],
        gaps: [],
      },
      {
        id: 'ao-assessment',
        name: 'Technical assessment',
        strength: 'Strong',
        level: 86,
        lastDemonstrated: 'This week',
        evidence: ['Rubric published in advance of every stage'],
        gaps: [],
      },
      {
        id: 'ao-org',
        name: 'Org design',
        strength: 'Strong',
        level: 88,
        lastDemonstrated: 'This quarter',
        evidence: ['Two reorganisations with attrition measured against baseline'],
        gaps: [],
      },
      {
        id: 'ao-comp',
        name: 'Compensation benchmarking',
        strength: 'Medium',
        level: 63,
        lastDemonstrated: '4 months ago',
        evidence: ['Band review completed annually'],
        gaps: [
          'Your posted band is below three of your five strongest candidates',
          'Annual review is too slow for a market that moved 6% in sixty days',
        ],
        strengthen: [
          'Two finalists declined in the last quarter. Both declines cited band. That is a measurement problem, not a market one.',
        ],
      },
    ],
    evidenceOfWork: [
      {
        id: 'ao-ev-hires',
        claim: '60 engineers hired across three companies',
        detail: 'Two-year retention measured at 84%, above the sector figure for comparable roles.',
        verified: 'Verified by employer',
      },
      {
        id: 'ao-ev-loop',
        claim: 'Cut time-to-first-interview from 9 days to 3.2',
        detail: 'By removing two stages and giving interviewers a written rubric, not by lowering the bar.',
        verified: 'Verified by employer',
      },
      {
        id: 'ao-ev-rubric',
        claim: 'Publishes the hiring rubric before the interview',
        detail: 'Adopted by two other companies. Candidates can read it before they decide to apply.',
        verified: 'Public artefact',
      },
    ],
    timeline: [
      {
        period: '2023 — present',
        role: 'VP Engineering',
        org: 'Fathom Health AI',
        outcome: 'Engineering organisation of 90. Time-to-first-interview 3.2 days, two-year retention 84%.',
      },
      {
        period: '2019 — 2023',
        role: 'Director of Engineering',
        org: 'Halcyon Financial',
        outcome: 'Built the platform group from 12 to 40. Wrote the first version of the rubric.',
      },
      {
        period: '2014 — 2019',
        role: 'Engineering Manager',
        org: 'Kestrel Systems',
        outcome: 'First management job. Learned that a slow loop rejects candidates on your behalf.',
      },
    ],
    articles: [
      {
        id: 'ao-art-promo',
        title: 'The staff promotion case I almost rejected',
        date: 'June 2026',
        signal: 'Most-shared of your pieces',
      },
      {
        id: 'ao-art-rubric',
        title: 'Publish the rubric before the interview',
        date: 'March 2026',
        signal: 'Adopted by 2 other companies',
      },
    ],
    articleNudge: {
      reason:
        'Candidates who read your rubric piece before applying accept offers at nearly twice the rate. '
        + 'It is not linked from any of your job postings.',
      cta: 'Link the rubric piece from all three open roles',
    },
    mentorship: [
      '12 engineers mentored — 9 confirmed by the mentee',
      '5 mentees now manage teams of their own',
      'Rubric and loop guidance published for anyone to reuse',
    ],
    mentorshipNote:
      'Three mentee relationships are unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'ao-com-dal',
        name: 'Data Architecture Leadership',
        members: '900 practitioners',
        basis: 'Staff-and-above only, verified by role history. Discussion of org design, not tools.',
        yourRole: 'Member · regular attendee',
      },
      {
        id: 'ao-com-hiring',
        name: 'Engineering Hiring Practice',
        members: '1,400 practitioners',
        basis: 'Loop design, rubrics and measured outcomes. Anecdote is moderated out.',
        yourRole: 'Member · active',
      },
    ],
    visitors: [
      '18 candidates arrived from your published rubric',
      '4 engineering leaders arrived from the promotion-scope article',
      '2 recruiters arrived from an open role',
    ],
    visitorNote:
      'Median time on your profile: 1 minute 31 seconds. Most visitors are candidates deciding whether '
      + 'to apply, and they leave at the compensation band.',
  },

  /* ================================================================
     Renata Okafor — Technical Recruiter, Cedarpoint Data
     ================================================================ */
  recruiter: {
    thesis:
      'Candidates can see my response rate before they decide whether to answer me. That is the only '
      + 'reason my response rate is what it is.',
    currentFocus: [
      'Five requisitions across three companies, two closing this week',
      'Refusing roles where the band is not agreed before the first call',
      'Reading demonstrated work rather than searching for keywords in it',
    ],
    goal: null,
    reputation: {
      total: 758,
      outOf: OUT_OF,
      basis: BASIS,
      dimensions: [
        {
          id: 'technical-credibility',
          label: 'Technical credibility',
          score: 62,
          trend: '+6 in 90 days',
          inputs: [
            'Can read a design document and ask a question the engineer respects',
            'No engineering background, and the score reflects that honestly',
          ],
        },
        {
          id: 'writing-quality',
          label: 'Writing quality',
          score: 81,
          trend: '+4 in 90 days',
          inputs: [
            'First messages reference the candidate\'s actual work in 94% of cases',
            'Role descriptions include the band, the loop and the team size',
          ],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          score: 64,
          trend: '+3 in 90 days',
          inputs: [
            '4 recruiters mentored, 3 confirmed',
            'Runs the interview-preparation session candidates actually attend',
          ],
        },
        {
          id: 'leadership',
          label: 'Leadership',
          score: 59,
          trend: '+2 in 90 days',
          inputs: [
            'Set the disclosure standard your team now works to',
            'No formal management responsibility on record',
          ],
        },
        {
          id: 'community',
          label: 'Community contribution',
          score: 71,
          trend: '+5 in 90 days',
          inputs: [
            'Publishes anonymised placement outcomes quarterly',
            'Answers candidate questions in two open forums',
          ],
        },
        {
          id: 'collaboration',
          label: 'Collaboration',
          score: 87,
          trend: '+3 in 90 days',
          inputs: [
            'Works with hiring managers on the rubric before sourcing begins',
            '5 hiring managers described your candidate summaries as materially useful',
          ],
        },
        {
          id: 'hiring-influence',
          label: 'Hiring influence',
          score: 89,
          trend: '+4 in 90 days',
          inputs: [
            '5 placements in 90 days, all still in role at six months',
            '96% candidate response rate across 96 verified interactions',
            'Role accuracy 5 of 5: nobody was pitched a job that was not the job',
          ],
        },
        {
          id: 'open-source',
          label: 'Open-source contribution',
          score: 0,
          notApplicable: true,
          trend: 'not applicable to your work',
          inputs: [
            'Recruiting work produces no open-source record, and inventing one would be worse than showing none',
            'Excluded from your total rather than counted as a zero against you',
          ],
        },
      ],
    },
    skills: [
      {
        id: 'ro-sourcing',
        name: 'Evidence-based sourcing',
        strength: 'Strong',
        level: 89,
        lastDemonstrated: 'This week',
        evidence: [
          'Candidates surfaced from published work rather than title matching',
          '5 of 5 placements matched the role as described',
        ],
        gaps: [],
      },
      {
        id: 'ro-scoping',
        name: 'Role scoping with hiring managers',
        strength: 'Strong',
        level: 84,
        lastDemonstrated: 'This month',
        evidence: ['Band and rubric agreed before sourcing begins, on every requisition'],
        gaps: [],
      },
      {
        id: 'ro-comms',
        name: 'Candidate communication',
        strength: 'Strong',
        level: 92,
        lastDemonstrated: 'Today',
        evidence: [
          '96% response rate across 96 verified interactions',
          'Median response time 6 hours, including rejections',
        ],
        gaps: [],
      },
      {
        id: 'ro-negotiation',
        name: 'Compensation negotiation',
        strength: 'Medium',
        level: 68,
        lastDemonstrated: 'This quarter',
        evidence: ['Three offers renegotiated upward before the candidate asked'],
        gaps: ['Two of five placements accepted below the market midpoint'],
      },
    ],
    evidenceOfWork: [
      {
        id: 'ro-ev-response',
        claim: '96% candidate response rate over 96 verified interactions',
        detail: 'Verified interactions only. Rejections are counted as responses, because they are.',
        verified: 'Measured by the platform',
      },
      {
        id: 'ro-ev-placements',
        claim: '5 placements in 90 days, all still in role at six months',
        detail: 'Role accuracy 5 of 5 — nobody was pitched a job that turned out to be a different job.',
        verified: 'Outcome-verified',
      },
      {
        id: 'ro-ev-disclosure',
        claim: 'Publishes the band and the loop before the first call',
        detail: 'On every requisition, including the two that were harder to fill because of it.',
        verified: 'Public artefact',
      },
    ],
    timeline: [
      {
        period: '2022 — present',
        role: 'Technical Recruiter',
        org: 'Cedarpoint Data',
        outcome: '96% response rate, 5 placements in 90 days, role accuracy 5 of 5.',
      },
      {
        period: '2019 — 2022',
        role: 'Recruiter',
        org: 'Northgate Search',
        outcome: 'Agency work. Left over the volume model, which is in the record rather than hidden from it.',
      },
      {
        period: '2017 — 2019',
        role: 'Coordinator',
        org: 'Alder & Finch',
        outcome: 'Scheduling, and a close view of how much candidate goodwill a slow loop burns.',
      },
    ],
    articles: [
      {
        id: 'ro-art-band',
        title: 'What happens when you publish the band first',
        date: 'April 2026',
        signal: 'Read by 9 hiring managers you now work with',
      },
    ],
    articleNudge: {
      reason:
        'Candidates who read your disclosure piece reply at a higher rate than those who receive your '
        + 'best first message. It is not linked from any outreach.',
      cta: 'Link the disclosure piece from your outreach template',
    },
    mentorship: [
      '4 recruiters mentored — 3 confirmed',
      'Runs an interview-preparation session for candidates, whether or not they are yours',
      'Publishes anonymised placement outcomes quarterly',
    ],
    mentorshipNote:
      'One mentee relationship is unconfirmed. Unconfirmed claims are shown to you but not to anyone '
      + 'else, and they do not count toward your mentorship score.',
    communities: [
      {
        id: 'ro-com-hiring',
        name: 'Engineering Hiring Practice',
        members: '1,400 practitioners',
        basis: 'Loop design, rubrics and measured outcomes. Anecdote is moderated out.',
        yourRole: 'Member · active',
      },
      {
        id: 'ro-com-rec',
        name: 'Recruiters Who Publish Outcomes',
        members: '400 practitioners',
        basis: 'Membership requires publishing your own response and placement figures.',
        yourRole: 'Member · founding cohort',
      },
    ],
    visitors: [
      '23 candidates arrived from a role posting and checked your record first',
      '4 hiring managers arrived from your disclosure article',
      '2 recruiters arrived from the outcomes community',
    ],
    visitorNote:
      'Median time on your profile: 1 minute 8 seconds. Nearly everyone reads the response-rate figure '
      + 'before they read anything else, which is exactly what it is there for.',
  },
};

/** The record belonging to a persona. Falls back to the default persona's. */
export function profileFor(personaId) {
  return profiles[personaId] || profiles.candidate;
}

/** The record belonging to whoever is signed in right now. */
export function activeProfile() {
  return profileFor(personaFor(state.intent, state.hiringView).id);
}
