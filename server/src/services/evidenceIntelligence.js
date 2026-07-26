const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');
const { GAP_CHECKLIST } = require('../templates/gapChecklist');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const MAX_TEXT_CHARS = 12000;
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

// Only checklist items whose check type is 'evidence' are valid AI mapping targets —
// this keeps the model from inventing a match against document- or vendor-satisfied items.
function evidenceTargets() {
  const targets = [];
  for (const [fwKey, def] of Object.entries(GAP_CHECKLIST)) {
    def.items.forEach((item) => {
      if (item.check.type === 'evidence') {
        targets.push({ framework: fwKey, frameworkLabel: def.label, key: item.key, label: item.label });
      }
    });
  }
  return targets;
}

function buildSystemPrompt(targets) {
  const list = targets.map((t) => `- framework="${t.framework}" key="${t.key}" — ${t.label} (${t.frameworkLabel})`).join('\n');
  return `You are a compliance evidence analyst. You are given text extracted from a file a company uploaded
as potential compliance evidence, plus a fixed list of specific checklist items this evidence could support.

Checklist items you may map to (use the exact framework and key values shown — do not invent others):
${list}

Rules:
- Only map to items this evidence genuinely and specifically supports. If it doesn't clearly support
  any listed item, return an empty mapped_controls array — do not force a match.
- One piece of evidence may support multiple items if it genuinely covers more than one.
- confidence must be exactly one of "high", "medium", "low". Be conservative — most single pieces of evidence
  should be medium at best unless it's unambiguous and complete for that specific item.
- reasoning: one concise sentence citing what's actually visible/present, not generic language.
- summary: 1-2 sentences describing what this evidence actually shows/contains, for a human skimming a list.
- Respond with ONLY raw JSON, no markdown fences, no prose before or after. Example shape:
{"summary":"...","mapped_controls":[{"framework":"cmmc","key":"security_training","confidence":"medium","reasoning":"..."}]}`;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeAnalysis(contentMd, targets) {
  let parsed;
  try {
    parsed = extractJson(contentMd);
  } catch (err) {
    throw Object.assign(new Error(`Evidence analysis returned unparseable output: ${err.message}`), { status: 502 });
  }

  const validKeys = new Set(targets.map((t) => `${t.framework}:${t.key}`));
  const mapped_controls = Array.isArray(parsed.mapped_controls)
    ? parsed.mapped_controls
        .filter((m) => m && validKeys.has(`${m.framework}:${m.key}`) && VALID_CONFIDENCE.has(m.confidence))
        .map((m) => ({
          framework: String(m.framework),
          key: String(m.key),
          confidence: String(m.confidence),
          reasoning: m.reasoning ? String(m.reasoning).slice(0, 500) : null,
        }))
        .slice(0, 10)
    : [];

  return {
    summary: parsed.summary ? String(parsed.summary).slice(0, 500) : null,
    mapped_controls,
  };
}

async function analyzeEvidence({ company, extractedText, filename, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });

  const targets = evidenceTargets();
  const trimmed = extractedText.trim();
  if (!trimmed) {
    return { summary: 'File appears to be empty or contains no extractable text.', mapped_controls: [], provider: providerKey, model: null };
  }
  const truncated = trimmed.length > MAX_TEXT_CHARS ? `${trimmed.slice(0, MAX_TEXT_CHARS)}\n\n[...truncated...]` : trimmed;

  const systemPrompt = buildSystemPrompt(targets);
  const userPrompt = `${companyProfileBlock(company)}

Uploaded file: ${filename}

--- Extracted text ---
${truncated}
--- end of text ---

Task: analyze this evidence and return the JSON object as specified.`;

  const { contentMd, model } = await impl.run({ systemPrompt, userPrompt });
  const { summary, mapped_controls } = sanitizeAnalysis(contentMd, targets);

  return { summary, mapped_controls, provider: providerKey, model };
}

module.exports = { analyzeEvidence, evidenceTargets };
