// A risk register needs two different things and this app keeps them separate on purpose. Judging
// how likely something is and how bad it would be is a real judgment call — reasonable for an AI to
// estimate the same way it already estimates vendor risk tiers. But turning "likelihood: high,
// impact: medium" into a single severity label is not a judgment call, it's a fixed lookup — the
// same 3x3 likelihood/impact matrix every risk-management framework (ISO 27001, NIST) already uses.
// So the AI is only ever asked for likelihood and impact; computeRiskLevel() is the one place that
// decides the final tier, deterministically, whether the risk came from AI suggestion or a manual entry.

const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const VALID_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set(['operational', 'technical', 'vendor', 'data', 'personnel', 'other']);

const RISK_MATRIX = {
  high: { high: 'critical', medium: 'high', low: 'medium' },
  medium: { high: 'high', medium: 'medium', low: 'low' },
  low: { high: 'medium', medium: 'low', low: 'low' },
};

function computeRiskLevel(likelihood, impact) {
  return RISK_MATRIX[likelihood]?.[impact] || 'low';
}

function buildSystemPrompt(vendorBlock, gapBlock) {
  return `You are a risk management analyst. Given a company's profile, its vendor register, and its
compliance gap analysis, identify realistic, specific operational and security risks this company
actually faces — not generic industry boilerplate.

${vendorBlock}

${gapBlock}

Rules:
- Ground every risk in something actually true about this company: a specific vendor dependency, a
  specific missing control from the gap analysis, a specific data type or AI system it uses. Do not
  invent a risk that isn't traceable to the data given.
- likelihood and impact must each be exactly one of "low", "medium", "high" — your honest estimate,
  not a placeholder. Do not include a "risk_level" or "severity" field — that is computed separately.
- category must be exactly one of: "operational", "technical", "vendor", "data", "personnel", "other".
- mitigation: one concrete, specific suggested action — not "improve security".
- Return at most 6 risks, the most material ones, not an exhaustive list.
- Respond with ONLY a raw JSON array, no markdown fences, no prose before or after. Example shape:
[{"title":"...","description":"...","category":"vendor","likelihood":"medium","impact":"high","mitigation":"..."}]`;
}

function vendorBlock(vendors) {
  if (!vendors.length) return 'Vendor Risk Register: empty.';
  const rows = vendors.map((v) => `- ${v.name} (${v.category}, ${v.risk_tier} risk)`);
  return `Vendor Risk Register:\n${rows.join('\n')}`;
}

function gapBlock(gapAnalysis) {
  const parts = gapAnalysis.frameworks.map((fw) => {
    const missing = fw.items.filter((i) => !i.satisfied).map((i) => i.label);
    return `- ${fw.label}: missing ${missing.length ? missing.join(', ') : 'nothing'}`;
  });
  return `Compliance gaps:\n${parts.join('\n')}`;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeRisk(raw) {
  const likelihood = String(raw.likelihood || '').toLowerCase();
  const impact = String(raw.impact || '').toLowerCase();
  const category = String(raw.category || '').toLowerCase();
  if (!raw.title || !VALID_LEVELS.has(likelihood) || !VALID_LEVELS.has(impact) || !VALID_CATEGORIES.has(category)) return null;
  return {
    title: String(raw.title).slice(0, 200),
    description: raw.description ? String(raw.description).slice(0, 1000) : null,
    category,
    likelihood,
    impact,
    risk_level: computeRiskLevel(likelihood, impact),
    mitigation: raw.mitigation ? String(raw.mitigation).slice(0, 500) : null,
  };
}

async function detectRisks({ company, vendors, gapAnalysis, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });

  const systemPrompt = buildSystemPrompt(vendorBlock(vendors), gapBlock(gapAnalysis));
  const userPrompt = `${companyProfileBlock(company)}

Task: identify this company's most material risks and return the JSON array as specified.`;

  const { contentMd, model } = await impl.run({ systemPrompt, userPrompt, maxTokens: 1200 });

  let parsed;
  try {
    parsed = extractJson(contentMd);
  } catch (err) {
    throw Object.assign(new Error(`Risk detection returned unparseable output: ${err.message}`), { status: 502 });
  }
  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('Risk detection did not return a JSON array'), { status: 502 });
  }

  const risks = parsed.map(sanitizeRisk).filter(Boolean).slice(0, 6);
  return { risks, model, provider: providerKey };
}

module.exports = { computeRiskLevel, detectRisks };
