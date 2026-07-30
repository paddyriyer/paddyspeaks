/**
 * Career intents.
 *
 * An intent is not a filter on one dashboard — it selects a whole persona. The
 * identity that goes with each intent lives in data/personas.js, and that
 * person's record lives in data/profiles.js.
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
