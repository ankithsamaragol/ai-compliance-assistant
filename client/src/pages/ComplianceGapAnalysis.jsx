import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  IconSparkle, IconShieldCheck, IconAlertTriangle, IconFileText, IconBuilding, IconBook, IconClock,
  IconCheckCircle, IconMessageCircle, IconClipboard,
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

function impactTier(lift) {
  if (lift >= 15) return { label: 'High Impact', cls: 'tier-critical' };
  if (lift >= 8) return { label: 'Medium Impact', cls: 'tier-medium' };
  return { label: 'Low Impact', cls: 'tier-low' };
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

function formatHours(hours) {
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const RISK_STATUS = {
  on_target: { label: 'At target', color: '#2e8b52' },
  projected: { label: 'On pace', color: 'var(--accent)' },
  stalled: { label: 'Stalled', color: 'var(--danger)' },
  insufficient_data: { label: 'Gathering history', color: 'var(--muted)' },
};

function riskDetail(fw) {
  if (fw.status === 'on_target') return 'Already at or above the 75% target.';
  if (fw.status === 'projected') return `+${fw.pointsPerWeek}pt/week — on pace to hit 75% in ~${fw.weeksToTarget} week${fw.weeksToTarget === 1 ? '' : 's'}.`;
  if (fw.status === 'stalled') return `No measurable progress in the last ${formatHours(fw.stalledHours)}.`;
  return 'Not enough history yet to predict a trend.';
}

// Plain-language onboarding for a company with zero documents/vendors/evidence — a genuine
// first-timer, not just someone who hasn't logged in recently. Deterministic, built from real
// profile fields and the curated checklist `why` text, same reasoning as composeInsight on the
// server: a coach message that might be inconsistent between two views (an LLM call) is worse
// than one that's always the same and always grounded in the actual profile.
function buildCoachIntro(company, data) {
  const facts = [];
  if (company.processes_pii) facts.push('you handle personal data (PII)');
  if (company.processes_eu_data) facts.push('you process EU resident data');
  if (company.ai_systems_used?.length) facts.push(`you use AI systems (${company.ai_systems_used[0]})`);
  if (company.cloud_providers?.length) facts.push(`you host on ${company.cloud_providers.join(', ')}`);

  const factsLine = facts.length
    ? `Based on your profile: ${facts.join('; ')}.`
    : "Your profile doesn't have data-handling details filled in yet — the more accurate it is (in Settings), the more specific this gets.";

  const top = data.nextActions?.[0];
  const firstStep = top
    ? `Start with "${top.label}"${top.why ? ` — ${top.why}` : ''}`
    : "You're already past the very first steps — check Today's priorities below for what's next.";

  return { factsLine, firstStep };
}

function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function TrendLabel({ delta, suffix = '' }) {
  if (delta === null || delta === undefined || delta === 0) return null;
  const positive = delta > 0;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: positive ? '#2e8b52' : 'var(--danger)', marginTop: 2, display: 'block' }}>
      {positive ? '↑' : '↓'} {Math.abs(delta)}{suffix} this week
    </span>
  );
}

const STAT_COLORS = [
  { bg: 'rgba(122,140,255,0.14)', color: '#7a8cff' },
  { bg: 'rgba(255,170,80,0.16)', color: '#e08a2e' },
  { bg: 'rgba(91,140,255,0.14)', color: 'var(--accent)' },
  { bg: 'rgba(122,200,150,0.16)', color: '#3ba25f' },
  { bg: 'rgba(180,130,255,0.16)', color: '#9a6ee0' },
  { bg: 'rgba(80,190,200,0.16)', color: '#2f9aa3' },
];

