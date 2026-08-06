// Every other check in this app compares structured data (scores, profile fields, vendor names).
// This one compares prose — the same fact (retention period, breach-notification window, privacy
// contact) restated across several independently-generated documents. Whether "90 days" and "ninety
// days" agree, or whether "72 hours" and "30 days" don't, requires actually reading the sentence —
// that's a genuine AI task, not something a regex can do reliably. But once each document's facts
// are pulled out into a normalized number/email, deciding whether two documents disagree is a plain
// equality check — kept as ordinary code so the "is this a contradiction" verdict is never itself
// an AI guess.

const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const MAX_TEXT_CHARS = 8000;

const SYSTEM_PROMPT = `You are a compliance document analyst. You are given the text of ONE compliance
document belonging to a company. Extract three specific facts, but ONLY if each is explicitly and
unambiguously stated as a single value in this document. If a fact is absent, stated only vaguely
("a reasonable period", "without undue delay"), or stated as several different values for different
data categories with no single overall figure, return null for it — do not guess, average, or invent one.

Facts to extract:
1. retention_period — the company's general, overall retention period for personal/customer data as
   a whole (the figure a Privacy Policy or DPA states for how long customer data is kept). Do NOT
   extract a retention period for a narrower, different-purpose artifact — backups, audit/security
   logs, forensic evidence, incident records, or similar — even if it's the only duration mentioned;
   those are a different fact for a different purpose and must return null instead. Normalize to a
   whole number of days (e.g. "3 months" -> 90, "1 year" -> 365, "18 months" -> 548).
2. breach_notification_window — the timeframe committed for notifying affected individuals, customers,
   or a regulator after discovering a data breach or security incident. Do NOT extract an internal
   escalation, containment, investigation, or evidence-preservation deadline — only an external
   notification commitment counts. Normalize to a whole number of hours (e.g. "72 hours" -> 72,
   "3 days" -> 72, "30 days" -> 720). If phrased with no specific figure ("without undue delay",
   "promptly"), return null.
3. dpo_contact — ONLY if a specific email address is given as the privacy/data-protection contact.
   Do not extract a vague role reference ("the DPO", "our privacy team") with no email attached.

Respond with ONLY raw JSON, no markdown fences, no prose before or after. Exact shape:
{"retention_period":{"raw":"<exact quoted phrase>","days":90},
 "breach_notification_window":{"raw":"<exact quoted phrase>","hours":72},
 "dpo_contact":{"raw":"<exact quoted phrase>","email":"privacy@company.com"}}
Use null (not the object) for any fact that isn't clearly and singularly stated.`;

const FACT_DEFS = [
  { key: 'retention_period', label: 'Data retention period', valueField: 'days', min: 0, max: 36500, format: (v) => `${v} day${v === 1 ? '' : 's'}` },
  { key: 'breach_notification_window', label: 'Breach/incident notification window', valueField: 'hours', min: 0, max: 8760, format: (v) => `${v} hour${v === 1 ? '' : 's'}` },
  { key: 'dpo_contact', label: 'Privacy / DPO contact email', valueField: 'email', format: (v) => v },
];

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeFact(raw, def) {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw[def.valueField];
  if (def.valueField === 'email') {
    if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) return null;
    return { raw: String(raw.raw || '').slice(0, 300), email: value.trim().toLowerCase() };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < def.min || value > def.max) return null;
  return { raw: String(raw.raw || '').slice(0, 300), [def.valueField]: Math.round(value) };
}

function sanitizeFacts(contentMd) {
  let parsed;
  try {
    parsed = extractJson(contentMd);
  } catch {
    // A single document's extraction failing shouldn't sink the whole check — treat as "no facts found".
    return {};
  }
  const facts = {};
  for (const def of FACT_DEFS) {
    facts[def.key] = sanitizeFact(parsed[def.key], def);
  }
  return facts;
}

async function extractDocumentFacts({ document, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });

  const text = (document.content_md || '').trim();
  if (!text) return {};
  const truncated = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n[...truncated...]` : text;

  const userPrompt = `Document title: ${document.title}

--- content ---
${truncated}
--- end of content ---

Task: extract the JSON object as specified.`;

  // The output here is a small fixed JSON object, not a document — capping maxTokens keeps
  // Groq's per-minute token budget (which reserves against the requested max, not actual usage)
  // from being blown by a handful of extraction calls the way the default 8000 would.
  const { contentMd } = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 400 });
  return sanitizeFacts(contentMd);
}

// Pure and deterministic: given already-extracted facts, decide which slots disagree.
function compareFacts(entries) {
  const findings = [];
  for (const def of FACT_DEFS) {
    const present = entries
      .map((e) => ({ id: e.id, title: e.title, fact: e.facts[def.key] }))
      .filter((e) => e.fact != null);
    const distinctValues = new Set(present.map((e) => e.fact[def.valueField]));
    if (present.length >= 2 && distinctValues.size > 1) {
      findings.push({
        factKey: def.key,
        label: def.label,
        documents: present.map((e) => ({
          id: e.id, title: e.title, raw: e.fact.raw, value: def.format(e.fact[def.valueField]),
        })),
      });
    }
  }
  return findings;
}

async function checkConsistency({ documents, provider }) {
  const candidates = documents.filter((d) => d.content_md && d.content_md.trim());
  // Sequential, not Promise.all: firing every document's extraction at once reliably blows
  // through the cloud provider's per-minute token limit once a company has more than a
  // handful of documents — exactly the case this feature exists for.
  const entries = [];
  for (const d of candidates) {
    entries.push({ id: d.id, title: d.title, facts: await extractDocumentFacts({ document: d, provider }) });
  }
  return { findings: compareFacts(entries), checkedCount: entries.length };
}

module.exports = { checkConsistency, compareFacts, extractDocumentFacts, FACT_DEFS };
