// Pure function, deliberately separated from the DB call site so it's unit-testable: given the
// company row before and after an update, decide which changes are compliance-relevant enough to
// flag. Only additions are flagged (a removed tool/vendor isn't a new gap to close), and only the
// specific fields that feed real checks elsewhere in the app — this mirrors the honesty rule used
// everywhere else: flag real signal, never a vague "something changed" notice.
function detectProfileChanges(before, after) {
  const alerts = [];

  const addedTo = (oldArr, newArr) => {
    const oldSet = new Set(oldArr || []);
    return (newArr || []).filter((item) => !oldSet.has(item));
  };

  const newCloud = addedTo(before.cloud_providers, after.cloud_providers);
  const newTools = addedTo(before.tools_used, after.tools_used);
  if (newCloud.length || newTools.length) {
    const items = [...newCloud, ...newTools];
    alerts.push({
      message: `Added ${items.join(', ')} to the company profile — the vendor register may not cover ${items.length === 1 ? 'it' : 'them'} yet.`,
      suggested_action: 'vendors',
    });
  }

  const newAiSystems = addedTo(before.ai_systems_used, after.ai_systems_used);
  if (newAiSystems.length) {
    alerts.push({
      message: `Added "${newAiSystems.join(', ')}" to AI systems used — ISO 42001 / AI governance documents may need review.`,
      suggested_action: 'documents',
    });
  }

  const newDataTypes = addedTo(before.data_types, after.data_types);
  const piiChanged = Boolean(before.processes_pii) !== Boolean(after.processes_pii);
  const euChanged = Boolean(before.processes_eu_data) !== Boolean(after.processes_eu_data);
  if (newDataTypes.length || piiChanged || euChanged) {
    const parts = [];
    if (newDataTypes.length) parts.push(`new data types: ${newDataTypes.join(', ')}`);
    if (piiChanged) parts.push(`PII processing now ${after.processes_pii ? 'yes' : 'no'}`);
    if (euChanged) parts.push(`EU data processing now ${after.processes_eu_data ? 'yes' : 'no'}`);
    alerts.push({
      message: `Data handling details changed (${parts.join('; ')}) — GDPR documents may be out of date.`,
      suggested_action: 'documents',
    });
  }

  return alerts;
}

module.exports = { detectProfileChanges };
