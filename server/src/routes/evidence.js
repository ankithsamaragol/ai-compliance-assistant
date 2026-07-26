const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { extractText, isImageFile } = require('../services/evidenceExtract');
const { analyzeEvidence } = require('../services/evidenceIntelligence');
const { recordSnapshot } = require('../services/scoreHistory');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'evidence');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(UPLOAD_ROOT, String(req.body.companyId || 'unassigned'));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-150);
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.GENERATE_RATE_LIMIT_PER_HOUR) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `account:${req.account.id}`,
  message: { error: 'Evidence upload rate limit reached. Try again later.' },
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
      `SELECT id, original_name, mime_type, size_bytes, status, summary, mapped_controls, provider, model, error, source, uploaded_at, analyzed_at
       FROM evidence WHERE company_id = $1 ORDER BY uploaded_at DESC`,
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/upload', uploadLimiter, upload.single('file'), async (req, res, next) => {
  let savedPath = null;
  try {
    const { companyId, provider } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    savedPath = req.file.path;

    const company = await loadOwnedCompany(companyId, req.account.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows: inserted } = await pool.query(
      `INSERT INTO evidence (company_id, filename, original_name, mime_type, size_bytes, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [companyId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size],
    );
    const evidenceId = inserted[0].id;

    // No vision-capable provider is wired up yet, so screenshots are stored but not analyzed.
    if (isImageFile(req.file.originalname)) {
      const { rows } = await pool.query(
        `UPDATE evidence SET status = 'unsupported', error = $1 WHERE id = $2 RETURNING *`,
        ['Screenshots aren\'t AI-readable yet — supported types are PDF, DOCX, TXT, MD, CSV, LOG, JSON. The file is still stored and visible in your evidence list.', evidenceId],
      );
      return res.status(201).json(rows[0]);
    }

    const extraction = await extractText(savedPath, req.file.originalname);
    if (!extraction.supported) {
      const { rows } = await pool.query(
        `UPDATE evidence SET status = 'unsupported', error = $1 WHERE id = $2 RETURNING *`,
        [extraction.reason, evidenceId],
      );
      return res.status(201).json(rows[0]);
    }
    const extractedText = extraction.text;

    try {
      const { summary, mapped_controls, provider: usedProvider, model } =
        await analyzeEvidence({ company, extractedText, filename: req.file.originalname, provider });
      const { rows } = await pool.query(
        `UPDATE evidence SET status = 'analyzed', summary = $1, mapped_controls = $2, provider = $3, model = $4, analyzed_at = now()
         WHERE id = $5 RETURNING *`,
        [summary, JSON.stringify(mapped_controls), usedProvider, model, evidenceId],
      );
      await recordSnapshot(companyId, 'evidence_analyzed', req.file.originalname);
      res.status(201).json(rows[0]);
    } catch (analysisErr) {
      const { rows } = await pool.query(
        `UPDATE evidence SET status = 'failed', error = $1 WHERE id = $2 RETURNING *`,
        [analysisErr.message, evidenceId],
      );
      res.status(201).json(rows[0]);
    }
  } catch (err) {
    if (savedPath) fs.unlink(savedPath, () => {});
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM evidence e USING companies c
       WHERE e.id = $1 AND e.company_id = c.id AND c.account_id = $2
       RETURNING e.company_id, e.filename`,
      [req.params.id, req.account.id],
    );
    const deleted = rows[0];
    if (!deleted) return res.status(404).json({ error: 'Evidence not found' });
    fs.unlink(path.join(UPLOAD_ROOT, String(deleted.company_id), deleted.filename), () => {});
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
