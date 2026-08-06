// Business Change Detection (profileChangeDetection.js) catches a profile edit the moment it
// happens. This catches something different: the profile and the vendor register silently
// disagreeing with each other over time — the profile stops matching what was actually detected,
// or a vendor sits in the register with nothing in the profile explaining why it's there anymore.
// Nobody edited anything wrong; the two just drifted apart. That's a real trust problem for a
// compliance tool specifically — if the profile and the register don't agree, which one does an
// auditor believe?
//
// Pure function, always recomputed fresh from current data rather than stored — unlike a change
// alert (a one-time event), drift is a standing fact about the current state. It naturally stops
// appearing once the mismatch is actually fixed, so there's nothing to "dismiss": dismissing a
// still-true inconsistency would just be hiding it, not resolving it.

const CLOUD_PROVIDER_ALIASES = {
  aws: ['aws', 'amazon web services', 'amazon'],
  gcp: ['gcp', 'google cloud'],
  azure: ['azure', 'microsoft azure'],
};

function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

function detectProfileDrift(company, vendors) {
  const alerts = [];

  const toolTerms = new Set((company.tools_used || []).map(normalize));
  const cloudTerms = new Set();
  for (const cp of company.cloud_providers || []) {
    const key = normalize(cp);
    (CLOUD_PROVIDER_ALIASES[key] || [key]).forEach((alias) => cloudTerms.add(alias));
  }
  const allProfileTerms = [...toolTerms, ...cloudTerms];

  // A vendor sitting in the register with no corresponding entry anywhere in the current
  // profile — usually means the profile was edited (a tool/provider removed) after the vendor
  // was detected, and the register was never updated to match.
  for (const v of vendors) {
    const vName = normalize(v.name);
    const stillInProfile = allProfileTerms.some((term) => vName.includes(term) || term.includes(vName));
    if (!stillInProfile) {
      alerts.push({
        message: `"${v.name}" is still in your Vendor Risk Register (${v.risk_tier} risk) but no longer appears anywhere in your company profile's tools or cloud providers — remove it if you've actually stopped using it, or update the profile if that was an oversight.`,
        suggested_action: 'vendors',
      });
    }
  }

  // The reverse: the profile claims a cloud provider that has no matching vendor entry at all —
  // usually means vendor detection hasn't been (re-)run since that provider was added.
  for (const cp of company.cloud_providers || []) {
    const aliases = CLOUD_PROVIDER_ALIASES[normalize(cp)] || [normalize(cp)];
    const hasVendor = vendors.some((v) => aliases.some((a) => normalize(v.name).includes(a)));
    if (!hasVendor) {
      alerts.push({
        message: `Your profile lists "${cp}" as a cloud provider, but there's no matching entry in your Vendor Risk Register yet — run vendor detection again so its risk gets assessed.`,
        suggested_action: 'vendors',
      });
    }
  }

  return alerts;
}

module.exports = { detectProfileDrift };
