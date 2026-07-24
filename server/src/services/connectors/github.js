// GitHub OAuth connector — scope is deliberately minimal: `read:org` only, no `repo` access, so
// it never sees repository contents. Signals are limited to org-level policy fields from
// GET /orgs/{org} that GitHub's own docs do NOT mark deprecated as of this writing — the
// "Security & Analysis" fields (dependency graph / secret scanning / Dependabot enablement) are
// explicitly documented as deprecated on this endpoint and were excluded for that reason, the
// same live-verify-before-trusting discipline that led to reverting the personal-2FA fallback.
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

// No organization to check. A personal-account 2FA fallback was tried and reverted: GitHub's
// API doesn't expose an individual's 2FA status to OAuth Apps (confirmed live against GET
// /user, which returns no `two_factor_authentication` field at all) — only org-wide enforcement
// policy, which is a setting the org controls, not private user data. So there's honestly
// nothing this connector can check without an organization.
function noOrgResult(note) {
  const summary = `${note} GitHub also doesn't expose an individual account's own 2FA status via its API, so there's no fallback signal to check here either.`;
  return { orgLogin: null, summary, mapped_controls: [] };
}

const LEAST_PRIVILEGE_PERMISSIONS = new Set(['none', 'read']);

// Pure function, deliberately separated from the network call above it: turns a GET /orgs/{org}
// payload into findings + mapped_controls. Kept pure so it's unit-testable with synthetic org
// objects — the account this was built and tested against has no live GitHub organization, so
// this logic could be verified for correctness but not GitHub's actual field behavior, unlike the
// 2FA signal which was confirmed against a real org. Every field is read defensively (undefined is
// treated as "not visible," never coerced to a false negative), same discipline as the reverted
// personal-2FA fallback.
function computeOrgFindings(org) {
  const findings = [];
  const mapped_controls = [];

  // Signal 1: org-wide 2FA enforcement + Signal 3 (public repo creation) both speak to the same
  // checklist item (access control), so they're combined into one mapped_controls entry instead
  // of two duplicate pills for the same target.
  const accessControlReasons = [];
  let accessControlConfidence = null;

  if (org.two_factor_requirement_enabled === true) {
    findings.push('enforces two-factor authentication for all members');
    accessControlReasons.push('two-factor authentication is enforced for all members');
    accessControlConfidence = 'high';
  } else if (org.two_factor_requirement_enabled === false) {
    findings.push('does NOT enforce two-factor authentication for all members');
  }

  if (org.members_can_create_public_repositories === false) {
    findings.push('restricts members from creating public repositories');
    accessControlReasons.push('members cannot create public repositories (reduces accidental data exposure)');
    if (!accessControlConfidence) accessControlConfidence = 'medium';
  } else if (org.members_can_create_public_repositories === true) {
    findings.push('allows members to create public repositories without restriction');
  }

  if (accessControlReasons.length) {
    mapped_controls.push({
      framework: 'cmmc', key: 'access_evidence', confidence: accessControlConfidence,
      reasoning: `GitHub org "${org.login}": ${accessControlReasons.join('; ')} (live API check).`,
    });
  }

  // Signal 2: default repository permission — a distinct checklist item (configuration baseline),
  // not folded into access_evidence above.
  if (org.default_repository_permission) {
    const perm = org.default_repository_permission;
    findings.push(`sets default repository permission to "${perm}"`);
    if (LEAST_PRIVILEGE_PERMISSIONS.has(perm)) {
      mapped_controls.push({
        framework: 'cmmc', key: 'config_baseline', confidence: 'medium',
        reasoning: `Default repository permission is "${perm}" (least-privilege default for new members), confirmed live via GitHub API.`,
      });
    }
  }

  return { findings, mapped_controls };
}

// Pulls the current compliance-relevant facts and shapes them exactly like an evidenceIntelligence
// result (summary + mapped_controls), so gap-analysis scoring treats connector-derived evidence
// identically to AI-analyzed uploads.
async function syncSignals(accessToken) {
  const { org, note } = await selectOrg(accessToken);
  if (!org) {
    return noOrgResult(note);
  }

  const { findings, mapped_controls } = computeOrgFindings(org);
  let summary = findings.length
    ? `GitHub organization "${org.login}" ${findings.join('; ')}.`
    : `GitHub organization "${org.login}" connected, but none of the checked policy fields were visible — this usually means the connected account isn't an organization owner.`;

  if (note) summary = `${summary} (${note})`;

  return { orgLogin: org.login, summary, mapped_controls };
}

module.exports = { getAuthorizeUrl, exchangeCodeForToken, syncSignals, computeOrgFindings };
