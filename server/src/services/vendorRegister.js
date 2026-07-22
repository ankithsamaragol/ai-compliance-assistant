const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const VALID_TIERS = new Set(['critical', 'high', 'medium', 'low']);
const VALID_CATEGORIES = new Set([
  'hosting', 'payments', 'authentication', 'code_repository', 'communication', 'analytics', 'email', 'other',
]);

const SYSTEM_PROMPT = `You are a security and compliance analyst. Given a company's profile — its stated
cloud providers and tools/vendors — identify each distinct third-party vendor, classify it, and assess its
risk tier based on the data it can access and how business-critical it is.

Rules:
- Only include vendors explicitly named or clearly implied in the company profile (cloud providers, tools
  used). Do not invent vendors that aren't mentioned.
- risk_tier must be exactly one of: "critical", "high", "medium", "low".
  - critical: has access to production systems, payment data, or core customer PII, or the business cannot
    function without it
  - high: has access to sensitive data or is important to operations but not existential
  - medium: limited data access, replaceable without major disruption
  - low: minimal data access, non-essential
- category must be exactly one of: "hosting", "payments", "authentication", "code_repository",
  "communication", "analytics", "email", "other".
- reasoning: one concise sentence explaining the tier — reference the actual data/role, not generic text.
- recommended_controls: 2-4 short control phrases (e.g. "Enable MFA", "Review access quarterly").
- review_frequency: "Every 3 months" for critical, "Every 6 months" for high, "Annual" for medium/low.
- Respond with ONLY a raw JSON array, no markdown code fences, no prose before or after. Example shape:
[{"name":"AWS","category":"hosting","risk_tier":"critical","reasoning":"...","recommended_controls":["..."],"review_frequency":"Every 3 months"}]`;

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeVendor(raw) {
  const tier = String(raw.risk_tier || '').toLowerCase();
  const category = String(raw.category || '').toLowerCase();
  if (!raw.name || !VALID_TIERS.has(tier) || !VALID_CATEGORIES.has(category)) return null;
  return {
    name: String(raw.name).slice(0, 200),
    category,
    risk_tier: tier,
    reasoning: raw.reasoning ? String(raw.reasoning).slice(0, 1000) : null,
    recommended_controls: Array.isArray(raw.recommended_controls)
      ? raw.recommended_controls.map(String).slice(0, 10)
      : [],
    review_frequency: raw.review_frequency ? String(raw.review_frequency).slice(0, 100) : null,
  };
}

async function detectVendors({ company, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) {
    throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });
  }

  const userPrompt = `${companyProfileBlock(company)}

Task: Identify and risk-assess every third-party vendor implied by this company's cloud providers and
tools/vendors used. Return the JSON array as specified.`;

  const { contentMd, model } = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt });

  let parsed;
  try {
    parsed = extractJson(contentMd);
  } catch (err) {
    throw Object.assign(new Error(`Vendor detection returned unparseable output: ${err.message}`), { status: 502 });
  }
  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('Vendor detection did not return a JSON array'), { status: 502 });
  }

  const vendors = parsed.map(sanitizeVendor).filter(Boolean);
  return { vendors, model, provider: providerKey };
}

module.exports = { detectVendors };
