const pool = require('../db/pool');
const { GAP_CHECKLIST } = require('../templates/gapChecklist');

function isSatisfied(check, ctx) {
  if (check.type === 'document') {
    return ctx.readyDocs.has(`${check.framework}:${check.docType}`);
  }
  if (check.type === 'vendors') {
    return ctx.vendorCount > 0;
  }
  return false; // 'unavailable' — an honest gap, not something we can check yet
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

  const openRisks = vendorRows.filter((v) => v.risk_tier === 'critical' || v.risk_tier === 'high').length;

  return { frameworks, openRisks, documentsReady: docs.length, vendorCount: ctx.vendorCount };
}

module.exports = { computeGapAnalysis };
