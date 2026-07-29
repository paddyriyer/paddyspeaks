/**
 * Product philosophy. The one screen where the thesis is stated outright —
 * deliberately not a slogan repeated across every page.
 */

import { html, action } from '../dom.js';
import { icon } from '../components/icons.js';
import { evidenceList } from '../components/primitives.js';

const principles = [
  {
    title: 'Every item must justify its presence',
    body: 'A post, person, role, event or alert appears only if the system can state why it is useful to '
      + 'you professionally. When it cannot, the correct behaviour is silence — which is why the feed ends '
      + 'and the notifications are sparse.',
  },
  {
    title: 'Evidence outranks popularity',
    body: 'A follower count measures distribution. A published migration with the numbers attached measures '
      + 'capability. Only the second one predicts whether someone can do the job, so only the second one '
      + 'affects ranking.',
  },
  {
    title: 'The interface follows intent',
    body: 'Job hunting, hiring, learning, networking, mentoring, building and exploring are different jobs. '
      + 'Serving them from one feed serves none of them. Changing intent changes what is ranked, not just '
      + 'what is labelled.',
  },
  {
    title: 'Explanation is not a settings page',
    body: 'Every recommendation carries "Why this?" in place, naming the inputs used, the confidence, and '
      + 'the signals deliberately excluded. An algorithm nobody can inspect cannot be trusted with a career.',
  },
  {
    title: 'The uncomfortable number stays visible',
    body: 'Your weakest skill signal, the gap costing you twelve roles, the recruiter with a 54% response '
      + 'rate, the fact that an internal candidate is already in the process. A product that flatters you '
      + 'is not helping you.',
  },
  {
    title: 'Attention is not the product',
    body: 'No streaks, no infinite scroll, no prompt to post because you have been quiet, no notification '
      + 'engineered to bring you back. If the product does its job, you use it less and get further.',
  },
];

export function philosophyView() {
  return html`
    <div class="philosophy">
      <p class="eyebrow">CareerOS · Product philosophy</p>

      <h1 class="display" style="margin-top:12px;font-size:34px">
        A professional intelligence network
      </h1>

      <p class="lede" style="margin-top:14px">
        Professional networks became social networks with a dress code. The mechanics that maximise time
        spent — infinite feeds, engagement bait, vanity metrics, notifications engineered for return
        visits — are precisely the mechanics that get in the way of finding a job, a colleague, a mentor
        or an answer.
      </p>

      <p class="philosophy-statement">
        Stop maximizing attention. Start maximizing opportunity.
      </p>

      <p class="lede">
        Everything in this prototype follows from that sentence. It is stated here once, on purpose.
        A principle repeated on every screen is a slogan; a principle applied on every screen is a product.
      </p>

      <div class="compare" style="margin:30px 0">
        <div class="compare-col compare-optimise">
          <h4>What this optimises for</h4>
          <ul>
            ${[
              'Successful hires', 'Relevant recruiter–candidate matches',
              'Meaningful professional relationships', 'Career progression', 'Mentorship',
              'Knowledge exchange', 'Skill growth', 'High-quality collaboration', 'Trust',
              'Professional reputation',
            ].map((x) => html`<li><span aria-hidden="true">↑</span><span>${x}</span></li>`)}
          </ul>
        </div>
        <div class="compare-col compare-against">
          <h4>What it refuses to optimise for</h4>
          <ul>
            ${[
              'Endless scrolling', 'Likes', 'Viral reach', 'Empty engagement', 'Time spent',
              'Random profile views', 'Generic popularity',
            ].map((x) => html`<li><span aria-hidden="true">↓</span><span>${x}</span></li>`)}
          </ul>
        </div>
      </div>

      <h2 class="section-title" style="margin-top:34px">Six principles</h2>
      <div style="margin-top:12px">
        ${principles.map((p, i) => html`
          <div class="principle">
            <span class="principle-num">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3>${p.title}</h3>
              <p>${p.body}</p>
            </div>
          </div>
        `)}
      </div>

      <section class="card card-pad-lg" style="margin-top:32px">
        <h2 class="section-title" style="font-size:17px">How you would know it worked</h2>
        <p class="small secondary" style="margin:9px 0 13px">
          A product with this thesis has to be measured differently. These are the metrics that would
          govern it, and the ones it would refuse to report as success.
        </p>
        ${evidenceList([
          'Placements per active job seeker, and how long they took',
          'Proportion of first messages that receive a substantive reply',
          'Candidate-reported quality of the hiring processes the product routed them into',
          'Mentor relationships that both sides confirm six months later',
          'Recruiter ghosting rate across the whole market, trending down',
        ], 'pos')}
        <p class="eyebrow" style="margin:16px 0 7px">Explicitly not success metrics</p>
        ${evidenceList([
          'Daily active users', 'Session length', 'Posts per user', 'Feed impressions', 'Connection count',
        ], 'gap')}
      </section>

      <section class="card card-pad-lg" style="margin-top:18px">
        <h2 class="section-title" style="font-size:17px">What this prototype is</h2>
        <p class="small secondary" style="margin-top:9px">
          An independent product concept, built to argue a position. All data is invented. The people,
          companies, roles, recruiters and metrics do not exist and are not modelled on anyone real.
          It uses no branding, logo or visual asset belonging to any existing professional network, and
          is not affiliated with one.
        </p>
        <p class="small secondary" style="margin-top:10px">
          Your intent, saved items, dismissals and feed preferences persist in this browser's local
          storage. Nothing is transmitted anywhere — there is no backend and no analytics in this page.
        </p>
        <div class="btn-row" style="margin-top:15px">
          <button type="button" class="btn btn-primary btn-sm" ${action('navigate', { route: 'home' })}>
            ${icon('arrowRight', 13)}<span>Back to the dashboard</span>
          </button>
          <button type="button" class="btn btn-sm btn-quiet" ${action('reset-all')}>
            Reset the prototype to its initial state
          </button>
        </div>
      </section>
    </div>
  `;
}
