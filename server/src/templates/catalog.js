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

  cmmc: {
    label: 'CMMC / NIST 800-171',
    docTypes: {
      system_security_plan: {
        title: 'System Security Plan (SSP)',
        instructions: `Write a System Security Plan (SSP) for CMMC Level 2 / NIST SP 800-171 Rev 3 compliance — the
cornerstone document every DoD supply-chain contractor needs. This should be a substantial document
(target 2,000-3,500 words) with real, specific content, not a checklist of headers.

Structure:
1. System Description and Boundary (what systems/environments process, store, or transmit Controlled
   Unclassified Information (CUI) — infer from the company's cloud providers, tools, and data types)
2. Roles and Responsibilities (System Owner, ISSO/security lead, general workforce)
For each of the 14 NIST SP 800-171 control families below, write a real paragraph describing how this
specific company implements it — tailored to their profile, not generic boilerplate:
3. Access Control — authentication, least privilege, session controls
4. Awareness and Training — security training cadence and content
5. Audit and Accountability — logging, log retention, review process
6. Configuration Management — baseline configs, change control
7. Identification and Authentication — MFA, credential management
8. Incident Response — note the dedicated CMMC Incident Response Plan is a separate document; summarize briefly
9. Maintenance — controlled maintenance of systems handling CUI
10. Media Protection — handling/disposal of media containing CUI
11. Personnel Security — screening, offboarding
12. Physical Protection — facility access controls
13. Risk Assessment — periodic risk assessment cadence (reference the Risk Register if one exists)
14. Security Assessment — self-assessment/monitoring cadence
15. System and Communications Protection — network segmentation, encryption in transit
16. System and Information Integrity — patching, malware protection, monitoring

Close with a note that this SSP addresses all 14 NIST SP 800-171 control families at a program level, and
that a detailed control-by-control implementation matrix (all 110 requirements) should be maintained
separately ahead of a formal C3PAO assessment.`,
      },
      poam: {
        title: 'Plan of Action & Milestones (POA&M)',
        instructions: `Produce a Plan of Action & Milestones (POA&M) — the document CMMC/NIST 800-171 assessors expect
alongside the SSP, tracking every control that is not yet fully implemented. Format as a markdown table with
columns: Item ID, NIST 800-171 Control Family, Weakness/Gap Description, Planned Remediation, Responsible
Party, Target Completion Date, Status (Open/In Progress). Generate 10-15 realistic, specific gap rows plausible
for this company's size and profile (typical real-world gaps: incomplete MFA rollout, insufficient log
retention, informal configuration management, pending encryption-at-rest rollout, etc.) — do not invent gaps
that contradict what the company profile states is already in place. Sort by control family.

The Target Completion Date column is a structured data field, not prose — it must contain an actual
relative timeframe (e.g. "30 days from plan approval", "Q2 2026", "90 days"), never a vague phrase like
"reviewed on a regular cadence" or a placeholder. Pick a reasonable timeframe per item based on typical
remediation effort for that control type (e.g. policy updates: 30 days; technical rollouts like MFA or
encryption: 60-90 days).`,
      },
      incident_response_plan_cmmc: {
        title: 'CMMC Incident Response Plan (DFARS 72-Hour Reporting)',
        instructions: `Write an Incident Response Plan specifically meeting DFARS 252.204-7012 requirements for handling
incidents involving Controlled Unclassified Information (CUI). This is distinct from a general ISO incident
response plan — it must cover:
1. Incident classification, with specific attention to identifying when CUI is involved
2. The mandatory 72-hour reporting requirement to the DoD via DIBNet upon discovery of a cyber incident
   affecting CUI, and what information that report must contain
3. Media preservation requirement (a forensic image of affected systems/media must be preserved for at
   least 90 days for potential DoD damage assessment)
4. Internal escalation path and roles (incident lead, who has authority to engage DoD/legal)
5. Coordination with any prime contractor if this company is a subcontractor
6. Post-incident review and lessons-learned process
Tailor the content to this company's actual systems/data, not generic text.`,
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

  iso42001: {
    label: 'ISO 42001 / AI Governance',
    docTypes: {
      ai_management_system_policy: {
        title: 'AI Management System Policy',
        instructions: `Write a comprehensive AI Management System (AIMS) Policy aligned with ISO/IEC 42001:2023, the
certifiable standard for AI governance. This should be a substantial policy (target 2,000-3,000 words) with
real, specific content per section — this is becoming a genuine differentiator: ISO 42001 certification is
appearing in enterprise RFPs as a trust signal, and almost no company has caught up to it yet.

Required sections, each with real substance tailored to the company's stated AI systems:
1. Purpose and Scope (which AI systems this policy covers — name them from the company profile)
2. Management Commitment to responsible AI
3. AI Governance Objectives (safety, fairness, transparency, accountability)
4. Roles and Responsibilities (an AI Governance Officer/committee role, escalation path)
5. AI System Inventory and Classification (list the company's stated AI systems, and for each, note
   whether the company is acting as "provider" — building/customizing the model — or "deployer" — using
   a third-party model as-is — since EU AI Act obligations differ by role)
6. Risk-Based Approach (how AI systems are risk-tiered — reference that a detailed AI Risk & Impact
   Assessment is a separate, dedicated document)
7. Data Governance for AI (training/fine-tuning data quality, bias testing, data minimization)
8. Human Oversight (what human-in-the-loop or human-review checkpoints exist for AI-driven decisions)
9. Transparency and Explainability (how users are informed they're interacting with an AI system, to what
   degree AI decisions are explainable)
10. Third-Party and Foundation Model Usage (due diligence on external AI providers/APIs used)
11. Incident Management for AI Systems (how AI-specific incidents — e.g. harmful outputs, bias incidents,
    model drift — are reported and handled)
12. Monitoring and Continuous Improvement (post-deployment monitoring cadence for AI system performance/drift)
13. Policy Review Cadence
14. Consequences of Non-Compliance

If the company profile lists no specific AI systems, note plainly that this policy establishes the
governance framework in advance of AI adoption, without inventing systems that don't exist.`,
      },
      ai_risk_assessment: {
        title: 'AI Risk & Impact Assessment',
        instructions: `Produce an AI Risk & Impact Assessment as a markdown table, one row per AI system the company
uses or builds (from the company profile's AI systems list). Columns: AI System, Role (Provider/Deployer),
EU AI Act Risk Tier (Unacceptable/High-Risk/Limited-Risk/Minimal-Risk — classify based on the system's actual
use case, e.g. a customer support chatbot is typically limited-risk requiring transparency disclosure, while
an automated hiring/credit-decision system would be high-risk), Potential Harms (bias/discrimination, privacy,
safety, misinformation — whichever are actually relevant to that system), Mitigations, Human Oversight Measure,
Review Frequency. If the company profile lists no AI systems, state clearly that no AI risk assessment is
required at this time rather than inventing hypothetical systems.`,
      },
      eu_ai_act_readiness: {
        title: 'EU AI Act Readiness Statement',
        instructions: `Write an EU AI Act Readiness Statement assessing this company's obligations under the EU AI Act,
which is phasing in through 2026. Structure:
1. Applicability (does the company offer AI systems to, or are its AI systems used by, people in the EU —
   infer from the company profile's country and processes_eu_data fields; state clearly if the Act likely
   doesn't apply and explain why, rather than assuming it does)
2. Role Determination (provider vs. deployer for each AI system named in the profile). Apply this
   distinction precisely: a company is a "provider" only if it develops an AI system or has one developed
   and places it on the market/into service under its own name — including substantially modifying or
   fine-tuning a third-party model. A company that uses a third-party AI system or API (e.g. calling
   OpenAI's GPT-4 API) without substantially modifying the underlying model is a "deployer" of that
   system, even though it built the product around it. An internally-built model the company trained
   itself is typically "provider". Get this right and be consistent with how you'd classify the same
   system in a separate AI Risk Assessment document — don't default everything to "provider".
3. Risk Tier Classification for each AI system and the resulting obligations (e.g. limited-risk systems like
   chatbots mainly require disclosure that users are interacting with AI; high-risk systems require a
   conformity assessment, technical documentation, and human oversight measures)
4. Transparency Obligations (what disclosures, if any, need to be added to user-facing products)
5. Technical Documentation Status (what documentation the company should maintain — reference that ISO/IEC
   42001 provides a certifiable framework for organizing this evidence)
6. Recommended Next Steps, prioritized
Note explicitly that ISO 42001 is not yet formally harmonized as an EU AI Act standard as of this writing, so
certification supports but does not by itself guarantee legal compliance — this must be stated, not omitted.`,
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
