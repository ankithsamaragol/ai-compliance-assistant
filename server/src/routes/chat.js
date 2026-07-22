const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { askQuestion } = require('../services/complianceChat');
const { computeGapAnalysis } = require('../services/gapAnalysis');

const router = express.Router();
router.use(requireAuth);

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.GENERATE_RATE_LIMIT_PER_HOUR) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `account:${req.account.id}`,
  message: { error: 'Chat rate limit reached. Try again later.' },
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
      'SELECT id, role, content, provider, created_at FROM chat_messages WHERE company_id = $1 ORDER BY created_at ASC',
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const { companyId, message, provider } = req.body;
    if (!companyId || !message || !message.trim()) {
      return res.status(400).json({ error: 'companyId and a non-empty message are required' });
    }

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const [{ rows: vendors }, gapAnalysis, { rows: documents }, { rows: historyRows }] = await Promise.all([
      pool.query('SELECT * FROM vendors WHERE company_id = $1', [companyId]),
      computeGapAnalysis(companyId),
      pool.query('SELECT framework, doc_type, title, status FROM documents WHERE company_id = $1', [companyId]),
      pool.query('SELECT role, content FROM chat_messages WHERE company_id = $1 ORDER BY created_at ASC', [companyId]),
    ]);

    await pool.query(
      `INSERT INTO chat_messages (company_id, role, content) VALUES ($1, 'user', $2)`,
      [companyId, message.trim()],
    );

    const { answer, model, provider: usedProvider } = await askQuestion({
      company, vendors, gapAnalysis, documents, history: historyRows, question: message.trim(), provider,
    });

    const { rows: inserted } = await pool.query(
      `INSERT INTO chat_messages (company_id, role, content, provider) VALUES ($1, 'assistant', $2, $3) RETURNING *`,
      [companyId, answer, usedProvider],
    );

    res.status(201).json({ message: inserted[0], model });
  } catch (err) { next(err); }
});

router.delete('/', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    await pool.query('DELETE FROM chat_messages WHERE company_id = $1', [companyId]);
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
