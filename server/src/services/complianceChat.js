const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';
const MAX_HISTORY_MESSAGES = 10;

function vendorBlock(vendors) {
  if (!vendors.length) return 'Vendor Risk Register: empty — no vendors detected or added yet.';
  const rows = vendors.map((v) => `- ${v.name} (${v.category}, ${v.risk_tier} risk): ${v.reasoning || 'no reasoning recorded'}. Review: ${v.review_frequency || 'not set'}.`);
  return `Vendor Risk Register:\n${rows.join('\n')}`;
}

function gapBlock(gapAnalysis) {
  const parts = gapAnalysis.frameworks.map((fw) => {
    const missing = fw.items.filter((i) => !i.satisfied).map((i) => i.label);
    return `- ${fw.label}: ${fw.score}% (${fw.satisfiedCount}/${fw.totalCount}). Missing: ${missing.length ? missing.join(', ') : 'nothing'}.`;
  });
  return `Compliance Gap Analysis:\n${parts.join('\n')}\nOpen risks (critical/high vendors): ${gapAnalysis.openRisks}`;
}

function documentsBlock(documents) {
  if (!documents.length) return 'Documents on file: none generated yet.';
  const rows = documents.map((d) => `- ${d.title} (${d.framework}, status: ${d.status})`);
  return `Documents on file (titles/status only — full text is not loaded into this chat; if asked about
specific document wording, say the user should open the document to check rather than guessing):\n${rows.join('\n')}`;
}

function buildSystemPrompt({ company, vendors, gapAnalysis, documents }) {
  return `You are an AI compliance assistant answering questions about a specific company's compliance
posture. Answer only based on the real data provided below — if a question can't be answered from this
data (e.g. it asks about exact document wording, or requires external legal research), say so plainly
instead of guessing or inventing an answer. Be concise and direct.

${companyProfileBlock(company)}

${vendorBlock(vendors)}

${gapBlock(gapAnalysis)}

${documentsBlock(documents)}`;
}

async function askQuestion({ company, vendors, gapAnalysis, documents, history, question, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) {
    throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });
  }

  const systemPrompt = buildSystemPrompt({ company, vendors, gapAnalysis, documents });
  const trimmedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content }));

  const { contentMd, model } = await impl.run({ systemPrompt, userPrompt: question, history: trimmedHistory });
  return { answer: contentMd, model, provider: providerKey };
}

module.exports = { askQuestion };
