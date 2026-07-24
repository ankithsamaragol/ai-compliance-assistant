const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { detectVendors } = require('../services/vendorRegister');
const { recordSnapshot } = require('../services/scoreHistory');

const router = express.Router();
router.use(requireAuth);

const detectLimiter = rateLimit({
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

router.get('/', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      `SELECT * FROM vendors WHERE company_id = $1
       ORDER BY CASE risk_tier WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, name`,
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/detect', detectLimiter, async (req, res, next) => {
  try {
    const { companyId, provider } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { vendors, model, provider: usedProvider } = await detectVendors({ company, provider });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM vendors WHERE company_id = $1 AND source = 'ai'`, [companyId]);
      for (const v of vendors) {
        await client.query(
          `INSERT INTO vendors (company_id, name, category, risk_tier, reasoning, recommended_controls, review_frequency, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'ai')`,
          [companyId, v.name, v.category, v.risk_tier, v.reasoning, v.recommended_controls, v.review_frequency],
        );
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      `SELECT * FROM vendors WHERE company_id = $1
       ORDER BY CASE risk_tier WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, name`,
      [companyId],
    );
    await recordSnapshot(companyId, 'vendor_detected', `${rows.length} vendor${rows.length === 1 ? '' : 's'} detected`);
    res.status(201).json({ vendors: rows, model, provider: usedProvider });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM vendors v USING companies c
       WHERE v.id = $1 AND v.company_id = c.id AND c.account_id = $2
       RETURNING v.id`,
      [req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vendor not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
