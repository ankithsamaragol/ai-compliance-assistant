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
  cmmc: {
    label: 'CMMC / NIST 800-171',
    items: [
      { key: 'ssp', label: 'System Security Plan (SSP)', check: { type: 'document', framework: 'cmmc', docType: 'system_security_plan' } },
      { key: 'poam', label: 'Plan of Action & Milestones (POA&M)', check: { type: 'document', framework: 'cmmc', docType: 'poam' } },
      { key: 'ir_plan', label: 'CMMC Incident Response Plan (72hr DFARS)', check: { type: 'document', framework: 'cmmc', docType: 'incident_response_plan_cmmc' } },
      { key: 'vendor_register', label: 'Subcontractor / Vendor Flow-Down Register', check: { type: 'vendors' } },
      { key: 'config_baseline', label: 'Configuration Management Baseline', check: { type: 'unavailable' } },
      { key: 'access_evidence', label: 'Access Control Implementation Evidence', check: { type: 'unavailable' } },
      { key: 'security_training', label: 'Security Awareness Training Records', check: { type: 'unavailable' } },
    ],
  },
  iso42001: {
    label: 'ISO 42001 / AI Governance',
    items: [
      { key: 'aims_policy', label: 'AI Management System Policy', check: { type: 'document', framework: 'iso42001', docType: 'ai_management_system_policy' } },
      { key: 'ai_risk_assessment', label: 'AI Risk & Impact Assessment', check: { type: 'document', framework: 'iso42001', docType: 'ai_risk_assessment' } },
      { key: 'eu_ai_act', label: 'EU AI Act Readiness Statement', check: { type: 'document', framework: 'iso42001', docType: 'eu_ai_act_readiness' } },
      { key: 'vendor_register', label: 'Third-Party AI/Foundation Model Register', check: { type: 'vendors' } },
      { key: 'bias_testing', label: 'Bias/Fairness Testing Evidence', check: { type: 'unavailable' } },
      { key: 'human_oversight_log', label: 'Human Oversight Checkpoint Log', check: { type: 'unavailable' } },
      { key: 'model_monitoring', label: 'Post-Deployment Model Monitoring Records', check: { type: 'unavailable' } },
    ],
  },
};

module.exports = { GAP_CHECKLIST };
