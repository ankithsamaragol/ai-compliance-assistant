const { getDocTypeDef } = require('../templates/catalog');
const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const SYSTEM_PROMPT = `You are a compliance documentation assistant that drafts ISO 27001, GDPR, risk
assessment, and audit evidence documents for small businesses, startups, and manufacturers.

Rules:
- Output well-structured GitHub-flavored Markdown only. No preamble, no "Here is your document" framing.
- Tailor content to the specific company profile provided — do not write generic filler.
- Never invent specific unverifiable facts (names, dates, certificate numbers, exact tool versions) that
  are not in the company profile.
- Never use bracketed placeholders like "[CONFIRM: ...]", "[TBD]", "[INSERT ...]", or similar in the
  output — these look broken to a reader. Instead, when a specific detail isn't in the company profile,
  phrase the sentence generically so it reads naturally without it. Example: write "the designated
  compliance contact" instead of "[CONFIRM: contact email]"; write "reviewed on a regular cadence"
  instead of inventing or placeholder-ing a specific date.
- Begin the document with a level-1 markdown heading containing the document title.
- End every document with this exact line on its own: "> This document was AI-generated and must be reviewed by a qualified compliance professional or legal counsel before use."`;

const PLACEHOLDER_PATTERN = /\[(CONFIRM|TBD|INSERT|FILL IN|PLACEHOLDER)[^\]]*\]/i;

function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    key, label: p.label, local: p.local, dataNotice: p.dataNotice,
  }));
}

async function generateDocument({ company, framework, docType, provider }) {
  const def = getDocTypeDef(framework, docType);
  if (!def) {
    throw Object.assign(new Error(`Unknown framework/docType: ${framework}/${docType}`), { status: 400 });
  }

  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) {
    throw Object.assign(new Error(`Unknown provider: ${providerKey}. Valid options: ${Object.keys(PROVIDERS).join(', ')}`), { status: 400 });
  }

  const userPrompt = `${companyProfileBlock(company)}

Task: Draft the "${def.title}" document for the ${def.framework} framework.

${def.instructions}`;

  let { contentMd, model } = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt });

  if (PLACEHOLDER_PATTERN.test(contentMd)) {
    const retryPrompt = `${userPrompt}

Your previous draft contained a bracketed placeholder (like "[CONFIRM: ...]"), which is not allowed.
Rewrite the document so no bracketed placeholders appear anywhere — rephrase those spots generically
instead, per the system rules.`;
    const retry = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt: retryPrompt });
    contentMd = retry.contentMd;
    model = retry.model;
  }

  return { title: def.title, contentMd, model, provider: providerKey };
}

module.exports = { generateDocument, listProviders };
