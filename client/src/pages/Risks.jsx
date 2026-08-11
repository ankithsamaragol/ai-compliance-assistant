import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ProviderNotice from '../components/ProviderNotice';
import PanelHeader from '../components/PanelHeader';
import { IconAlertTriangle } from '../components/Icons';

const LEVEL_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const CATEGORY_LABEL = {
  operational: 'Operational', technical: 'Technical', vendor: 'Vendor', data: 'Data', personnel: 'Personnel', other: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);
const LEVELS = ['low', 'medium', 'high'];
const STATUSES = ['open', 'mitigated', 'accepted'];

const EMPTY_FORM = { title: '', description: '', category: 'operational', likelihood: 'medium', impact: 'medium', mitigation: '', owner: '' };

export default function Risks({ company, providers, provider, setProvider, onChange }) {
  const [risks, setRisks] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listRisks(company.id).then(setRisks).catch((err) => setError(err.message));
  }, [company.id]);

  const currentProvider = providers.find((p) => p.key === provider);

  function updateLocal(rows) {
    setRisks(rows);
    onChange?.(rows.length);
  }

  async function suggest() {
    setError('');
    setSuggesting(true);
    try {
      const { risks: rows } = await api.suggestRisks(company.id, provider);
      updateLocal(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggesting(false);
    }
  }

  async function addRisk(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const created = await api.createRisk({ companyId: company.id, ...form });
      updateLocal([...risks, created]);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(risk, status) {
    try {
      const updated = await api.updateRisk(risk.id, { status });
      updateLocal(risks.map((r) => (r.id === risk.id ? updated : r)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api.deleteRisk(id);
      updateLocal(risks.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <PanelHeader
        icon={<IconAlertTriangle size={16} />}
        title="Risk Register"
        description="Company-specific risks — AI-suggested from your profile, vendors, and compliance gaps, or added by hand. Severity is always computed from likelihood × impact, never picked directly."
        action={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ProviderNotice provider={currentProvider} />
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button className="secondary" style={{ marginTop: 0 }} onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? 'Cancel' : '+ Add risk'}
            </button>
            <button onClick={suggest} disabled={suggesting} style={{ marginTop: 0 }}>
              {suggesting ? 'Analyzing…' : risks.length ? 'Re-suggest risks' : 'Suggest risks'}
            </button>
          </div>
        )}
      />

      {error && <div className="error">{error}</div>}

      {formOpen && (
        <form onSubmit={addRisk} className="panel" style={{ marginTop: 14, background: 'var(--surface-2, transparent)' }}>
          <div className="grid">
            <div>
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label>Likelihood</label>
              <select value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label>Impact</label>
              <select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label>Owner (optional)</label>
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
          </div>
          <label>Description (optional)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Mitigation (optional)</label>
          <textarea rows={2} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} />
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save risk'}</button>
        </form>
      )}

      {risks.length === 0 ? (
        <div className="meta" style={{ marginTop: 14 }}>
          No risks logged yet. Click "Suggest risks" for an AI-drafted starting list based on your
          profile and current gaps, or add one by hand.
        </div>
      ) : (
        <div className="vendor-card-grid">
          {risks.map((r) => (
            <div key={r.id} className="vendor-card">
              <div className="vendor-card-head">
                <div>
                  <div className="vendor-card-name">{r.title}</div>
                  <div className="vendor-card-category">{CATEGORY_LABEL[r.category] || r.category}</div>
                </div>
                <span className={`tier-badge tier-${r.risk_level}`}>{LEVEL_LABEL[r.risk_level] || r.risk_level}</span>
              </div>

              {r.description && <div className="vendor-card-reasoning">{r.description}</div>}
              {r.mitigation && (
                <div className="vendor-card-reasoning" style={{ marginTop: r.description ? 6 : 10 }}>
                  <strong style={{ color: 'var(--text)' }}>Mitigation:</strong> {r.mitigation}
                </div>
              )}
              {r.owner && <div className="vendor-card-reasoning" style={{ marginTop: 6 }}>Owner: {r.owner}</div>}

              <div className="vendor-card-foot">
                <select value={r.status} onChange={(e) => setStatus(r, e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
                <button className="secondary" style={{ marginTop: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => remove(r.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
