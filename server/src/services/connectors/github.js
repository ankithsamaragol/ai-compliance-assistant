// GitHub OAuth connector — v1 scope is deliberately minimal: the `read:org` scope only, and a
// single deterministic signal (org-wide 2FA enforcement). No repo/write access is requested.
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_BASE = 'https://api.github.com';
const SCOPES = 'read:org';

function getAuthorizeUrl(state) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw Object.assign(new Error('GitHub connector is not configured (GITHUB_CLIENT_ID / GITHUB_REDIRECT_URI missing)'), { status: 500 });
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: SCOPES, state });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw Object.assign(new Error(`GitHub token exchange failed: ${data.error_description || data.error || res.statusText}`), { status: 502 });
  }
  return { accessToken: data.access_token, scopes: data.scope };
}

async function ghGet(path, accessToken) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`GitHub API request failed (${res.status}): ${text || res.statusText}`), { status: 502 });
  }
  return res.json();
}

// Returns the org this connector will monitor, plus the raw org payload. GitHub OAuth (classic)
// isn't scoped to a single org at authorize time, so if the account belongs to multiple orgs we
// honestly monitor only the first and say so — picking an org silently would be worse.
async function selectOrg(accessToken) {
  const orgs = await ghGet('/user/orgs', accessToken);
  if (!orgs.length) {
    return { org: null, note: 'No GitHub organizations found on this account — org-level checks need an organization, not a personal account.' };
  }
  const org = await ghGet(`/orgs/${orgs[0].login}`, accessToken);
  const note = orgs.length > 1
    ? `Account belongs to ${orgs.length} organizations — only "${org.login}" is monitored for now.`
    : null;
  return { org, note };
}

// Pulls the current compliance-relevant facts and shapes them exactly like an evidenceIntelligence
// result (summary + mapped_controls), so gap-analysis scoring treats connector-derived evidence
// identically to AI-analyzed uploads.
async function syncOrgSignals(accessToken) {
  const { org, note } = await selectOrg(accessToken);
  if (!org) {
    return { orgLogin: null, summary: note, mapped_controls: [] };
  }

  const twoFactorEnforced = org.two_factor_requirement_enabled;
  const mapped_controls = [];
  let summary;

  if (twoFactorEnforced === true) {
    summary = `GitHub organization "${org.login}" enforces two-factor authentication for all members (verified live via GitHub API).`;
    mapped_controls.push({
      framework: 'cmmc', key: 'access_evidence', confidence: 'high',
      reasoning: `GitHub org "${org.login}" has two_factor_requirement_enabled=true, confirmed via a live API call, not a static document.`,
    });
  } else if (twoFactorEnforced === false) {
    summary = `GitHub organization "${org.login}" does NOT currently enforce two-factor authentication for all members.`;
  } else {
    summary = `GitHub organization "${org.login}" connected, but 2FA enforcement status wasn't visible — this usually means the connected account isn't an organization owner.`;
  }

  if (note) summary = `${summary} (${note})`;

  return { orgLogin: org.login, summary, mapped_controls };
}

module.exports = { getAuthorizeUrl, exchangeCodeForToken, syncOrgSignals };
