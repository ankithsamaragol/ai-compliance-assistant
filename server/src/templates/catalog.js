// Framework + document-type catalog. Each entry describes what gets generated
// and provides the task-specific instructions injected into the prompt.

const CATALOG = {
  iso27001: {
    label: 'ISO 27001',
    docTypes: {
      information_security_policy: {
        title: 'Information Security Policy',
        instructions: `Write a comprehensive, master Information Security Policy aligned with ISO/IEC 27001:2022 clause 5.2.
This is the umbrella policy a real ISO 27001 auditor expects to see — it should read as a substantial,
multi-page policy document (target 2,500-4,000 words), not an executive summary. Use numbered sections
with real, specific, actionable content in each — not one-line placeholders.

Required sections, each with genuine substance:
1. Purpose and Scope
2. Management Commitment
3. Information Security Objectives
4. Roles and Responsibilities (Information Security Officer, department heads, all employees)
5. Password and Authentication Requirements (minimum length/complexity, rotation policy, MFA requirements
   for all systems handling sensitive data, prohibition on shared/reused credentials)
6. Encryption Requirements (data at rest and in transit — specify TLS for transit, AES-256 or equivalent
   at rest, key management principles)
7. Asset Management (hardware/software inventory, asset ownership, classification of information assets
   by sensitivity, secure disposal/decommissioning)
8. Acceptable Use (permitted/prohibited use of company systems, personal device use, internet/email use,
   software installation restrictions)
9. Access Management (summary of least-privilege and provisioning principles — note that the detailed
   Access Control Policy is a separate, dedicated document covering this in full)
10. Physical Security (access to offices/data centers, visitor procedures, clear desk/clear screen policy,
    secure disposal of physical media)
11. Logging and Monitoring (what gets logged, log retention period, review cadence, alerting for
    anomalous activity)
12. Vendor and Third-Party Management (summary of due diligence and risk-tiering principles — note that
    detailed vendor risk assessment is tracked separately in the Vendor Risk Register/Assessment)
13. Backup Policy (backup frequency, retention, encryption of backups, restore testing cadence)
14. Incident Reporting (how employees report suspected incidents, escalation path — note that the
    detailed Incident Response Plan is a separate, dedicated document)
15. Business Continuity (high-level continuity/disaster recovery commitment and RTO/RPO philosophy)
16. Policy Review Cadence
17. Consequences of Non-Compliance

Where this company already has a dedicated Access Control Policy, Incident Response Plan, or Vendor Risk
Assessment generated separately, keep those sections here concise and cross-reference the dedicated
document by name rather than duplicating it in full — but every other section must have real, specific,
non-generic content tailored to this company's profile.`,
      },
      access_control_policy: {
        title: 'Access Control Policy',
        instructions: `Write an Access Control Policy mapped to ISO/IEC 27001:2022 Annex A control 5.15 (and related 5.16-5.18).
Cover: least-privilege principle, user access provisioning/de-provisioning, periodic access review,
privileged account management, password/authentication requirements, and remote access rules.`,
      },
      incident_response_plan: {
        title: 'Information Security Incident Response Plan',
        instructions: `Write an Incident Response Plan mapped to ISO/IEC 27001:2022 Annex A control 5.24-5.28.
Cover: incident classification/severity levels, roles (incident commander, comms lead),
detection and reporting channels, containment/eradication/recovery steps,
post-incident review, and a notification decision tree for regulators/customers.`,
      },
    },
  },

  gdpr: {
    label: 'GDPR',
    docTypes: {
      privacy_policy: {
        title: 'Privacy Policy',
        instructions: `Write a customer-facing Privacy Policy compliant with GDPR Articles 12-14.
Cover: what personal data is collected, legal basis for each processing purpose,
data retention periods, third-party/sub-processor disclosures, international transfer safeguards,
and how data subjects exercise their rights (access, erasure, portability, objection).
Write in plain, non-legalese language appropriate for a public-facing policy page.`,
      },
      data_processing_agreement: {
        title: 'Data Processing Agreement (DPA)',
        instructions: `Draft a Data Processing Agreement compliant with GDPR Article 28, for use between this company (as processor)
and its customers (as controllers), or between this company (as controller) and its sub-processors — infer the correct
direction from the company profile. Cover: subject matter and duration of processing, nature/purpose of processing,
categories of data subjects and personal data, controller/processor obligations, sub-processor authorization,
data subject request assistance, breach notification timelines, deletion/return of data on termination, and audit rights.`,
      },
      ropa: {
        title: 'Record of Processing Activities (ROPA)',
        instructions: `Produce a Record of Processing Activities (ROPA) per GDPR Article 30, formatted as a structured table
(render as a markdown table). Columns: Processing Activity, Purpose, Legal Basis, Data Categories, Data Subjects,
Recipients/Sub-processors, International Transfers, Retention Period, Security Measures.
Generate realistic rows based on the company's stated data types and processing context — note where information
is a placeholder the company must confirm (mark clearly as "[CONFIRM]").`,
      },
    },
  },

  risk_assessment: {
    label: 'Risk Assessment',
    docTypes: {
      risk_register: {
        title: 'Information Security Risk Register',
        instructions: `Produce a Risk Register as a markdown table with columns: Risk ID, Risk Description, Category
(e.g. technical, operational, third-party, compliance), Likelihood (1-5), Impact (1-5), Risk Score (Likelihood x Impact),
Existing Controls, Recommended Mitigation, Owner, Status. Generate 12-18 realistic risks tailored to the company's industry,
size, cloud providers, and data sensitivity. Sort by descending risk score.`,
      },
      vendor_risk_assessment: {
        title: 'Vendor / Third-Party Risk Assessment',
        instructions: `Write a Vendor Risk Assessment framework document. Cover: vendor risk tiering criteria (critical/high/medium/low
based on data access and business dependency), a due-diligence questionnaire (security certifications, data handling,
breach history, subprocessors, insurance), review frequency by tier, and an escalation/offboarding procedure.
Include a sample scoring rubric as a markdown table.`,
      },
    },
  },

  audit_evidence: {
    label: 'Audit Evidence',
    docTypes: {
      evidence_checklist: {
        title: 'Audit Evidence Checklist',
        instructions: `Produce an Audit Evidence Checklist mapped to the company's target framework(s) inferred from its profile
(ISO 27001 and/or GDPR). Format as a markdown table: Control/Requirement, Evidence Artifact Needed, Suggested Owner,
Collection Frequency (one-time/quarterly/annual), Status (placeholder "Not Started"). Cover access reviews, policy
acknowledgements, incident logs, training records, penetration test reports, backup test logs, and vendor assessments.`,
      },
      control_narrative: {
        title: 'Control Narrative Summary',
        instructions: `Write a Control Narrative Summary suitable for handing to an external auditor. For each of 8-10 key controls
(access management, change management, backup/recovery, encryption, logging/monitoring, incident response, vendor management,
employee onboarding/offboarding security), describe in 2-4 sentences how the control is implemented at this company,
inferring plausible implementation detail from the company profile and marking assumptions as "[CONFIRM]".`,
      },
    },
  },
};

function listFrameworks() {
  return Object.entries(CATALOG).map(([key, f]) => ({
    key,
    label: f.label,
    docTypes: Object.entries(f.docTypes).map(([dtKey, dt]) => ({ key: dtKey, title: dt.title })),
  }));
}

function getDocTypeDef(framework, docType) {
  const f = CATALOG[framework];
  if (!f) return null;
  const dt = f.docTypes[docType];
  if (!dt) return null;
  return { framework: f.label, ...dt };
}

module.exports = { CATALOG, listFrameworks, getDocTypeDef };
