/**
 * PaddySpeaks Analytics — configurable thresholds (single source of truth).
 * Nothing downstream hard-codes these numbers; tune here.
 * Pure ES module: imported by the Worker and by node tests.
 */
export const SCHEMA_VERSION = 1;

export const THRESHOLDS = {
  // Sessionization
  sessionGapMinutes: 30,        // inactivity gap that closes a session

  // Engagement / meaningful-reader predicate
  engagedActiveSeconds: 90,     // active (visible+focused) seconds
  engagedScrollPct: 75,         // % of page scrolled
  engagedMinPageViews: 2,       // pages in a session

  // Statistics honesty
  smallSampleFloor: 30,         // denominators below this get a warning + no auto-insight

  // Retention windows (days) to compute
  retentionDays: [1, 7, 30],
};

/** Configurable goal set. A "goal" is any of these predicates being met. */
export const GOALS = [
  { id: 'meaningful_read', label: 'Meaningful read' },
  { id: 'learning_completion', label: 'Interview learning completion' },
  { id: 'quiz_passed', label: 'Quiz passed' },
  { id: 'related_or_next_click', label: 'Related / next-page click' },
  { id: 'cta_click', label: 'CTA / resume click' },
];

/** Fixed track enum for Interview Studio. */
export const TRACKS = ['sql', 'python', 'snowflake', 'system_data_design', 'communication', 'ai_engineering'];
