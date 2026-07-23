import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  IconSparkle, IconShieldCheck, IconAlertTriangle, IconFileText, IconBuilding, IconBook, IconClock,
} from '../components/Icons';

function scoreColor(score) {
  if (score >= 75) return 'var(--accent)';
  if (score >= 40) return '#ffc107';
  return 'var(--danger)';
}

function readinessTag(score) {
  if (score >= 75) return { label: 'On Track', bg: 'rgba(122,200,150,0.18)', color: '#8fe0ab' };
  if (score >= 40) return { label: 'In Progress', bg: 'rgba(255,193,7,0.18)', color: '#ffc107' };
  return { label: 'Needs Attention', bg: 'rgba(255,107,107,0.18)', color: '#ff9d9d' };
}

function riskLevel(openRisks) {
  if (openRisks === 0) return { label: 'Low', color: '#2e8b52' };
  if (openRisks <= 2) return { label: 'Medium', color: '#b8860b' };
  return { label: 'High', color: 'var(--danger)' };
}

const TIER_COLOR = { critical: 'var(--danger)', high: '#cc6d00', medium: '#b8860b', low: '#2e8b52' };
const TIER_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const STAT_COLORS = [
  { bg: 'rgba(122,140,255,0.14)', color: '#7a8cff' },
  { bg: 'rgba(255,170,80,0.16)', color: '#e08a2e' },
  { bg: 'rgba(91,140,255,0.14)', color: 'var(--accent)' },
  { bg: 'rgba(122,200,150,0.16)', color: '#3ba25f' },
  { bg: 'rgba(180,130,255,0.16)', color: '#9a6ee0' },
];

