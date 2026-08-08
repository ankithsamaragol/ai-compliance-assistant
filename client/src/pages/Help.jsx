const STEPS = [
  { title: 'Fill in your company profile', detail: 'Settings → Company profile. Be specific about data types, cloud providers, tools, and AI systems — nearly every other feature (documents, vendor detection, risk suggestions, alerts) is grounded in what you put here.' },
  { title: 'Generate your first documents', detail: 'Documents tab → pick a framework and document type → Generate. Each one is drafted from your actual profile, not a generic template.' },
  { title: 'Detect your vendors', detail: 'Vendors tab → Detect vendors. Reads your profile\'s tools/cloud providers and risk-tiers each one automatically.' },
  { title: 'Check what\'s still open', detail: 'The Dashboard\'s "Today\'s priorities" always shows your best next step, ranked by impact — click straight through to act on it.' },
];

const FEATURES = [
  { name: 'Documents', detail: 'AI-drafted policies and records for ISO 27001, GDPR, CMMC, and ISO 42001 — grounded in your company profile.' },
  { name: 'Risks', detail: 'A structured risk register — AI-suggested from your profile and gaps, or add your own. Severity is always computed, never guessed by the AI.' },
  { name: 'Vendors', detail: 'Auto-detected third-party tools, each risk-tiered with reasoning and a review cadence.' },
  { name: 'Evidence', detail: 'Upload a real file (a backup log, a training record) and the AI maps it to the specific checklist item it actually supports.' },
  { name: 'AI Compliance Officer', detail: 'Ask questions about your own compliance posture — answers are grounded in your real data, not general advice.' },
  { name: 'Timeline', detail: 'A real history of every score-moving change, not a fabricated activity feed.' },
  { name: 'Team', detail: 'Invite teammates to your workspace — everyone shares the same companies and data.' },
];

export default function Help({ onBack, contactEmail }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h2 className="section-heading" style={{ marginBottom: 4 }}>Help</h2>
        <button className="secondary" style={{ marginTop: 0 }} onClick={onBack}>← Back</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Getting started</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ display: 'flex', gap: 12 }}>
              <div className="help-step-number">{i + 1}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.title}</div>
                <div className="meta" style={{ marginTop: 2 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>What each part does</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 14 }}>
          {FEATURES.map((f) => (
            <div key={f.name}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.name}</div>
              <div className="meta" style={{ marginTop: 2 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Need help, or something look wrong?</h3>
        <div className="meta" style={{ marginTop: 4, marginBottom: 12 }}>
          This is a new product and we're actively improving it — if something's unclear or you hit an
          issue, reach out directly.
        </div>
        <a href={`mailto:${contactEmail}`} style={{ textDecoration: 'none' }}>
          <button type="button" style={{ marginTop: 0 }}>Email {contactEmail}</button>
        </a>
      </div>
    </div>
  );
}
