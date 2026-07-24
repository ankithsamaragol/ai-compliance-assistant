const pool = require('../../db/pool');
const { decrypt } = require('../crypto');
const github = require('./github');
const { recordSnapshot } = require('../scoreHistory');

async function upsertGithubEvidence(companyId, { orgLogin, summary, mapped_controls }) {
  await pool.query(
    `DELETE FROM evidence WHERE company_id = $1 AND source = 'github' AND filename = 'github:org_2fa'`,
    [companyId],
  );
  await pool.query(
    `INSERT INTO evidence (company_id, filename, original_name, status, summary, mapped_controls, provider, source, analyzed_at)
     VALUES ($1, 'github:org_2fa', $2, 'analyzed', $3, $4, 'github', 'github', now())`,
    [companyId, orgLogin ? `GitHub org: ${orgLogin} (2FA enforcement)` : 'GitHub connector sync', summary, JSON.stringify(mapped_controls)],
  );
}

// Shared by the manual "Sync now" button and the background scheduler, so both paths update the
// connector, evidence, and score history identically — the only difference is the trigger_detail
// label, so the Timeline shows which syncs were manual vs automatic.
async function syncGithubConnector(connector, { auto = false } = {}) {
  try {
    const accessToken = decrypt(connector.access_token_encrypted);
    const signals = await github.syncSignals(accessToken);
    await upsertGithubEvidence(connector.company_id, signals);
    const { rows } = await pool.query(
      `UPDATE connectors SET external_account = $1, status = 'connected', error = NULL, last_synced_at = now()
       WHERE id = $2 RETURNING id, company_id, provider, external_account, scopes, status, error, last_synced_at, connected_at`,
      [signals.orgLogin, connector.id],
    );
    await recordSnapshot(connector.company_id, 'connector_synced', auto ? 'GitHub (auto-sync)' : 'GitHub');
    return rows[0];
  } catch (err) {
    const { rows } = await pool.query(
      `UPDATE connectors SET status = 'error', error = $1 WHERE id = $2
       RETURNING id, company_id, provider, external_account, scopes, status, error, last_synced_at, connected_at`,
      [err.message, connector.id],
    );
    return rows[0];
  }
}

module.exports = { syncGithubConnector, upsertGithubEvidence };
