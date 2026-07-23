import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const STATUS_LABEL = { analyzed: 'Analyzed', pending: 'Analyzing…', failed: 'Analysis failed', unsupported: 'Not AI-readable' };
const STATUS_CLASS = { analyzed: 'status-ready', pending: 'status-generating', failed: 'status-failed', unsupported: 'status-unsupported' };
const CONFIDENCE_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Evidence({ company, providers, provider, setProvider, onChange }) {
  const [items, setItems] = useState([]);
  const [targets, setTargets] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [connectorBusy, setConnectorBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  function loadEvidence() {
    api.listEvidence(company.id).then(setItems).catch((err) => setError(err.message));
  }
  function loadConnectors() {
    api.listConnectors(company.id).then(setConnectors).catch(() => {});
  }

  useEffect(() => {
    loadEvidence();
    loadConnectors();
    api.getEvidenceTargets().then(setTargets).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const currentProvider = providers.find((p) => p.key === provider);
  const targetLabel = (framework, key) => {
    const t = targets.find((x) => x.framework === framework && x.key === key);
    return t ? `${t.label} (${t.frameworkLabel})` : key;
  };

  const github = connectors.find((c) => c.provider === 'github');

  async function connectGithub() {
    setError('');
    try {
      const { url } = await api.startGithubConnect(company.id);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    }
  }

  async function syncGithub() {
    setError('');
    setConnectorBusy(true);
    try {
      const updated = await api.syncGithubConnector(company.id);
      setConnectors((prev) => prev.map((c) => (c.provider === 'github' ? updated : c)));
      loadEvidence();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectorBusy(false);
    }
  }

  async function disconnectGithub() {
    setError('');
    setConnectorBusy(true);
    try {
      await api.disconnectGithubConnector(company.id);
      setConnectors((prev) => prev.filter((c) => c.provider !== 'github'));
      loadEvidence();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectorBusy(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const evidence = await api.uploadEvidence(company.id, file, provider);
      setItems((prev) => [evidence, ...prev]);
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function remove(id) {
    try {
      await api.deleteEvidence(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChange?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Connected sources</h3>
            <div className="meta" style={{ marginTop: 4 }}>
              Auto-pull compliance signals directly from your tools instead of manually uploading proof.
              v1 supports GitHub only, read-only (<code>read:org</code> scope), checking org-wide 2FA enforcement.
            </div>
          </div>
        </div>

        <div className="evidence-card" style={{ marginTop: 14 }}>
          <div className="evidence-card-head">
            <div>
              <div className="evidence-card-name">GitHub</div>
              <div className="meta" style={{ fontSize: 11.5 }}>
                {github
                  ? `${github.external_account ? `Org: ${github.external_account}` : 'Connected'} · last synced ${github.last_synced_at ? timeAgo(github.last_synced_at) : 'never'}`
                  : 'Not connected'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {github && <span className={`status-badge ${github.status === 'connected' ? 'status-ready' : 'status-failed'}`}>{github.status}</span>}
              {!github && <button style={{ marginTop: 0 }} onClick={connectGithub}>Connect GitHub</button>}
              {github && (
                <>
                  <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} disabled={connectorBusy} onClick={syncGithub}>
                    {connectorBusy ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} disabled={connectorBusy} onClick={disconnectGithub}>Disconnect</button>
                </>
              )}
            </div>
          </div>
          {github?.error && <div className="error" style={{ fontSize: 12, marginTop: 6 }}>{github.error}</div>}
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Evidence</h3>
          <div className="meta" style={{ marginTop: 4 }}>
            Upload real evidence — AI reads it and maps it to specific compliance checklist items. Supported:
            PDF, DOCX, TXT, MD, CSV, LOG, JSON (10MB max). Screenshots aren't AI-readable yet — upload for
            record-keeping, but they won't auto-map.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
            {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <input ref={fileInputRef} type="file" onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} id="evidence-file-input" />
          <button style={{ marginTop: 0 }} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Analyzing…' : 'Upload evidence'}
          </button>
        </div>
      </div>

      {currentProvider?.dataNotice && (
        <div className={`data-notice ${currentProvider.local ? 'data-notice-local' : 'data-notice-cloud'}`} style={{ marginTop: 12 }}>
          {currentProvider.local ? '🔒' : '☁️'} {currentProvider.dataNotice}
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {items.length === 0 ? (
        <div className="meta" style={{ marginTop: 14 }}>
          No evidence uploaded yet. Upload a real document (a training log, backup procedure, config export) to
          see which checklist items it closes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {items.map((item) => (
            <div key={item.id} className="evidence-card">
              <div className="evidence-card-head">
                <div>
                  <div className="evidence-card-name">{item.original_name}</div>
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    {item.source === 'github' ? 'Synced from GitHub' : `${(item.size_bytes / 1024).toFixed(0)} KB`}
                    {' · '}{timeAgo(item.uploaded_at)}
                    {item.model && item.source !== 'github' && ` · via ${item.model}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`status-badge ${STATUS_CLASS[item.status] || ''}`}>{STATUS_LABEL[item.status] || item.status}</span>
                  <button className="secondary" style={{ marginTop: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => remove(item.id)}>Remove</button>
                </div>
              </div>

              {item.summary && <div className="evidence-summary">{item.summary}</div>}
              {item.status === 'unsupported' && <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>{item.error}</div>}
              {item.status === 'failed' && <div className="error" style={{ fontSize: 12, marginTop: 4 }}>{item.error}</div>}

              {item.mapped_controls?.length > 0 && (
                <div className="evidence-mapped-controls">
                  {item.mapped_controls.map((m, i) => (
                    <span key={i} className={`confidence-badge confidence-${m.confidence}`} title={m.reasoning || ''}>
                      {targetLabel(m.framework, m.key)} · {CONFIDENCE_LABEL[m.confidence]}
                    </span>
                  ))}
                </div>
              )}
              {item.status === 'analyzed' && item.mapped_controls?.length === 0 && (
                <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
                  Analyzed, but didn't clearly match any checklist item.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
