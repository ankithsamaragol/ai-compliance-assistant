// Defines what "compliance readiness" means per framework: a mix of items we can
// verify automatically (a ready document exists, the vendor register is populated)
// and items we honestly can't automate yet (shown as gaps, not silently skipped).
// This is the target checklist gap analysis is scored against.

const GAP_CHECKLIST = {
  iso27001: {
    label: 'ISO 27001',
    items: [
      { key: 'iso_policy', label: 'Information Security Policy', check: { type: 'document', framework: 'iso27001', docType: 'information_security_policy' } },
      { key: 'access_control', label: 'Access Control Policy', check: { type: 'document', framework: 'iso27001', docType: 'access_control_policy' } },
      { key: 'incident_response', label: 'Incident Response Plan', check: { type: 'document', framework: 'iso27001', docType: 'incident_response_plan' } },
      { key: 'risk_register_doc', label: 'Information Security Risk Register', check: { type: 'document', framework: 'risk_assessment', docType: 'risk_register' } },
      { key: 'vendor_policy', label: 'Vendor Risk Assessment Policy', check: { type: 'document', framework: 'risk_assessment', docType: 'vendor_risk_assessment' } },
      { key: 'vendor_register', label: 'Vendor Risk Register (structured)', check: { type: 'vendors' } },
      { key: 'audit_evidence', label: 'Audit Evidence Checklist', check: { type: 'document', framework: 'audit_evidence', docType: 'evidence_checklist' } },
      { key: 'asset_register', label: 'Asset Register', check: { type: 'unavailable' } },
      { key: 'security_training', label: 'Security Awareness Training Records', check: { type: 'unavailable' } },
      { key: 'backup_recovery', label: 'Backup & Disaster Recovery Procedure', check: { type: 'unavailable' } },
    ],
  },
  gdpr: {
    label: 'GDPR',
    items: [
      { key: 'privacy_policy', label: 'Privacy Policy', check: { type: 'document', framework: 'gdpr', docType: 'privacy_policy' } },
      { key: 'dpa', label: 'Data Processing Agreement', check: { type: 'document', framework: 'gdpr', docType: 'data_processing_agreement' } },
      { key: 'ropa', label: 'Record of Processing Activities (ROPA)', check: { type: 'document', framework: 'gdpr', docType: 'ropa' } },
      { key: 'vendor_register', label: 'Sub-processor / Vendor Register', check: { type: 'vendors' } },
      { key: 'breach_procedure', label: 'Data Breach Notification Procedure', check: { type: 'unavailable' } },
      { key: 'dpia', label: 'Data Protection Impact Assessment (DPIA)', check: { type: 'unavailable' } },
    ],
  },
};

module.exports = { GAP_CHECKLIST };
