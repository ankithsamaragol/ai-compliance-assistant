const jwt = require('jsonwebtoken');
const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { encrypt } = require('../services/crypto');
const github = require('../services/connectors/github');
const { recordSnapshot } = require('../services/scoreHistory');
const { syncGithubConnector, upsertGithubEvidence } = require('../services/connectors/syncConnector');

const router = express.Router();

async function loadOwnedCompany(companyId, orgId) {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1 AND org_id = $2', [companyId, orgId]);
  return rows[0] || null;
}

// --- Endpoints requiring the normal Bearer-token auth (called via fetch(), not a page nav) ---

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    const company = await loadOwnedCompany(companyId, req.account.orgId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(
      `SELECT id, provider, external_account, scopes, status, error, last_synced_at, connected_at
       FROM connectors WHERE company_id = $1`,
      [companyId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/github/start', requireAuth, async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId query param is required' });
    const company = await loadOwnedCompany(companyId, req.account.orgId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // OAuth redirects are plain browser navigations and can't carry an Authorization header, so
    // identity+ownership is carried in a short-lived signed state token instead, verified at the
    // callback below rather than via requireAuth.
    const state = jwt.sign({ companyId: company.id, orgId: req.account.orgId }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ url: github.getAuthorizeUrl(state) });
  } catch (err) { next(err); }
});

router.post('/github/sync', requireAuth, async (req, res, next) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const company = await loadOwnedCompany(companyId, req.account.orgId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { rows } = await pool.query(`SELECT * FROM connectors WHERE company_id = $1 AND provider = 'github'`, [companyId]);
    const connector = rows[0];
    if (!connector) return res.status(404).json({ error: 'GitHub is not connected for this company' });

    const updated = await syncGithubConnector(connector, { auto: false });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/github', requireAuth, async (req, res, next) => {
  try {
    const { companyId } = req.query;
    const company = await loadOwnedCompany(companyId, req.account.orgId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    await pool.query(`DELETE FROM connectors WHERE company_id = $1 AND provider = 'github'`, [companyId]);
    await pool.query(`DELETE FROM evidence WHERE company_id = $1 AND source = 'github'`, [companyId]);
    res.status(204).send();
  } catch (err) { next(err); }
});

// --- The OAuth callback: hit directly by GitHub's redirect, so no Authorization header exists.
// Trust comes from the signed `state` param instead. Ends in a browser redirect back to the app. ---

router.get('/github/callback', async (req, res) => {
  const clientOrigin = (process.env.CLIENT_ORIGINS || 'http://localhost:5300').split(',')[0].trim();
  const { code, state, error: oauthError } = req.query;

  function backToApp(status) {
    res.redirect(`${clientOrigin}/?github_connect=${status}`);
  }

  if (oauthError) return backToApp('denied');
  if (!code || !state) return backToApp('error');

  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return backToApp('error');
  }

  try {
    const company = await loadOwnedCompany(payload.companyId, payload.orgId);
    if (!company) return backToApp('error');

    const { accessToken, scopes } = await github.exchangeCodeForToken(code);
    const signals = await github.syncSignals(accessToken);

    await pool.query(
      `INSERT INTO connectors (company_id, provider, external_account, access_token_encrypted, scopes, status, last_synced_at)
       VALUES ($1, 'github', $2, $3, $4, 'connected', now())
       ON CONFLICT (company_id, provider) DO UPDATE
       SET external_account = $2, access_token_encrypted = $3, scopes = $4, status = 'connected', error = NULL, last_synced_at = now()`,
      [company.id, signals.orgLogin, encrypt(accessToken), scopes],
    );
    await upsertGithubEvidence(company.id, signals);
    await recordSnapshot(company.id, 'connector_synced', 'GitHub');

    backToApp('success');
  } catch (err) {
    console.error('GitHub connector callback failed:', err);
    backToApp('error');
  }
});

module.exports = router;
