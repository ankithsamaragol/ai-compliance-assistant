const { TARGET_SCORE } = require('./riskPrediction');

// A multi-step roadmap to the same 75% "on track" line Risk Prediction already uses — the thing
// Next Best Action never gave you: not "here's the single best next move," but "here's the full
// ordered sequence to get this specific framework audit-ready, and how long that's actually taken
// you so far." Pure function over data the gap-analysis and risk-prediction engines already
// compute — no new data model, no LLM call, same reasoning as everything else in this app: a
// fabricated-sounding roadmap is worse than an honest, data-grounded one.
//
// Step order follows the checklist's own authored order (already foundational-first — policies
// before evidence) rather than re-deriving a synthetic priority; the one thing that genuinely
// changes ordering, cross-framework impact, is already covered by the existing "Reuse across
// frameworks" panel, so this doesn't duplicate that reasoning.
function computeStrategy(frameworks, riskByFramework) {
  return frameworks.map((fw) => {
    if (fw.score >= TARGET_SCORE) {
      return { key: fw.key, label: fw.label, currentScore: fw.score, status: 'at_target', steps: [], weeksEstimate: null };
    }

    const remaining = fw.items.filter((item) => !item.satisfied && item.automatable);
    let runningSatisfied = fw.satisfiedCount;
    const steps = remaining.map((item) => {
      runningSatisfied += 1;
      return {
        key: item.key,
        label: item.label,
        why: item.why,
        scoreAfter: Math.round((runningSatisfied / fw.totalCount) * 100),
      };
    });

    const stepsToTarget = [];
    for (const step of steps) {
      stepsToTarget.push(step);
      if (step.scoreAfter >= TARGET_SCORE) break;
    }

    // Only borrow a timeline from Risk Prediction when it has enough real history to trust a
    // rate — same guardrail Risk Prediction itself applies (MIN_SPAN_HOURS / STALL_THRESHOLD),
    // so this never invents an ETA the underlying data doesn't support.
    const risk = riskByFramework?.[fw.key];
    const weeksEstimate = risk?.status === 'projected' && risk.pointsPerWeek > 0
      ? Math.round(((TARGET_SCORE - fw.score) / risk.pointsPerWeek) * 10) / 10
      : null;

    const reachesTarget = stepsToTarget.length > 0 && stepsToTarget[stepsToTarget.length - 1].scoreAfter >= TARGET_SCORE;

    return {
      key: fw.key,
      label: fw.label,
      currentScore: fw.score,
      status: reachesTarget ? 'in_progress' : 'capped', // 'capped': even every automatable item won't reach target (some items aren't automatable yet)
      steps: stepsToTarget,
      weeksEstimate,
    };
  });
}

module.exports = { computeStrategy };
