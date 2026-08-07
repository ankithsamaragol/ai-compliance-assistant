// Compliance Chat already answers open-ended questions about a company's posture. This is a
// narrower, more structured tool: the user pastes an actual piece of regulatory text — a clause
// from a law, a line from a customer's security questionnaire, a new framework requirement — and
// gets back a plain-English translation plus a grounded verdict against this company's *current
// real data*, not a general answer. The two genuinely different AI jobs here are translating
// legal/regulatory prose into plain English, and mapping it to the fixed list of checklist items
// this app actually tracks (never inventing a new one, same restraint as evidence mapping). Once
// mapped, whether each of those items is actually satisfied is a plain lookup against the gap
// analysis this app already computed deterministically — the AI never gets to decide "are we
// compliant," only "what does this text mean" and "which of our real checklist items does it
// concern."

const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');
const { GAP_CHECKLIST } = require('../templates/gapChecklist');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const MAX_CLAUSE_CHARS = 4000;
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

// Every checklist item, not just evidence-backed ones (unlike evidenceTargets() in
// evidenceIntelligence.js) — a regulatory clause can just as easily map to a document ("the
// controller shall maintain a record of processing activities" -> ROPA) or a vendor-register
// requirement as to a piece of evidence.
function checklistTargets() {
  const targets = [];
  for (const [fwKey, def] of Object.entries(GAP_CHECKLIST)) {
    def.items.forEach((item) => {
      targets.push({ framework: fwKey, frameworkLabel: def.label, key: item.key, label: item.label });
    });
  }
  return targets;
}

function buildSystemPrompt(targets) {
  const list = targets.map((t) => `- framework="${t.framework}" key="${t.key}" — ${t.label} (${t.frameworkLabel})`).join('\n');
  return `You are a compliance analyst. The user will paste a piece of regulatory or policy text — a
clause from a law, a line from a customer security questionnaire, a requirement from a framework —
and you translate it and map it to a fixed list of checklist items this company's compliance program
already tracks.

Checklist items you may map to (use the exact framework and key values shown — do not invent others):
${list}

Rules:
- plain_english: 2-4 plain, non-legalese sentences explaining what the pasted text actually requires
  a company to do. If the pasted text isn't recognizable as a regulatory/compliance requirement at
  all, say so plainly instead of forcing an interpretation.
- mapped_items: only include an item this text genuinely and specifically concerns. If it doesn't
  clearly relate to anything in the list, return an empty array — do not force a match onto the
  closest-sounding item.
- One clause may map to more than one item if it genuinely covers more than one.
- confidence must be exactly one of "high", "medium", "low" — be conservative.
- reasoning: one concise sentence for each mapped item citing what in the text connects it to that
  specific item.
- Respond with ONLY raw JSON, no markdown fences, no prose before or after. Exact shape:
{"plain_english":"...","mapped_items":[{"framework":"gdpr","key":"ropa","confidence":"high","reasoning":"..."}]}`;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeResult(contentMd, targets) {
  let parsed;
  try {
    parsed = extractJson(contentMd);
  } catch (err) {
    throw Object.assign(new Error(`Regulation interpretation returned unparseable output: ${err.message}`), { status: 502 });
  }

  const validKeys = new Set(targets.map((t) => `${t.framework}:${t.key}`));
  const seen = new Set();
  const mappedItems = Array.isArray(parsed.mapped_items)
    ? parsed.mapped_items
        .filter((m) => m && validKeys.has(`${m.framework}:${m.key}`) && VALID_CONFIDENCE.has(m.confidence))
        .filter((m) => {
          const dedupeKey = `${m.framework}:${m.key}`;
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        })
        .map((m) => ({
          framework: String(m.framework),
          key: String(m.key),
          confidence: String(m.confidence),
          reasoning: m.reasoning ? String(m.reasoning).slice(0, 300) : null,
        }))
        .slice(0, 6)
    : [];

  return {
    plainEnglish: parsed.plain_english ? String(parsed.plain_english).slice(0, 800) : null,
    mappedItems,
  };
}

// Deterministic: whether a mapped item is actually satisfied comes from the gap analysis this app
// already computed from real data, never from the AI's own judgment.
function crossReferenceGapAnalysis(mappedItems, gapAnalysis) {
  const itemsByKey = new Map();
  for (const fw of gapAnalysis.frameworks) {
    for (const item of fw.items) {
      itemsByKey.set(`${fw.key}:${item.key}`, { frameworkLabel: fw.label, label: item.label, satisfied: item.satisfied });
    }
  }

  const findings = [];
  for (const m of mappedItems) {
    const found = itemsByKey.get(`${m.framework}:${m.key}`);
    if (!found) continue; // defensive — every validated key should exist, but never assume
    findings.push({
      framework: m.framework,
      frameworkLabel: found.frameworkLabel,
      key: m.key,
      label: found.label,
      satisfied: found.satisfied,
      confidence: m.confidence,
      reasoning: m.reasoning,
    });
  }
  return findings;
}

function computeVerdict(findings) {
  if (findings.length === 0) return 'not_covered';
  if (findings.every((f) => f.satisfied)) return 'likely_met';
  if (findings.every((f) => !f.satisfied)) return 'gap';
  return 'partial';
}

async function interpretClause({ company, clauseText, gapAnalysis, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });

  const trimmed = (clauseText || '').trim();
  if (!trimmed) throw Object.assign(new Error('clauseText is required'), { status: 400 });
  const truncated = trimmed.length > MAX_CLAUSE_CHARS ? `${trimmed.slice(0, MAX_CLAUSE_CHARS)}\n\n[...truncated...]` : trimmed;

  const targets = checklistTargets();
  const systemPrompt = buildSystemPrompt(targets);
  const userPrompt = `${companyProfileBlock(company)}

--- pasted text ---
${truncated}
--- end of pasted text ---

Task: translate this text to plain English and map it to the checklist as specified.`;

  const { contentMd, model } = await impl.run({ systemPrompt, userPrompt, maxTokens: 700 });
  const { plainEnglish, mappedItems } = sanitizeResult(contentMd, targets);
  const findings = crossReferenceGapAnalysis(mappedItems, gapAnalysis);

  return { plainEnglish, verdict: computeVerdict(findings), findings, provider: providerKey, model };
}

module.exports = { interpretClause, computeVerdict, crossReferenceGapAnalysis, checklistTargets };
