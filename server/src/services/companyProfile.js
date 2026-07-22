function companyProfileBlock(company) {
  return `Company profile:
- Name: ${company.name}
- Industry: ${company.industry}
- Size: ${company.size_band} employees
- Country: ${company.country}
- Primary contact email: ${company.contact_email || 'not specified'}
- Processes personal data (PII): ${company.processes_pii ? 'yes' : 'no'}
- Processes EU resident data: ${company.processes_eu_data ? 'yes' : 'no'}
- Data types handled: ${(company.data_types || []).join(', ') || 'not specified'}
- Cloud providers: ${(company.cloud_providers || []).join(', ') || 'not specified'}
- Tools & vendors used: ${(company.tools_used || []).join(', ') || 'not specified'}
- AI systems used or built: ${(company.ai_systems_used || []).join(', ') || 'none specified'}
- Additional notes: ${company.notes || 'none'}`;
}

module.exports = { companyProfileBlock };
