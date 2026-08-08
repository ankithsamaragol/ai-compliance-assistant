const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { computeRiskLevel, detectRisks } = require('../services/riskRegister');
const { computeGapAnalysis } = require('../services/gapAnalysis');
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

const VALID_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set(['operational', 'technical', 'vendor', 'data', 'personnel', 'other']);
const VALID_STATUSES = new Set(['open', 'mitigated', 'accepted']);
const SEVERITY_ORDER = "CASE risk_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

async function loadOwnedCompany(companyId, accountId) {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1 AND account_id = $2', [companyId, accountId]);
  return rows[0] || null;
}

router.get('/', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    if (!(await loadOwnedCompany(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      `SELECT * FROM risks WHERE company_id = $1 ORDER BY ${SEVERITY_ORDER}, title`,
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      companyId, title, description, category, likelihood, impact, mitigation, owner,
    } = req.body;
    if (!companyId || !title) return res.status(400).json({ error: 'companyId and title are required' });
    if (!(await loadOwnedCompany(companyId, req.account.id))) return res.status(404).json({ error: 'Company not found' });

    const lk = String(likelihood || '').toLowerCase();
    const im = String(impact || '').toLowerCase();
    const cat = String(category || 'other').toLowerCase();
    if (!VALID_LEVELS.has(lk) || !VALID_LEVELS.has(im)) {
      return res.status(400).json({ error: 'likelihood and impact must each be one of: low, medium, high' });
    }
    if (!VALID_CATEGORIES.has(cat)) {
      return res.status(400).json({ error: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}` });
    }

    const { rows } = await pool.query(
      `INSERT INTO risks (company_id, title, description, category, likelihood, impact, risk_level, mitigation, owner, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual') RETURNING *`,
      [companyId, title, description || null, cat, lk, im, computeRiskLevel(lk, im), mitigation || null, owner || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/suggest', detectLimiter, async (req, res, next) => {
  try {
    const { companyId, provider } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const [{ rows: vendors }, gapAnalysis] = await Promise.all([
      pool.query('SELECT name, category, risk_tier FROM vendors WHERE company_id = $1', [companyId]),
      computeGapAnalysis(companyId),
    ]);
    const { risks, model, provider: usedProvider } = await detectRisks({ company, vendors, gapAnalysis, provider });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM risks WHERE company_id = $1 AND source = 'ai'`, [companyId]);
      for (const r of risks) {
        await client.query(
          `INSERT INTO risks (company_id, title, description, category, likelihood, impact, risk_level, mitigation, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ai')`,
          [companyId, r.title, r.description, r.category, r.likelihood, r.impact, r.risk_level, r.mitigation],
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
      `SELECT * FROM risks WHERE company_id = $1 ORDER BY ${SEVERITY_ORDER}, title`,
      [companyId],
    );
    await recordSnapshot(companyId, 'risk_detected', `${risks.length} risk${risks.length === 1 ? '' : 's'} identified`);
    res.status(201).json({ risks: rows, model, provider: usedProvider });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: existingRows } = await pool.query(
      `SELECT r.* FROM risks r JOIN companies c ON c.id = r.company_id WHERE r.id = $1 AND c.account_id = $2`,
      [req.params.id, req.account.id],
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Risk not found' });

    const fields = ['title', 'description', 'category', 'likelihood', 'impact', 'mitigation', 'owner', 'status'];
    const updates = {};
    for (const field of fields) {
      if (field in req.body) updates[field] = req.body[field];
    }
    if ('category' in updates && !VALID_CATEGORIES.has(String(updates.category).toLowerCase())) {
      return res.status(400).json({ error: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}` });
    }
    if ('status' in updates && !VALID_STATUSES.has(String(updates.status).toLowerCase())) {
      return res.status(400).json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }
    if (('likelihood' in updates && !VALID_LEVELS.has(String(updates.likelihood).toLowerCase()))
      || ('impact' in updates && !VALID_LEVELS.has(String(updates.impact).toLowerCase()))) {
      return res.status(400).json({ error: 'likelihood and impact must each be one of: low, medium, high' });
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    // Severity is re-derived whenever either input changes, from the same matrix a fresh entry
    // uses — a risk can't drift out of sync with its own inputs just because it was edited.
    const newLikelihood = (updates.likelihood || existing.likelihood).toLowerCase();
    const newImpact = (updates.impact || existing.impact).toLowerCase();
    updates.risk_level = computeRiskLevel(newLikelihood, newImpact);

    const setClauses = Object.keys(updates).map((field, i) => `${field} = $${i + 1}`);
    const values = Object.values(updates);
    const { rows } = await pool.query(
      `UPDATE risks SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, req.params.id],
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM risks r USING companies c
       WHERE r.id = $1 AND r.company_id = c.id AND c.account_id = $2
       RETURNING r.id`,
      [req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Risk not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
