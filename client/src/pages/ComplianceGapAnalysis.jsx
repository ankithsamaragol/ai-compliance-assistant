import { useEffect, useState } from 'react';
import { api } from '../api/client';

function scoreColor(score) {
  if (score >= 75) return 'var(--accent)';
  if (score >= 40) return '#ffc107';
  return 'var(--danger)';
}

export default function ComplianceGapAnalysis({ company, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  function load() {
    api.getGapAnalysis(company.id).then(setData).catch((err) => setError(err.message));
  }

  useEffect(load, [company.id, refreshKey]);

  if (error) return <div className="panel"><div className="error">{error}</div></div>;
  if (!data) return null;

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Compliance Gap Analysis</h3>
        <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={load}>Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="meta">Open risks (critical/high vendors)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.openRisks}</div>
        </div>
        <div>
          <div className="meta">Documents ready</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.documentsReady}</div>
        </div>
        <div>
          <div className="meta">Vendors tracked</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.vendorCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 20 }}>
        {data.frameworks.map((fw) => (
          <div key={fw.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>{fw.label}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor(fw.score) }}>{fw.score}%</span>
            </div>
            <div className="meta">{fw.satisfiedCount} of {fw.totalCount} requirements met</div>
            <div style={{ height: 6, background: 'rgba(127,127,127,0.15)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${fw.score}%`, height: '100%', background: scoreColor(fw.score) }} />
            </div>

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
                    <span style={{ color: item.satisfied ? 'var(--accent)' : 'var(--muted)' }}>
                      {item.satisfied ? '✓' : '○'}
                    </span>
                    <span style={{ color: item.satisfied ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{item.label}</span>
                    {!item.satisfied && !item.automatable && (
                      <span className="meta" style={{ fontSize: 10 }}>not yet supported</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
