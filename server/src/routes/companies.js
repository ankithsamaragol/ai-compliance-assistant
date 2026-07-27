const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { detectProfileChanges } = require('../services/profileChangeDetection');

const router = express.Router();
router.use(requireAuth);

// Logos are small and stored inline as a data: URI on the row — no file-serving route exists in
// this app (evidence files are processed, never served back raw), so this avoids standing up a
// new auth-gated static route just for a handful of tiny images. Raster formats only: an SVG data
// URI rendered via <img> doesn't execute embedded scripts per spec, but there's no upside to
// accepting the riskier format when PNG/JPG/WEBP cover every real logo a company would upload.
const LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, LOGO_MIME_TYPES.has(file.mimetype));
  },
});

const EDITABLE_FIELDS = [
  'name', 'industry', 'size_band', 'country', 'contact_email',
  'processes_pii', 'processes_eu_data', 'data_types', 'cloud_providers',
  'tools_used', 'ai_systems_used', 'notes',
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies WHERE account_id = $1 ORDER BY created_at DESC', [
      req.account.id,
    ]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      name, industry, size_band: sizeBand, country, contact_email: contactEmail,
      processes_pii: processesPii, processes_eu_data: processesEuData,
      data_types: dataTypes, cloud_providers: cloudProviders, tools_used: toolsUsed,
      ai_systems_used: aiSystemsUsed, notes,
    } = req.body;

    if (!name || !industry || !sizeBand || !country) {
      return res.status(400).json({ error: 'name, industry, size_band, and country are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO companies
        (account_id, name, industry, size_band, country, contact_email, processes_pii, processes_eu_data, data_types, cloud_providers, tools_used, ai_systems_used, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        req.account.id, name, industry, sizeBand, country, contactEmail || null,
        !!processesPii, !!processesEuData,
        dataTypes || [], cloudProviders || [], toolsUsed || [], aiSystemsUsed || [], notes || null,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1 AND account_id = $2', [
      req.params.id, req.account.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM companies WHERE id = $1 AND account_id = $2', [
      req.params.id, req.account.id,
    ]);
    const before = existingRows[0];
    if (!before) return res.status(404).json({ error: 'Company not found' });

    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const setClauses = Object.keys(updates).map((field, i) => `${field} = $${i + 1}`);
    const values = Object.values(updates);
    const { rows: updatedRows } = await pool.query(
      `UPDATE companies SET ${setClauses.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1} RETURNING *`,
      [...values, req.params.id],
    );
    const after = updatedRows[0];

    const alerts = detectProfileChanges(before, after);
    let insertedAlerts = [];
    if (alerts.length) {
      const { rows: alertRows } = await pool.query(
        `INSERT INTO profile_change_alerts (company_id, message, suggested_action)
         SELECT $1, msg, action FROM UNNEST($2::text[], $3::text[]) AS t(msg, action)
         RETURNING *`,
        [after.id, alerts.map((a) => a.message), alerts.map((a) => a.suggested_action)],
      );
      insertedAlerts = alertRows;
    }

    res.json({ company: after, alerts: insertedAlerts });
  } catch (err) { next(err); }
});

router.get('/:id/alerts', async (req, res, next) => {
  try {
    const { rows: companyRows } = await pool.query('SELECT id FROM companies WHERE id = $1 AND account_id = $2', [
      req.params.id, req.account.id,
    ]);
    if (!companyRows[0]) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      `SELECT * FROM profile_change_alerts WHERE company_id = $1 AND dismissed = false ORDER BY created_at DESC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/alerts/:alertId/dismiss', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE profile_change_alerts a SET dismissed = true
       FROM companies c
       WHERE a.id = $1 AND a.company_id = $2 AND a.company_id = c.id AND c.account_id = $3
       RETURNING a.id`,
      [req.params.alertId, req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/logo', logoUpload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded, or file type not allowed (PNG/JPG/WEBP, 500KB max)' });

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const { rows } = await pool.query(
      `UPDATE companies SET logo_data_url = $1, updated_at = now() WHERE id = $2 AND account_id = $3 RETURNING *`,
      [dataUrl, req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id/logo', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET logo_data_url = NULL, updated_at = now() WHERE id = $1 AND account_id = $2 RETURNING *`,
      [req.params.id, req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
