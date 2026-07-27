const { GAP_CHECKLIST } = require('../templates/gapChecklist');

// Matches the "On Track" boundary already shown in the dashboard's readiness tag — the same goal
// line, not a new arbitrary number introduced just for this feature.
const TARGET_SCORE = 75;

// A framework with no recorded movement for this long is "stalled," not "still improving slowly" —
// roughly one connector-sync cycle (CONNECTOR_SYNC_INTERVAL_HOURS defaults to 24), so a framework
// that hasn't budged across a full monitoring cycle has genuinely gone quiet, not just had a slow
// data point.
const STALL_THRESHOLD_HOURS = 24;

// Below this much real elapsed time between the earliest and latest snapshot, any rate computed
// from it is mostly noise (e.g. two documents generated back-to-back) — report insufficient_data
// rather than project a wild ETA from minutes of history.
const MIN_SPAN_HOURS = 6;

// Pure function over real recorded history only — no synthetic data points, no LLM guess about
// the future. Given each framework's own score at each snapshot, decide per framework whether it's
// already at target, hasn't got enough history yet, has stalled, or is on a genuine upward trend,
// and if so how many weeks at the current rate until it crosses TARGET_SCORE.
function computeRiskPrediction(snapshots) {
  if (!snapshots.length) {
    return { targetScore: TARGET_SCORE, frameworks: [] };
  }

  const now = new Date(snapshots[snapshots.length - 1].created_at);

  const frameworks = Object.entries(GAP_CHECKLIST).map(([key, def]) => {
    const history = snapshots
      .map((s) => ({ score: s.framework_scores?.[key], at: new Date(s.created_at) }))
      .filter((h) => typeof h.score === 'number');

    const base = { key, label: def.label };

    if (history.length < 2) {
      return { ...base, status: 'insufficient_data' };
    }

    const current = history[history.length - 1].score;
    if (current >= TARGET_SCORE) {
      return { ...base, currentScore: current, status: 'on_target' };
    }

    const first = history[0];
    const spanHours = (now - first.at) / 3600000;
    if (spanHours < MIN_SPAN_HOURS) {
      return { ...base, currentScore: current, status: 'insufficient_data' };
    }

    let lastChangeIdx = history.length - 1;
    while (lastChangeIdx > 0 && history[lastChangeIdx - 1].score === current) lastChangeIdx -= 1;
    const stalledHours = (now - history[lastChangeIdx].at) / 3600000;

    const rate = (current - first.score) / spanHours; // points per hour, over the full observed history

    if (stalledHours >= STALL_THRESHOLD_HOURS || rate <= 0) {
      return { ...base, currentScore: current, status: 'stalled', stalledHours: Math.round(stalledHours) };
    }

    const hoursToTarget = (TARGET_SCORE - current) / rate;
    return {
      ...base,
      currentScore: current,
      status: 'projected',
      weeksToTarget: Math.round((hoursToTarget / 24 / 7) * 10) / 10,
      pointsPerWeek: Math.round(rate * 24 * 7 * 10) / 10,
      basisHours: Math.round(spanHours),
    };
  });

  return { targetScore: TARGET_SCORE, frameworks };
}

module.exports = { computeRiskPrediction, TARGET_SCORE };
