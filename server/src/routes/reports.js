const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateExecutiveReport } = require('../services/executiveReport');
const { computeGapAnalysis } = require('../services/gapAnalysis');

const router = express.Router();
router.use(requireAuth);

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.GENERATE_RATE_LIMIT_PER_HOUR) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `account:${req.account.id}`,
  message: { error: 'Generation rate limit reached. Try again later.' },
});

async function loadOwnedCompany(companyId, accountId) {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1 AND account_id = $2', [companyId, accountId]);
  return rows[0] || null;
}

router.post('/executive', reportLimiter, async (req, res, next) => {
  try {
    const { companyId, provider } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const [gapAnalysis, { rows: vendors }, { rows: recentDocuments }] = await Promise.all([
      computeGapAnalysis(companyId),
      pool.query('SELECT * FROM vendors WHERE company_id = $1', [companyId]),
      pool.query(
        `SELECT title, framework, status, created_at FROM documents
         WHERE company_id = $1 AND framework != 'executive_report' ORDER BY created_at DESC LIMIT 5`,
        [companyId],
      ),
    ]);

    const { rows: inserted } = await pool.query(
      `INSERT INTO documents (company_id, framework, doc_type, title, status)
       VALUES ($1, 'executive_report', 'summary', 'Executive Compliance Summary', 'generating') RETURNING id`,
      [companyId],
    );
    const documentId = inserted[0].id;

    try {
      const { contentMd, model, provider: usedProvider } = await generateExecutiveReport({
        company, gapAnalysis, vendors, recentDocuments, provider,
      });
      const { rows } = await pool.query(
        `UPDATE documents SET status = 'ready', content_md = $1, model = $2, provider = $3, updated_at = now() WHERE id = $4 RETURNING *`,
        [contentMd, model, usedProvider, documentId],
      );
      res.status(201).json(rows[0]);
    } catch (genErr) {
      await pool.query(`UPDATE documents SET status = 'failed', error = $1, updated_at = now() WHERE id = $2`, [genErr.message, documentId]);
      throw genErr;
    }
  } catch (err) { next(err); }
});

module.exports = router;
