const { getDocTypeDef } = require('../templates/catalog');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const SYSTEM_PROMPT = `You are a compliance documentation assistant that drafts ISO 27001, GDPR, risk
assessment, and audit evidence documents for small businesses, startups, and manufacturers.

Rules:
- Output well-structured GitHub-flavored Markdown only. No preamble, no "Here is your document" framing.
- Tailor content to the specific company profile provided — do not write generic filler.
- Where you must assume a fact not given in the profile, state the assumption inline as "[CONFIRM: ...]"
  rather than inventing unverifiable specifics (names, dates, certificate numbers, exact tool versions).
- Begin the document with a level-1 markdown heading containing the document title.
- End every document with this exact line on its own: "> This document was AI-generated and must be reviewed by a qualified compliance professional or legal counsel before use."`;

function companyProfileBlock(company) {
  return `Company profile:
- Name: ${company.name}
- Industry: ${company.industry}
- Size: ${company.size_band} employees
- Country: ${company.country}
- Processes personal data (PII): ${company.processes_pii ? 'yes' : 'no'}
- Processes EU resident data: ${company.processes_eu_data ? 'yes' : 'no'}
- Data types handled: ${(company.data_types || []).join(', ') || 'not specified'}
- Cloud providers: ${(company.cloud_providers || []).join(', ') || 'not specified'}
- Additional notes: ${company.notes || 'none'}`;
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({ key, label: p.label }));
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

  const { contentMd, model } = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt });

  return { title: def.title, contentMd, model, provider: providerKey };
}

module.exports = { generateDocument, listProviders };
