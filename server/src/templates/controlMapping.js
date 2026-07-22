// Curated, honest cross-framework control overlaps — deliberately small and defensible rather
// than an exhaustive auto-generated matrix. Each entry is a real overlap we can explain in one
// sentence, not a claim that one document satisfies another framework's requirement (it doesn't —
// gap analysis scoring never uses this data, it's purely informational to reduce duplicate work).

const CONTROL_MAPPINGS = [
  {
    a: { framework: 'iso27001', item: 'access_control' },
    b: { framework: 'cmmc', item: 'ssp' },
    overlap: 'high',
    note: 'Your Access Control Policy covers much of what CMMC’s SSP needs for its Access Control domain — reuse that content rather than starting from scratch.',
  },
  {
    a: { framework: 'iso27001', item: 'access_control' },
    b: { framework: 'cmmc', item: 'access_evidence' },
    overlap: 'partial',
    note: 'Your Access Control Policy documents the procedures — CMMC additionally wants evidence the procedures are actually followed (access logs, review records), which the policy alone doesn’t provide.',
  },
  {
    a: { framework: 'iso27001', item: 'incident_response' },
    b: { framework: 'cmmc', item: 'ir_plan' },
    overlap: 'partial',
    note: 'Core incident classification and escalation content carries over, but CMMC requires the additional DFARS 252.204-7012 72-hour DoD/DIBNet reporting clause your ISO plan won’t have.',
  },
  {
    a: { framework: 'iso27001', item: 'risk_register_doc' },
    b: { framework: 'iso42001', item: 'ai_risk_assessment' },
    overlap: 'partial',
    note: 'Your general risk scoring methodology (likelihood × impact) carries over, but AI systems need EU AI Act-specific risk tiers (provider/deployer role, unacceptable/high/limited/minimal) your general risk register doesn’t assign.',
  },
  {
    a: { framework: 'iso27001', item: 'security_training' },
    b: { framework: 'cmmc', item: 'security_training' },
    overlap: 'shared_gap',
    note: 'This is the same underlying requirement in both frameworks — one training program and one set of records closes the gap in both.',
  },
];

function computeCrossFrameworkHints(frameworks) {
  const byKey = Object.fromEntries(frameworks.map((fw) => [fw.key, fw]));
  const itemStatus = (frameworkKey, itemKey) => {
    const fw = byKey[frameworkKey];
    const item = fw?.items.find((i) => i.key === itemKey);
    return item ? { satisfied: item.satisfied, label: item.label, frameworkLabel: fw.label } : null;
  };

  const hints = [];
  for (const mapping of CONTROL_MAPPINGS) {
    const a = itemStatus(mapping.a.framework, mapping.a.item);
    const b = itemStatus(mapping.b.framework, mapping.b.item);
    if (!a || !b) continue;

    if (mapping.overlap === 'shared_gap') {
      if (!a.satisfied && !b.satisfied) {
        hints.push({
          type: 'shared_gap',
          note: mapping.note,
          items: [{ label: a.label, frameworkLabel: a.frameworkLabel }, { label: b.label, frameworkLabel: b.frameworkLabel }],
        });
      }
      continue;
    }

    if (a.satisfied && !b.satisfied) {
      hints.push({
        type: 'reuse', overlap: mapping.overlap, note: mapping.note,
        have: { label: a.label, frameworkLabel: a.frameworkLabel },
        towards: { label: b.label, frameworkLabel: b.frameworkLabel },
      });
    } else if (b.satisfied && !a.satisfied) {
      hints.push({
        type: 'reuse', overlap: mapping.overlap, note: mapping.note,
        have: { label: b.label, frameworkLabel: b.frameworkLabel },
        towards: { label: a.label, frameworkLabel: a.frameworkLabel },
      });
    }
  }
  return hints;
}

module.exports = { CONTROL_MAPPINGS, computeCrossFrameworkHints };
