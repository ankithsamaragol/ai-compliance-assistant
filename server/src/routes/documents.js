const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateDocument, listProviders } = require('../services/generateDocument');
const { exportToDocx } = require('../services/exportDocx');
const { listFrameworks, getDocTypeDef } = require('../templates/catalog');
const { recordSnapshot } = require('../services/scoreHistory');

const router = express.Router();
router.use(requireAuth);

const generateLimiter = rateLimit({
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

router.get('/catalog', (req, res) => {
  res.json(listFrameworks());
});

router.get('/providers', (req, res) => {
  res.json(listProviders());
});

router.get('/', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      'SELECT id, framework, doc_type, title, status, model, provider, created_at, updated_at FROM documents WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/generate', generateLimiter, async (req, res, next) => {
  try {
    const { companyId, framework, docType, provider } = req.body;
    if (!companyId || !framework || !docType) {
      return res.status(400).json({ error: 'companyId, framework, and docType are required' });
    }

    const def = getDocTypeDef(framework, docType);
    if (!def) return res.status(400).json({ error: 'Unknown framework/docType combination' });

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows: inserted } = await pool.query(
      `INSERT INTO documents (company_id, framework, doc_type, title, status)
       VALUES ($1,$2,$3,$4,'generating') RETURNING id`,
      [companyId, framework, docType, def.title],
    );
    const documentId = inserted[0].id;

    try {
      const { contentMd, model, provider: usedProvider } = await generateDocument({ company, framework, docType, provider });
      const { rows } = await pool.query(
        `UPDATE documents SET status = 'ready', content_md = $1, model = $2, provider = $3, updated_at = now() WHERE id = $4 RETURNING *`,
        [contentMd, model, usedProvider, documentId],
      );
      if (framework !== 'executive_report') await recordSnapshot(companyId, 'document_generated', def.title);
      res.status(201).json(rows[0]);
    } catch (genErr) {
      await pool.query(
        `UPDATE documents SET status = 'failed', error = $1, updated_at = now() WHERE id = $2`,
        [genErr.message, documentId],
      );
      throw genErr;
    }
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.* FROM documents d JOIN companies c ON c.id = d.company_id
       WHERE d.id = $1 AND c.account_id = $2`,
      [req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id/export', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.* FROM documents d JOIN companies c ON c.id = d.company_id
       WHERE d.id = $1 AND c.account_id = $2`,
      [req.params.id, req.account.id],
    );
    const doc = rows[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'ready') return res.status(409).json({ error: `Document is not ready (status: ${doc.status})` });

    const buffer = await exportToDocx({ title: doc.title, contentMd: doc.content_md });
    const filename = `${doc.title.replace(/[^a-z0-9]+/gi, '_')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

module.exports = router;
