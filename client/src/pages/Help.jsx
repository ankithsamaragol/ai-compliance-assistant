import {
  IconDocument, IconAlertTriangle, IconBuilding, IconClipboard, IconSparkle, IconClock, IconUsers, IconMessageCircle,
} from '../components/Icons';

const STEPS = [
  { title: 'Fill in your company profile', detail: 'Settings → Company profile. Be specific about data types, cloud providers, tools, and AI systems — nearly every other feature is grounded in what you put here.' },
  { title: 'Generate your first documents', detail: 'Documents tab → pick a framework and type → Generate. Each one is drafted from your actual profile, not a generic template.' },
  { title: 'Detect your vendors', detail: 'Vendors tab → Detect vendors. Reads your profile\'s tools and cloud providers and risk-tiers each one automatically.' },
  { title: 'Check what\'s still open', detail: 'The Dashboard\'s "Today\'s priorities" always shows your best next step, ranked by impact.' },
];

const FEATURES = [
  { name: 'Documents', icon: IconDocument, detail: 'AI-drafted policies and records for ISO 27001, GDPR, CMMC, and ISO 42001 — grounded in your company profile.' },
  { name: 'Risks', icon: IconAlertTriangle, detail: 'A structured risk register — AI-suggested or added by hand. Severity is always computed, never guessed by the AI.' },
  { name: 'Vendors', icon: IconBuilding, detail: 'Auto-detected third-party tools, each risk-tiered with reasoning and a review cadence.' },
  { name: 'Evidence', icon: IconClipboard, detail: 'Upload a real file and the AI maps it to the specific checklist item it actually supports.' },
  { name: 'AI Compliance Officer', icon: IconSparkle, detail: 'Ask questions about your own compliance posture — answers are grounded in your real data.' },
  { name: 'Timeline', icon: IconClock, detail: 'A real history of every score-moving change, not a fabricated activity feed.' },
  { name: 'Team', icon: IconUsers, detail: 'Invite teammates to your workspace — everyone shares the same companies and data.' },
];

export default function Help({ onBack, contactEmail }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div>
          <h2 className="section-heading" style={{ marginBottom: 4 }}>Help</h2>
          <div className="section-subheading" style={{ margin: 0 }}>Everything you need to get going, and how to reach us.</div>
        </div>
        <button className="secondary" style={{ marginTop: 0 }} onClick={onBack}>← Back</button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Getting started</h3>
        <div className="help-stepper">
          {STEPS.map((s, i) => (
            <div className="help-step" key={s.title}>
              <div className="help-step-rail">
                <div className="help-step-number">{i + 1}</div>
                {i < STEPS.length - 1 && <div className="help-step-line" />}
              </div>
              <div className="help-step-body">
                <div className="help-step-title">{s.title}</div>
                <div className="help-step-detail">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>What each part does</h3>
        <div className="help-feature-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div className="help-feature-card" key={f.name}>
                <div className="help-feature-icon"><Icon size={16} /></div>
                <div className="help-feature-name">{f.name}</div>
                <div className="help-feature-detail">{f.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="help-contact-panel">
        <div className="help-contact-icon"><IconMessageCircle size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px' }}>Need help, or something look wrong?</h3>
          <div className="meta" style={{ marginBottom: 14 }}>
            This is a new product and we're actively improving it — if something's unclear or you
            hit an issue, reach out directly.
          </div>
          <a href={`mailto:${contactEmail}`} style={{ textDecoration: 'none' }}>
            <button type="button" style={{ marginTop: 0 }}>Email {contactEmail}</button>
          </a>
        </div>
      </div>
    </div>
  );
}
