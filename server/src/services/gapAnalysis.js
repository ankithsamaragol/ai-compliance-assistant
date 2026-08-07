const pool = require('../db/pool');
const { GAP_CHECKLIST } = require('../templates/gapChecklist');
const { computeCrossFrameworkHints } = require('../templates/controlMapping');

function isSatisfied(check, itemKey, frameworkKey, ctx) {
  // Simulation override: "what if this item were done" always wins, regardless of real data —
  // this is the entire mechanism the simulator needs, no separate scoring path required.
  if (ctx.simulateKeys?.has(`${frameworkKey}:${itemKey}`)) return true;
  if (check.type === 'document') {
    return ctx.readyDocs.has(`${check.framework}:${check.docType}`);
  }
  if (check.type === 'vendors') {
    return ctx.vendorCount > 0;
  }
  if (check.type === 'evidence') {
    return ctx.evidenceKeys.has(`${frameworkKey}:${itemKey}`);
  }
  return false; // 'unavailable' — an honest gap, not something we can check yet
}

// How much real-world work an action takes, not how much it's worth — kept separate from impact
// so ranking can weigh both instead of only chasing the biggest point number. Deterministic from
// the checklist item's own check type, not a guess: 'document' and 'vendors' resolve with one
// click (AI drafts the document / detects vendors from the profile already on file); 'evidence'
// requires the user to actually go produce or locate a real file first — there's no button that
// makes training records or backup logs exist.
const EFFORT = {
  document: { weight: 1, label: 'Quick — AI-generated' },
  vendors: { weight: 1, label: 'Quick — AI-detected from your profile' },
  evidence: { weight: 3, label: 'Needs a real file you locate and upload' },
};

function actionKeyFor(check, frameworkKey, itemKey) {
  if (check.type === 'document') return `document:${check.framework}:${check.docType}`;
  if (check.type === 'vendors') return 'vendors';
  if (check.type === 'evidence') return `evidence:${frameworkKey}:${itemKey}`;
  return null; // 'unavailable' items aren't actionable, so they can't be "next best actions"
}

function computeNextActions(frameworks, checklistByKey) {
  const actions = new Map();

  for (const fw of frameworks) {
    const def = checklistByKey[fw.key];
    fw.items.forEach((item, idx) => {
      if (item.satisfied || !item.automatable) return;
      const check = def.items[idx].check;
      const actionKey = actionKeyFor(check, fw.key, item.key);
      if (!actionKey) return;

      const scoreIfDone = Math.round(((fw.satisfiedCount + 1) / fw.totalCount) * 100);
      const entry = actions.get(actionKey) || {
        key: actionKey,
        actionType: check.type,
        label: item.label,
        why: item.why,
        framework: check.framework,
        docType: check.docType,
        effort: EFFORT[check.type],
        affects: [],
      };
      entry.affects.push({ frameworkKey: fw.key, frameworkLabel: fw.label, from: fw.score, to: scoreIfDone });
      actions.set(actionKey, entry);
    });
  }

  // Ranked by impact per unit of effort, not raw impact — a quick +15pt document should usually
  // beat a +17pt item that needs real evidence produced first, but a high-effort item still wins
  // when it's genuinely the best (or only) option left. totalLift alone breaks ties, and stays in
  // the response so the UI can show the raw number alongside the effort label rather than hiding it.
  return Array.from(actions.values())
    .map((a) => ({ ...a, totalLift: a.affects.reduce((sum, x) => sum + (x.to - x.from), 0) }))
    .sort((a, b) => (b.totalLift / b.effort.weight) - (a.totalLift / a.effort.weight) || b.totalLift - a.totalLift)
    .slice(0, 3);
}

// Pure scoring over an already-fetched context — separated from the DB reads specifically so the
// simulator can score the same real data twice (once as-is, once with a hypothetical override)
// without a second round trip to the database.
function scoreFromCtx(ctx) {
  const frameworks = Object.entries(GAP_CHECKLIST).map(([fwKey, def]) => {
    const items = def.items.map((item) => ({
      key: item.key,
      label: item.label,
      why: item.why,
      risk: item.risk,
      satisfied: isSatisfied(item.check, item.key, fwKey, ctx),
      automatable: item.check.type !== 'unavailable',
    }));
    const satisfiedCount = items.filter((i) => i.satisfied).length;
    return {
      key: fwKey,
      label: def.label,
      score: Math.round((satisfiedCount / items.length) * 100),
      satisfiedCount,
      totalCount: items.length,
      items,
    };
  });

  const nextActions = computeNextActions(frameworks, GAP_CHECKLIST);
  const crossFrameworkHints = computeCrossFrameworkHints(frameworks);
  const overallScore = frameworks.length
    ? Math.round(frameworks.reduce((sum, f) => sum + f.score, 0) / frameworks.length)
    : 0;

  return { frameworks, nextActions, crossFrameworkHints, overallScore };
}

async function fetchGapContext(companyId) {
  const [{ rows: docs }, { rows: vendorRows }, { rows: evidenceRows }] = await Promise.all([
    pool.query(`SELECT framework, doc_type FROM documents WHERE company_id = $1 AND status = 'ready' AND framework != 'executive_report'`, [companyId]),
    pool.query(`SELECT risk_tier FROM vendors WHERE company_id = $1`, [companyId]),
    pool.query(`SELECT mapped_controls FROM evidence WHERE company_id = $1 AND status = 'analyzed'`, [companyId]),
  ]);

  // Only high/medium-confidence AI mappings close a gap — a low-confidence guess shouldn't
  // silently inflate the score. Low-confidence matches still show up in the evidence list.
  const evidenceKeys = new Set();
  for (const row of evidenceRows) {
    for (const m of row.mapped_controls || []) {
      if (m.confidence === 'high' || m.confidence === 'medium') evidenceKeys.add(`${m.framework}:${m.key}`);
    }
  }

  return {
    readyDocs: new Set(docs.map((d) => `${d.framework}:${d.doc_type}`)),
    vendorCount: vendorRows.length,
    evidenceKeys,
    docs, vendorRows, evidenceRows,
  };
}

async function computeGapAnalysis(companyId) {
  const ctx = await fetchGapContext(companyId);
  const scored = scoreFromCtx(ctx);
  const openRisks = ctx.vendorRows.filter((v) => v.risk_tier === 'critical' || v.risk_tier === 'high').length;

  return {
    ...scored, openRisks,
    documentsReady: ctx.docs.length, vendorCount: ctx.vendorCount, evidenceCount: ctx.evidenceRows.length,
  };
}

// "What if these items were already done?" — baseline and simulated scores from the exact same
// fetched data, differing only by which keys are forced satisfied. No document is generated, no
// vendor added, nothing is persisted; it's purely a projection over the real current state.
async function simulateGapAnalysis(companyId, itemKeys) {
  const ctx = await fetchGapContext(companyId);
  const baseline = scoreFromCtx(ctx);
  const simulated = scoreFromCtx({ ...ctx, simulateKeys: new Set(itemKeys) });

  return {
    baseline: { overallScore: baseline.overallScore, frameworks: baseline.frameworks.map(({ key, label, score }) => ({ key, label, score })) },
    simulated: { overallScore: simulated.overallScore, frameworks: simulated.frameworks.map(({ key, label, score }) => ({ key, label, score })) },
  };
}

module.exports = { computeGapAnalysis, simulateGapAnalysis };
