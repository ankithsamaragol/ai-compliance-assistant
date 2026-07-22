const { companyProfileBlock } = require('./companyProfile');
const groq = require('./providers/groq');
const ollama = require('./providers/ollama');

const PROVIDERS = { groq, ollama };
const DEFAULT_PROVIDER = process.env.DEFAULT_GENERATION_PROVIDER || 'groq';

const SYSTEM_PROMPT = `You are writing a concise Executive Compliance Summary for company leadership.
Use only the real data provided below — never invent scores, risks, or activity not present in it.

Structure the document as:
1. A level-1 heading with the company name and "Executive Compliance Summary"
2. A 2-4 sentence headline paragraph in plain language summarizing overall compliance posture,
   citing the actual scores and risk counts given
3. "## Framework Readiness" — a markdown table: Framework, Score, Requirements Met
4. "## Top Risks" — list the critical/high risk vendors given, with their reasoning; if none exist,
   state plainly that no critical or high risk vendors are currently on file rather than inventing any
5. "## Recommended Next Steps" — list the next-best-actions given, with their score impact
6. "## Recent Activity" — list the recent documents given, with framework and date

Never use bracketed placeholders. Where a section has no data (e.g. no recent activity), say so
plainly rather than fabricating content.
End with this exact line on its own: "> This report was AI-generated from data on file and should be reviewed before circulating."`;

function gapBlock(gapAnalysis) {
  const parts = gapAnalysis.frameworks.map((fw) => `- ${fw.label}: ${fw.score}% (${fw.satisfiedCount}/${fw.totalCount} requirements met)`);
  return `Framework readiness:\n${parts.join('\n')}`;
}

function topRisksBlock(vendors) {
  const top = vendors.filter((v) => v.risk_tier === 'critical' || v.risk_tier === 'high');
  if (!top.length) return 'Top risks: no critical or high risk vendors currently on file.';
  const rows = top.map((v) => `- ${v.name} (${v.risk_tier}): ${v.reasoning || 'no reasoning recorded'}`);
  return `Top risks (critical/high vendors):\n${rows.join('\n')}`;
}

function nextActionsBlock(nextActions) {
  if (!nextActions.length) return 'Recommended next steps: none — all automatable checklist items are complete.';
  const rows = nextActions.map((a) => {
    const affects = a.affects.map((x) => `${x.frameworkLabel} ${x.from}%→${x.to}%`).join(', ');
    return `- ${a.label}: ${affects}`;
  });
  return `Recommended next steps (ranked by combined score impact):\n${rows.join('\n')}`;
}

function recentActivityBlock(documents) {
  if (!documents.length) return 'Recent activity: no documents generated yet.';
  const rows = documents.map((d) => `- ${d.title} (${d.framework}, ${d.status}) — ${new Date(d.created_at).toISOString().slice(0, 10)}`);
  return `Recent activity (most recent documents):\n${rows.join('\n')}`;
}

async function generateExecutiveReport({ company, gapAnalysis, vendors, recentDocuments, provider }) {
  const providerKey = provider || DEFAULT_PROVIDER;
  const impl = PROVIDERS[providerKey];
  if (!impl) {
    throw Object.assign(new Error(`Unknown provider: ${providerKey}`), { status: 400 });
  }

  const userPrompt = `${companyProfileBlock(company)}

${gapBlock(gapAnalysis)}
Open risks (critical/high vendors): ${gapAnalysis.openRisks}
Documents ready: ${gapAnalysis.documentsReady}
Vendors tracked: ${gapAnalysis.vendorCount}

${topRisksBlock(vendors)}

${nextActionsBlock(gapAnalysis.nextActions)}

${recentActivityBlock(recentDocuments)}

Task: Write the Executive Compliance Summary per the system instructions, using only this data.`;

  const { contentMd, model } = await impl.run({ systemPrompt: SYSTEM_PROMPT, userPrompt });
  return { contentMd, model, provider: providerKey };
}

module.exports = { generateExecutiveReport };
