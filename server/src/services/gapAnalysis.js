const pool = require('../db/pool');
const { GAP_CHECKLIST } = require('../templates/gapChecklist');
const { computeCrossFrameworkHints } = require('../templates/controlMapping');

function isSatisfied(check, ctx) {
  if (check.type === 'document') {
    return ctx.readyDocs.has(`${check.framework}:${check.docType}`);
  }
  if (check.type === 'vendors') {
    return ctx.vendorCount > 0;
  }
  return false; // 'unavailable' — an honest gap, not something we can check yet
}

function actionKeyFor(check) {
  if (check.type === 'document') return `document:${check.framework}:${check.docType}`;
  if (check.type === 'vendors') return 'vendors';
  return null; // unavailable items aren't actionable, so they can't be "next best actions"
}

function computeNextActions(frameworks, checklistByKey) {
  const actions = new Map();

  for (const fw of frameworks) {
    const def = checklistByKey[fw.key];
    fw.items.forEach((item, idx) => {
      if (item.satisfied || !item.automatable) return;
      const check = def.items[idx].check;
      const actionKey = actionKeyFor(check);
      if (!actionKey) return;

      const scoreIfDone = Math.round(((fw.satisfiedCount + 1) / fw.totalCount) * 100);
      const entry = actions.get(actionKey) || {
        actionType: check.type,
        label: item.label,
        framework: check.framework,
        docType: check.docType,
        affects: [],
      };
      entry.affects.push({ frameworkKey: fw.key, frameworkLabel: fw.label, from: fw.score, to: scoreIfDone });
      actions.set(actionKey, entry);
    });
  }

  return Array.from(actions.values())
    .map((a) => ({ ...a, totalLift: a.affects.reduce((sum, x) => sum + (x.to - x.from), 0) }))
    .sort((a, b) => b.totalLift - a.totalLift)
    .slice(0, 3);
}

async function computeGapAnalysis(companyId) {
  const [{ rows: docs }, { rows: vendorRows }] = await Promise.all([
    pool.query(`SELECT framework, doc_type FROM documents WHERE company_id = $1 AND status = 'ready'`, [companyId]),
    pool.query(`SELECT risk_tier FROM vendors WHERE company_id = $1`, [companyId]),
  ]);

  const ctx = {
    readyDocs: new Set(docs.map((d) => `${d.framework}:${d.doc_type}`)),
    vendorCount: vendorRows.length,
  };

  const frameworks = Object.entries(GAP_CHECKLIST).map(([key, def]) => {
    const items = def.items.map((item) => ({
      key: item.key,
      label: item.label,
      satisfied: isSatisfied(item.check, ctx),
      automatable: item.check.type !== 'unavailable',
    }));
    const satisfiedCount = items.filter((i) => i.satisfied).length;
    return {
      key,
      label: def.label,
      score: Math.round((satisfiedCount / items.length) * 100),
      satisfiedCount,
      totalCount: items.length,
      items,
    };
  });

  const checklistByKey = GAP_CHECKLIST;
  const nextActions = computeNextActions(frameworks, checklistByKey);
  const crossFrameworkHints = computeCrossFrameworkHints(frameworks);

  const openRisks = vendorRows.filter((v) => v.risk_tier === 'critical' || v.risk_tier === 'high').length;

  return {
    frameworks, nextActions, crossFrameworkHints, openRisks,
    documentsReady: docs.length, vendorCount: ctx.vendorCount,
  };
}

module.exports = { computeGapAnalysis };
