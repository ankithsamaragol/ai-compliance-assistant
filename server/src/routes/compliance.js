const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { computeGapAnalysis, simulateGapAnalysis } = require('../services/gapAnalysis');
const { evidenceTargets } = require('../services/evidenceIntelligence');
const { getWeeklyTrend, getTimeline, getLatestInsight } = require('../services/scoreHistory');
const { computeRiskPrediction } = require('../services/riskPrediction');

const router = express.Router();
router.use(requireAuth);

async function loadOwnedCompanyId(companyId, accountId) {
  const { rows } = await pool.query('SELECT id FROM companies WHERE id = $1 AND account_id = $2', [companyId, accountId]);
  return rows[0] ? rows[0].id : null;
}

router.get('/evidence-targets', (req, res) => {
  res.json(evidenceTargets());
});

router.get('/gap-analysis', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    if (!(await loadOwnedCompanyId(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });

    const [result, weekAgo, latestInsight] = await Promise.all([
      computeGapAnalysis(companyId),
      getWeeklyTrend(companyId),
      getLatestInsight(companyId),
    ]);

    // Only present once real history 7+ days old exists — no fallback to "closest available",
    // since that would mislabel a same-day comparison as a "weekly" trend.
    result.trend = weekAgo ? {
      scoreDelta: result.overallScore - weekAgo.overall_score,
      documentsDelta: result.documentsReady - weekAgo.documents_ready,
      vendorsDelta: result.vendorCount - weekAgo.vendor_count,
      evidenceDelta: result.evidenceCount - weekAgo.evidence_count,
      sinceDate: weekAgo.created_at,
    } : null;
    result.latestInsight = latestInsight;

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/simulate', async (req, res, next) => {
  try {
    const { companyId, itemKeys } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    if (!(await loadOwnedCompanyId(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });
    if (!Array.isArray(itemKeys) || itemKeys.some((k) => typeof k !== 'string')) {
      return res.status(400).json({ error: 'itemKeys must be an array of strings' });
    }

    res.json(await simulateGapAnalysis(companyId, itemKeys.slice(0, 50)));
  } catch (err) { next(err); }
});

router.get('/risk-prediction', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    if (!(await loadOwnedCompanyId(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      `SELECT created_at, framework_scores FROM score_snapshots WHERE company_id = $1 ORDER BY created_at`,
      [companyId],
    );
    res.json(computeRiskPrediction(rows));
  } catch (err) { next(err); }
});

router.get('/timeline', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    if (!(await loadOwnedCompanyId(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });

    res.json(await getTimeline(companyId));
  } catch (err) { next(err); }
});

module.exports = router;