export default function ComplianceGapAnalysis({
  company, userName, refreshKey, onSelectDocumentAction, onSelectVendorAction, onNavigateToChat,
  provider, onReportGenerated, documents,
}) {
  const [data, setData] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [generatingReport, setGeneratingReport] = useState(false);

  function load() {
    api.getGapAnalysis(company.id).then(setData).catch((err) => setError(err.message));
    api.listVendors(company.id).then(setVendors).catch(() => {});
  }

  useEffect(load, [company.id, refreshKey]);

  async function generateReport() {
    setReportError('');
    setGeneratingReport(true);
    try {
      const doc = await api.generateExecutiveReport(company.id, provider);
      onReportGenerated?.(doc);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setGeneratingReport(false);
    }
  }

  if (error) return <div className="panel"><div className="error">{error}</div></div>;
  if (!data) return null;

  const overallScore = data.frameworks.length
    ? Math.round(data.frameworks.reduce((sum, f) => sum + f.score, 0) / data.frameworks.length)
    : 0;
  const tag = readinessTag(overallScore);
  const risk = riskLevel(data.openRisks);
  const topAction = data.nextActions?.[0];

  const tierCounts = ['critical', 'high', 'medium', 'low'].map((tier) => ({
    tier, count: vendors.filter((v) => v.risk_tier === tier).length,
  }));

  const realDocuments = (documents || []).filter((d) => d.framework !== 'executive_report');
  const activity = [
    ...realDocuments.map((d) => ({ type: 'document', title: d.title, meta: d.framework.replace('_', ' '), time: d.created_at })),
    ...vendors.map((v) => ({ type: 'vendor', title: `${v.name} added to vendor register`, meta: `${TIER_LABEL[v.risk_tier]} risk`, time: v.created_at })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);

  const firstName = userName ? userName.split(' ')[0] : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <h2 className="section-heading" style={{ marginBottom: 4 }}>
            {greetingWord()}{firstName ? `, ${firstName}` : ''} 👋
          </h2>
          <div className="meta">Here's what's happening with {company.name} today.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={load}>Refresh</button>
          <button style={{ marginTop: 0, fontSize: 12 }} onClick={generateReport} disabled={generatingReport}>
            {generatingReport ? 'Generating…' : 'Executive report'}
          </button>
        </div>
      </div>
      {reportError && <div className="error" style={{ marginBottom: 12 }}>{reportError}</div>}

      <div className="dashboard-hero">
        <div className="hero-readiness">
          <div
            className="readiness-ring"
            style={{ background: `conic-gradient(#8b9cff ${overallScore * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
          >
            <span className="readiness-ring-value">{overallScore}%</span>
          </div>
          <div className="hero-readiness-body">
            <span className="hero-readiness-tag" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
            <h3>Average readiness across {data.frameworks.length} frameworks</h3>
            <p>
              {topAction
                ? `Completing "${topAction.label}" would add ${topAction.totalLift} point${topAction.totalLift === 1 ? '' : 's'} across ${topAction.affects.length} framework${topAction.affects.length === 1 ? '' : 's'}.`
                : 'All automatable checklist items are complete for this company.'}
            </p>
          </div>
        </div>

        <div className="hero-ai-card">
          <div className="hero-ai-card-title">
            <span className="hero-ai-badge"><IconSparkle size={18} /></span>
            AI Compliance Officer
          </div>
          <div className="hero-ai-message">
            Ask anything about {company.name}'s vendors, gaps, and compliance status — grounded in the real data on file.
          </div>
          {topAction && (
            <>
              <div className="hero-recommendation-label">Top recommendation</div>
              <div className="hero-recommendation">{topAction.label}</div>
              <div className="hero-recommendation-impact">+{topAction.totalLift}pt impact</div>
            </>
          )}
          <button style={{ marginTop: 'auto', paddingTop: 14 }} onClick={onNavigateToChat}>Ask AI Officer →</button>
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[0].bg, color: STAT_COLORS[0].color }}><IconShieldCheck size={18} /></div>
          <div><div className="stat-tile-value">{overallScore}%</div><div className="stat-tile-label">Compliance score</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[1].bg, color: risk.color }}><IconAlertTriangle size={18} /></div>
          <div><div className="stat-tile-value">{risk.label}</div><div className="stat-tile-label">Risk level</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[2].bg, color: STAT_COLORS[2].color }}><IconFileText size={18} /></div>
          <div><div className="stat-tile-value">{data.documentsReady}</div><div className="stat-tile-label">Documents</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[3].bg, color: STAT_COLORS[3].color }}><IconBuilding size={18} /></div>
          <div><div className="stat-tile-value">{data.vendorCount}</div><div className="stat-tile-label">Vendors</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[4].bg, color: STAT_COLORS[4].color }}><IconBook size={18} /></div>
          <div><div className="stat-tile-value">{data.frameworks.length}</div><div className="stat-tile-label">Frameworks</div></div>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Today's priorities</h3>
          {!data.nextActions?.length && <div className="meta">All automatable checklist items are complete.</div>}
          {data.nextActions?.map((action) => (
            <div key={`${action.actionType}-${action.framework || ''}-${action.docType || ''}`} className="priority-item">
              <div className="priority-item-body">
                <div className="priority-item-title">{action.label}</div>
                <div className="priority-item-meta">{action.affects.map((a) => `${a.frameworkLabel} ${a.from}%→${a.to}%`).join('  ·  ')}</div>
              </div>
              <span className="priority-item-impact">+{action.totalLift}pt</span>
              <button
                className="secondary"
                style={{ marginTop: 0, fontSize: 12 }}
                onClick={() => (action.actionType === 'vendors'
                  ? onSelectVendorAction?.()
                  : onSelectDocumentAction?.(action.framework, action.docType))}
              >
                {action.actionType === 'vendors' ? 'Vendors' : 'Generate'}
              </button>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Framework progress</h3>
          {data.frameworks.map((fw) => (
            <div key={fw.key} className="fw-progress-row">
              <div className="fw-progress-head">
                <span className="fw-name">{fw.label}</span>
                <span className="fw-score" style={{ color: scoreColor(fw.score) }}>{fw.score}%</span>
              </div>
              <div className="fw-progress-track">
                <div className="fw-progress-fill" style={{ width: `${fw.score}%`, background: scoreColor(fw.score) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Risk distribution</h3>
          {vendors.length === 0 && <div className="meta">No vendors tracked yet.</div>}
          {vendors.length > 0 && tierCounts.map(({ tier, count }) => (
            <div key={tier} className="fw-progress-row">
              <div className="fw-progress-head">
                <span className="fw-name"><span className="risk-dist-dot" style={{ background: TIER_COLOR[tier] }} /> {TIER_LABEL[tier]} risk</span>
                <span className="fw-score" style={{ color: TIER_COLOR[tier] }}>{count}</span>
              </div>
              <div className="fw-progress-track">
                <div className="fw-progress-fill" style={{ width: `${(count / vendors.length) * 100}%`, background: TIER_COLOR[tier] }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Recent activity</h3>
          {activity.length === 0 && <div className="meta">No activity yet.</div>}
          {activity.map((item, i) => (
            <div key={i} className="activity-item">
              <span className="activity-dot" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="activity-item-title">{item.title}</div>
                <div className="activity-item-meta">{item.meta}</div>
              </div>
              <span className="activity-item-time"><IconClock size={11} /> {timeAgo(item.time)}</span>
            </div>
          ))}
        </div>
      </div>

      {data.crossFrameworkHints?.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Reuse across frameworks</h3>
          <div className="meta" style={{ fontSize: 12, marginBottom: 8 }}>
            Where work for one framework overlaps with another — informational only, doesn't affect scoring.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.crossFrameworkHints.map((hint, i) => (
              <div key={i} className="reuse-hint-card">
                {hint.type === 'reuse' ? (
                  <div style={{ fontSize: 13 }}>
                    <strong>{hint.have.label}</strong> <span className="meta">({hint.have.frameworkLabel}, already done)</span>
                    {' '}→ helps with <strong>{hint.towards.label}</strong> <span className="meta">({hint.towards.frameworkLabel})</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <strong>{hint.items[0].label}</strong> is missing in both{' '}
                    <span className="meta">{hint.items.map((it) => it.frameworkLabel).join(' & ')}</span>
                  </div>
                )}
                <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>{hint.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Framework detail</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {data.frameworks.map((fw) => (
            <div key={fw.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600 }}>{fw.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(fw.score) }}>{fw.score}%</span>
              </div>
              <div className="meta">{fw.satisfiedCount} of {fw.totalCount} requirements met</div>
              <button
                type="button"
                className="secondary"
                style={{ marginTop: 12, fontSize: 12 }}
                onClick={() => setExpanded((prev) => ({ ...prev, [fw.key]: !prev[fw.key] }))}
              >
                {expanded[fw.key] ? 'Hide checklist' : 'View checklist'}
              </button>
              {expanded[fw.key] && (
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
                  {fw.items.map((item) => (
                    <li key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                      <span style={{ color: item.satisfied ? 'var(--accent)' : 'var(--muted)' }}>{item.satisfied ? '✓' : '○'}</span>
                      <span style={{ color: item.satisfied ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{item.label}</span>
                      {!item.satisfied && !item.automatable && <span className="meta" style={{ fontSize: 10 }}>not yet supported</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
