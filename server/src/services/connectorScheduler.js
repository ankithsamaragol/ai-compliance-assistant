const pool = require('../db/pool');
const { syncGithubConnector } = require('./connectors/syncConnector');

async function syncAllConnectors() {
  const { rows } = await pool.query(`SELECT * FROM connectors WHERE provider = 'github'`);
  for (const connector of rows) {
    await syncGithubConnector(connector, { auto: true }); // eslint-disable-line no-await-in-loop
  }
  if (rows.length) console.log(`Connector auto-sync: refreshed ${rows.length} GitHub connector(s)`);
  return rows.length;
}

// In-process only — runs for as long as this server process is alive, same as everything else in
// this local-first app. No OS-level cron: that would need the same Full Disk Access workaround
// already documented for backups, for a feature that only matters while the server is running
// anyway. Deliberately does NOT sync immediately on startup — `node --watch` restarts on every
// file save during development, and firing a real GitHub API call on each of those would be both
// wasteful and a good way to trip a rate limit while iterating.
function startConnectorScheduler() {
  const hours = Number(process.env.CONNECTOR_SYNC_INTERVAL_HOURS) || 24;
  const ms = hours * 60 * 60 * 1000;
  setInterval(() => {
    syncAllConnectors().catch((err) => console.error('Scheduled connector sync failed:', err));
  }, ms);
  console.log(`Connector auto-sync scheduled: every ${hours}h while this server process is running.`);
}

module.exports = { startConnectorScheduler, syncAllConnectors };
