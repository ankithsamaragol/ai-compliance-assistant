const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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
      data_types: dataTypes, cloud_providers: cloudProviders, tools_used: toolsUsed, notes,
    } = req.body;

    if (!name || !industry || !sizeBand || !country) {
      return res.status(400).json({ error: 'name, industry, size_band, and country are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO companies
        (account_id, name, industry, size_band, country, contact_email, processes_pii, processes_eu_data, data_types, cloud_providers, tools_used, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.account.id, name, industry, sizeBand, country, contactEmail || null,
        !!processesPii, !!processesEuData,
        dataTypes || [], cloudProviders || [], toolsUsed || [], notes || null,
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

module.exports = router;
