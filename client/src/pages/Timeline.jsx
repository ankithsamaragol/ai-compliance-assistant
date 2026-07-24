import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { IconDocument, IconBuilding, IconClipboard, IconShieldCheck } from '../components/Icons';

const TRIGGER_META = {
  document_generated: { label: 'Document generated', icon: IconDocument },
  vendor_detected: { label: 'Vendors detected', icon: IconBuilding },
  evidence_analyzed: { label: 'Evidence analyzed', icon: IconClipboard },
  connector_synced: { label: 'Connector synced', icon: IconShieldCheck },
};

const FRAMEWORK_LABEL = { iso27001: 'ISO 27001', gdpr: 'GDPR', cmmc: 'CMMC', iso42001: 'ISO 42001' };

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) return <span className="meta" style={{ fontSize: 11 }}>no change</span>;
  const positive = delta > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: positive ? '#2e8b52' : 'var(--danger)' }}>
      {positive ? '+' : ''}{delta}%
    </span>
  );
}

export default function Timeline({ company }) {
  const [snapshots, setSnapshots] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTimeline(company.id).then(setSnapshots).catch((err) => setError(err.message));
  }, [company.id]);

  if (error) return <div className="panel"><div className="error">{error}</div></div>;
  if (!snapshots) return null;

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Timeline</h3>
      <div className="meta" style={{ marginTop: -6, marginBottom: 14 }}>
        Real history — a snapshot is recorded only when something actually happens (a document is
        generated, vendors are detected, evidence is analyzed, or a connector syncs). Nothing here
        is on a timer or backdated.
      </div>

      {snapshots.length === 0 ? (
        <div className="meta">
          No history yet. Generate a document, detect vendors, upload evidence, or sync a connector
          to start building a real timeline.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {snapshots.map((snap, i) => {
            const meta = TRIGGER_META[snap.trigger] || { label: snap.trigger, icon: IconDocument };
            const Icon = meta.icon;
            const older = snapshots[i + 1];
            const delta = older ? snap.overall_score - older.overall_score : null;
            return (
              <div key={snap.id} className="activity-item" style={{ alignItems: 'flex-start' }}>
                <span className="activity-icon activity-icon-done"><Icon size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="activity-item-title">{meta.label}</span>
                    {!older && <span className="meta" style={{ fontSize: 10.5 }}>first snapshot</span>}
                  </div>
                  {snap.trigger_detail && <div className="activity-item-meta">{snap.trigger_detail}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {Object.entries(snap.framework_scores || {}).map(([fw, score]) => (
                      <span key={fw} className="framework-pill">{FRAMEWORK_LABEL[fw] || fw} {score}%</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{snap.overall_score}%</span>
                  <DeltaBadge delta={delta} />
                  <span className="activity-item-time" style={{ marginLeft: 0 }}>{formatDate(snap.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
