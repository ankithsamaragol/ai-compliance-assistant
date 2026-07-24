const pool = require('../db/pool');
const { computeGapAnalysis } = require('./gapAnalysis');

// Records a real snapshot of the compliance state whenever something that could move the score
// actually happens — never on a timer, never on a page view. This is what makes the Timeline and
// trend deltas real history instead of a fabricated "checked in every day" cadence.
async function recordSnapshot(companyId, trigger, triggerDetail) {
  try {
    const { frameworks, documentsReady, vendorCount, evidenceCount, openRisks, overallScore } = await computeGapAnalysis(companyId);
    const frameworkScores = Object.fromEntries(frameworks.map((f) => [f.key, f.score]));
    await pool.query(
      `INSERT INTO score_snapshots (company_id, overall_score, framework_scores, documents_ready, vendor_count, evidence_count, open_risks, trigger, trigger_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [companyId, overallScore, JSON.stringify(frameworkScores), documentsReady, vendorCount, evidenceCount, openRisks, trigger, triggerDetail || null],
    );
  } catch (err) {
    // Snapshotting is secondary to the action that triggered it (a document/vendor/evidence
    // change should still succeed even if history-recording has a hiccup) — log, don't throw.
    console.error(`Failed to record score snapshot (company ${companyId}, trigger ${trigger}):`, err);
  }
}

// The nearest snapshot at least 7 days old. Returns null if the company doesn't have that much
// history yet — no fallback to "closest available" substitute, since comparing today's score to
// a snapshot from 12 hours ago and labeling it "this week" would be a fabricated trend.
async function getWeeklyTrend(companyId) {
  const { rows } = await pool.query(
    `SELECT overall_score, documents_ready, vendor_count, evidence_count, created_at
     FROM score_snapshots WHERE company_id = $1 AND created_at <= now() - interval '7 days'
     ORDER BY created_at DESC LIMIT 1`,
    [companyId],
  );
  return rows[0] || null;
}

async function getTimeline(companyId) {
  const { rows } = await pool.query(
    `SELECT id, overall_score, framework_scores, documents_ready, vendor_count, evidence_count, open_risks, trigger, trigger_detail, created_at
     FROM score_snapshots WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId],
  );
  return rows;
}

module.exports = { recordSnapshot, getWeeklyTrend, getTimeline };
