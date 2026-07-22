const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { computeGapAnalysis } = require('../services/gapAnalysis');

const router = express.Router();
router.use(requireAuth);

router.get('/gap-analysis', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });

    const { rows } = await pool.query('SELECT id FROM companies WHERE id = $1 AND account_id = $2', [
      companyId, req.account.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });

    const result = await computeGapAnalysis(companyId);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