export default function ComplianceGapAnalysis({
  company, userName, refreshKey, onSelectDocumentAction, onSelectVendorAction, onNavigateToChat,
  onNavigateToDocuments, provider, onReportGenerated, documents,
}) {
  const [data, setData] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [riskPrediction, setRiskPrediction] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [generatingReport, setGeneratingReport] = useState(false);
  const [simKeys, setSimKeys] = useState(() => new Set());
  const [simResult, setSimResult] = useState(null);
  const [forecastTab, setForecastTab] = useState('pace');

  function load() {
    api.getGapAnalysis(company.id).then(setData).catch((err) => setError(err.message));
    api.listVendors(company.id).then(setVendors).catch(() => {});
    api.listCompanyAlerts(company.id).then(setAlerts).catch(() => {});
    api.getRiskPrediction(company.id).then(setRiskPrediction).catch(() => {});
    api.getStrategy(company.id).then(setStrategy).catch(() => {});
  }

  useEffect(load, [company.id, refreshKey]);

  useEffect(() => {
    if (simKeys.size === 0) { setSimResult(null); return; }
    api.simulateGapAnalysis(company.id, Array.from(simKeys)).then(setSimResult).catch(() => {});
  }, [company.id, simKeys]);

  function toggleSimKey(frameworkKey, itemKey) {
    const fullKey = `${frameworkKey}:${itemKey}`;
    setSimKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fullKey)) next.delete(fullKey);
      else next.add(fullKey);
      return next;
    });
  }

  async function dismissAlert(alertId) {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      await api.dismissAlert(company.id, alertId);
    } catch {
      load();
    }
  }

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

  const overallScore = data.overallScore;
  const tag = readinessTag(overallScore);
  const risk = riskLevel(data.openRisks);
  const topAction = data.nextActions?.[0];

  const tierCounts = ['critical', 'high', 'medium', 'low'].map((tier) => ({
    tier, count: vendors.filter((v) => v.risk_tier === tier).length,
  }));

  const realDocuments = (documents || []).filter((d) => d.framework !== 'executive_report');
  const activity = [
    ...realDocuments.map((d) => ({ type: 'document', title: d.title, meta: d.framework.replace('_', ' '), time: d.created_at })),
    ...vendors.map((v) => ({ type: 'vendor', title: `${v.name} added to vendor register`, meta: `${TIER_LABEL[v.risk_tier]} risk`, time: v.created_at, tier: v.risk_tier })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);
  const impact = topAction ? impactTier(topAction.totalLift) : null;

  const firstName = userName ? userName.split(' ')[0] : '';
  const isNewCompany = data.documentsReady === 0 && data.vendorCount === 0 && (data.evidenceCount || 0) === 0;
  const coachIntro = isNewCompany ? buildCoachIntro(company, data) : null;

  return (
    <div>
      {coachIntro && (
        <div className="panel" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <h3 style={{ marginTop: 0 }}>👋 New here? Let's get {company.name} compliance-ready.</h3>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 8px' }}>{coachIntro.factsLine}</p>
            <p style={{ margin: 0 }}>{coachIntro.firstStep}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
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

      {alerts.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}><IconAlertTriangle size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Profile changes to review</h3>
          {alerts.map((alert) => (
            <div key={alert.id} className="priority-item">
              <div className="priority-item-body">
                <div className="priority-item-title">{alert.message}</div>
              </div>
              {alert.suggested_action && (
                <button
                  className="secondary"
                  style={{ marginTop: 0, fontSize: 12 }}
                  onClick={() => (alert.suggested_action === 'vendors' ? onSelectVendorAction?.() : onNavigateToDocuments?.())}
                >
                  {alert.suggested_action === 'vendors' ? 'Vendors' : 'Documents'}
                </button>
              )}
              <button
                className="secondary"
                style={{ marginTop: 0, fontSize: 12 }}
                onClick={() => dismissAlert(alert.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-hero">
        <div className="hero-readiness">
          <svg className="hero-illustration" viewBox="0 0 240 140" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
            <polygon points="130,18 185,112 75,112" fill="rgba(139,156,255,0.28)" />
            <polygon points="185,46 240,112 130,112" fill="rgba(150,100,255,0.24)" />
            <line x1="130" y1="18" x2="130" y2="2" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <polygon points="130,2 149,8 130,14" fill="rgba(255,255,255,0.8)" />
          </svg>
          <div
            className="readiness-ring"
            style={{ background: `conic-gradient(#8b9cff ${overallScore * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
          >
            <span className="readiness-ring-value">{overallScore}%</span>
          </div>
          <div className="hero-readiness-body">
            <span className="hero-readiness-tag" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
            {data.trend && data.trend.scoreDelta !== 0 && (
              <span
                className="hero-readiness-tag"
                style={{
                  background: data.trend.scoreDelta > 0 ? 'rgba(122,200,150,0.18)' : 'rgba(255,107,107,0.18)',
                  color: data.trend.scoreDelta > 0 ? '#8fe0ab' : '#ff9d9d',
                  marginLeft: 6,
                }}
              >
                {data.trend.scoreDelta > 0 ? '↑' : '↓'} {Math.abs(data.trend.scoreDelta)}% this week
              </span>
            )}
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
            <span className="hero-ai-message-icon"><IconMessageCircle size={12} /></span>
            <span>
              {data.latestInsight
                ? data.latestInsight.insight
                : `Ask anything about ${company.name}'s vendors, gaps, and compliance status — grounded in the real data on file.`}
              {data.latestInsight && <span className="meta" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{timeAgo(data.latestInsight.created_at)}</span>}
            </span>
          </div>
          {topAction && (
            <>
              <div className="hero-recommendation-label">Top recommendation</div>
              <div className="hero-recommendation-row">
                <div className="hero-recommendation">{topAction.label}</div>
                <span className={`tier-badge ${impact.cls}`}>{impact.label}</span>
              </div>
              <div className="hero-recommendation-impact">+{topAction.totalLift}pt impact</div>
            </>
          )}
          <button style={{ marginTop: 'auto', paddingTop: 14 }} onClick={onNavigateToChat}>Ask AI Officer →</button>
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[0].bg, color: STAT_COLORS[0].color }}><IconShieldCheck size={18} /></div>
          <div>
            <div className="stat-tile-value">{overallScore}%</div>
            <div className="stat-tile-label">Compliance score</div>
            <TrendLabel delta={data.trend?.scoreDelta} suffix="%" />
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[1].bg, color: risk.color }}><IconAlertTriangle size={18} /></div>
          <div><div className="stat-tile-value">{risk.label}</div><div className="stat-tile-label">Risk level</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[2].bg, color: STAT_COLORS[2].color }}><IconFileText size={18} /></div>
          <div>
            <div className="stat-tile-value">{data.documentsReady}</div>
            <div className="stat-tile-label">Documents</div>
            <TrendLabel delta={data.trend?.documentsDelta} />
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[3].bg, color: STAT_COLORS[3].color }}><IconBuilding size={18} /></div>
          <div>
            <div className="stat-tile-value">{data.vendorCount}</div>
            <div className="stat-tile-label">Vendors</div>
            <TrendLabel delta={data.trend?.vendorsDelta} />
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[4].bg, color: STAT_COLORS[4].color }}><IconBook size={18} /></div>
          <div><div className="stat-tile-value">{data.frameworks.length}</div><div className="stat-tile-label">Frameworks</div></div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon" style={{ background: STAT_COLORS[5].bg, color: STAT_COLORS[5].color }}><IconClipboard size={18} /></div>
          <div>
            <div className="stat-tile-value">{data.evidenceCount || 0}</div>
            <div className="stat-tile-label">Evidence</div>
            <TrendLabel delta={data.trend?.evidenceDelta} />
          </div>
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
              {item.type === 'document'
                ? <span className="activity-icon activity-icon-done"><IconCheckCircle size={13} /></span>
                : <span className="activity-dot" style={{ background: TIER_COLOR[item.tier] }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="activity-item-title">{item.title}</div>
                <div className="activity-item-meta">{item.meta}</div>
              </div>
              <span className="activity-item-time"><IconClock size={11} /> {timeAgo(item.time)}</span>
            </div>
          ))}
        </div>
      </div>

      {(riskPrediction?.frameworks?.length > 0 || strategy?.frameworks?.length > 0) && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0 }}>Forecast</h3>
            <div className="tab-toggle">
              <button
                type="button"
                className={`tab-toggle-btn ${forecastTab === 'pace' ? 'active' : ''}`}
                onClick={() => setForecastTab('pace')}
              >
                Pace
              </button>
              <button
                type="button"
                className={`tab-toggle-btn ${forecastTab === 'roadmap' ? 'active' : ''}`}
                onClick={() => setForecastTab('roadmap')}
              >
                Roadmap
              </button>
            </div>
          </div>

          {forecastTab === 'pace' && riskPrediction?.frameworks?.length > 0 && (
            <>
              <div className="meta" style={{ fontSize: 12, margin: '10px 0' }}>
                Based on real score history only — projects when a framework will cross the {riskPrediction.targetScore}%
                "on track" line at its current pace, or flags it as stalled. No history yet, no projection.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riskPrediction.frameworks.map((fw) => {
                  const status = RISK_STATUS[fw.status];
                  return (
                    <div key={fw.key} className="priority-item">
                      <div className="priority-item-body">
                        <div className="priority-item-title">{fw.label}</div>
                        <div className="priority-item-meta">{riskDetail(fw)}</div>
                      </div>
                      <span className="status-badge" style={{ background: `${status.color}22`, color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {forecastTab === 'roadmap' && strategy?.frameworks?.length > 0 && (
            <>
              <div className="meta" style={{ fontSize: 12, margin: '10px 0' }}>
                The full ordered sequence of remaining steps to cross the 75% "on track" line for each
                framework — not just the single next best action. Timing shown only when there's enough
                real history to trust a pace; otherwise it's the sequence alone.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {strategy.frameworks.map((fw) => (
                  <div key={fw.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{fw.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(fw.currentScore) }}>{fw.currentScore}%</span>
                    </div>
                    {fw.status === 'at_target' ? (
                      <div className="meta" style={{ fontSize: 12, marginTop: 6 }}>Already at or above the 75% target.</div>
                    ) : (
                      <>
                        <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
                          {fw.weeksEstimate
                            ? `~${fw.weeksEstimate} week${fw.weeksEstimate === 1 ? '' : 's'} at your current pace`
                            : 'Not enough history yet to estimate timing'}
                          {fw.status === 'capped' && ' — some remaining items aren\'t automatable yet, target may not be fully reachable from here'}
                        </div>
                        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                          {fw.steps.map((step) => (
                            <li key={step.key} style={{ fontSize: 12.5, marginBottom: 6 }}>
                              <span style={{ fontWeight: 600 }}>{step.label}</span>
                              <span className="meta" style={{ marginLeft: 6 }}>→ {step.scoreAfter}%</span>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Framework detail</h3>
            <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
              Tick "Simulate" on any unmet item below to see the score impact — nothing is saved,
              this is a sandbox over your real current data.
            </div>
          </div>
          {simKeys.size > 0 && (
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={() => setSimKeys(new Set())}>
              Clear simulation ({simKeys.size})
            </button>
          )}
        </div>
        {simResult && (
          <div className="sim-result-strip">
            <div className="priority-item">
              <div className="priority-item-body">
                <div className="priority-item-title">Overall readiness</div>
                <div className="priority-item-meta">{simResult.baseline.overallScore}% → {simResult.simulated.overallScore}%</div>
              </div>
              <span className="priority-item-impact">+{simResult.simulated.overallScore - simResult.baseline.overallScore}pt</span>
            </div>
            {simResult.simulated.frameworks.map((fw, i) => {
              const before = simResult.baseline.frameworks[i];
              if (fw.score === before.score) return null;
              return (
                <div key={fw.key} className="priority-item">
                  <div className="priority-item-body">
                    <div className="priority-item-title">{fw.label}</div>
                    <div className="priority-item-meta">{before.score}% → {fw.score}%</div>
                  </div>
                  <span className="priority-item-impact">+{fw.score - before.score}pt</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 14 }}>
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
                    <li key={item.key} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ color: item.satisfied ? 'var(--accent)' : 'var(--muted)' }}>{item.satisfied ? '✓' : '○'}</span>
                        <span style={{ color: item.satisfied ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{item.label}</span>
                        {!item.satisfied && !item.automatable && <span className="meta" style={{ fontSize: 10 }}>not yet supported</span>}
                        {!item.satisfied && item.automatable && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--muted)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              style={{ width: 'auto' }}
                              checked={simKeys.has(`${fw.key}:${item.key}`)}
                              onChange={() => toggleSimKey(fw.key, item.key)}
                            />
                            Simulate
                          </label>
                        )}
                      </div>
                      {!item.satisfied && item.why && (
                        <div className="meta" style={{ fontSize: 11.5, marginLeft: 22, marginTop: 3, lineHeight: 1.4 }}>
                          <strong style={{ color: 'var(--text)' }}>Why it matters:</strong> {item.why}
                          {item.risk && <><br /><strong style={{ color: 'var(--danger)' }}>If skipped:</strong> {item.risk}</>}
                        </div>
                      )}
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
