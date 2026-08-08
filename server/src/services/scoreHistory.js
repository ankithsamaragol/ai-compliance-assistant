const pool = require('../db/pool');
const { computeGapAnalysis } = require('./gapAnalysis');

const TRIGGER_LABEL = {
  document_generated: 'Document generated',
  vendor_detected: 'Vendors detected',
  evidence_analyzed: 'Evidence analyzed',
  connector_synced: 'Connector synced',
  risk_detected: 'Risks identified',
};

// Deterministic, not AI-composed — this fires on every one of the four triggers, so it has to be
// instant, free, and unable to hallucinate. The deep-dive reasoning surface remains Compliance
// Chat; this is just "what changed and what's next," built from data already computed above.
function composeInsight({ trigger, triggerDetail, previousScore, currentScore, nextActions }) {
  const label = TRIGGER_LABEL[trigger] || trigger;
  const detail = triggerDetail ? ` — ${triggerDetail}` : '';
  let lead;
  if (previousScore === null) {
    lead = `${label}${detail}. Starting compliance score: ${currentScore}%.`;
  } else if (currentScore > previousScore) {
    lead = `${label}${detail}. This moved your score ${previousScore}%→${currentScore}%.`;
  } else if (currentScore < previousScore) {
    lead = `${label}${detail}. Your score changed ${previousScore}%→${currentScore}%.`;
  } else {
    lead = `${label}${detail}. No change to your overall score (${currentScore}%).`;
  }
  const top = nextActions?.[0];
  const next = top ? ` Next: "${top.label}" would add ${top.totalLift} more point${top.totalLift === 1 ? '' : 's'}.` : '';
  return lead + next;
}

// Records a real snapshot of the compliance state whenever something that could move the score
// actually happens — never on a timer, never on a page view. This is what makes the Timeline and
// trend deltas real history instead of a fabricated "checked in every day" cadence.
async function recordSnapshot(companyId, trigger, triggerDetail) {
  try {
    const [analysis, { rows: prevRows }] = await Promise.all([
      computeGapAnalysis(companyId),
      pool.query('SELECT overall_score FROM score_snapshots WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [companyId]),
    ]);
    const { frameworks, documentsReady, vendorCount, evidenceCount, openRisks, overallScore, nextActions } = analysis;
    const frameworkScores = Object.fromEntries(frameworks.map((f) => [f.key, f.score]));
    const previousScore = prevRows[0] ? prevRows[0].overall_score : null;
    const insight = composeInsight({ trigger, triggerDetail, previousScore, currentScore: overallScore, nextActions });

    await pool.query(
      `INSERT INTO score_snapshots (company_id, overall_score, framework_scores, documents_ready, vendor_count, evidence_count, open_risks, trigger, trigger_detail, insight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [companyId, overallScore, JSON.stringify(frameworkScores), documentsReady, vendorCount, evidenceCount, openRisks, trigger, triggerDetail || null, insight],
    );
  } catch (err) {
    // Snapshotting is secondary to the action that triggered it (a document/vendor/evidence
    // change should still succeed even if history-recording has a hiccup) — log, don't throw.
    console.error(`Failed to record score snapshot (company ${companyId}, trigger ${trigger}):`, err);
  }
}

// The most recent insight, for the Dashboard's AI Officer card. Returns null for a company with
// no history yet, so the client can fall back to a generic prompt instead of showing nothing.
async function getLatestInsight(companyId) {
  const { rows } = await pool.query(
    `SELECT insight, trigger, created_at FROM score_snapshots WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [companyId],
  );
  return rows[0] || null;
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
    `SELECT id, overall_score, framework_scores, documents_ready, vendor_count, evidence_count, open_risks, trigger, trigger_detail, insight, created_at
     FROM score_snapshots WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId],
  );
  return rows;
}

module.exports = { recordSnapshot, getWeeklyTrend, getTimeline, getLatestInsight };
