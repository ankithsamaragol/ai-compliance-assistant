import { useEffect, useState } from 'react';
import { api } from '../api/client';

const SIZE_BANDS = ['1-10', '11-50', '51-200', '200+'];
const DATA_TYPE_OPTIONS = ['customer_pii', 'payment_data', 'health_data', 'employee_data', 'usage_analytics'];
const CLOUD_OPTIONS = ['aws', 'gcp', 'azure', 'on_prem', 'other'];

function emptyForm() {
  return {
    name: '', industry: '', size_band: SIZE_BANDS[0], country: '', contact_email: '',
    processes_pii: false, processes_eu_data: false,
    data_types: [], cloud_providers: [], tools_used: '', notes: '',
  };
}

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function Dashboard({ onOpenCompany }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listCompanies().then(setCompanies).catch((err) => setError(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        tools_used: form.tools_used.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const company = await api.createCompany(payload);
      setCompanies((prev) => [company, ...prev]);
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Companies</h2>
          <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New company'}</button>
        </div>

        {showForm && (
          <form onSubmit={submit} style={{ marginTop: 12 }}>
            <div className="grid">
              <div>
                <label>Company name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label>Industry</label>
                <input
                  placeholder="e.g. SaaS, manufacturing, healthcare"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Size</label>
                <select value={form.size_band} onChange={(e) => setForm({ ...form, size_band: e.target.value })}>
                  {SIZE_BANDS.map((s) => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
              <div>
                <label>Country</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
              </div>
              <div>
                <label>Contact email</label>
                <input
                  type="email"
                  placeholder="compliance@company.com"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
            </div>

            <label style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                style={{ width: 'auto', marginRight: 8 }}
                checked={form.processes_pii}
                onChange={(e) => setForm({ ...form, processes_pii: e.target.checked })}
              />
              Processes personal data (PII)
            </label>
            <label>
              <input
                type="checkbox"
                style={{ width: 'auto', marginRight: 8 }}
                checked={form.processes_eu_data}
                onChange={(e) => setForm({ ...form, processes_eu_data: e.target.checked })}
              />
              Processes EU resident data
            </label>

            <label>Data types handled</label>
            <div className="tag-hint">Click to toggle</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {DATA_TYPE_OPTIONS.map((dt) => (
                <button
                  type="button"
                  key={dt}
                  className="secondary"
                  style={{
                    marginTop: 0, padding: '4px 10px', fontSize: 12,
                    background: form.data_types.includes(dt) ? 'var(--accent)' : 'transparent',
                    color: form.data_types.includes(dt) ? 'white' : 'var(--text)',
                  }}
                  onClick={() => setForm({ ...form, data_types: toggleInArray(form.data_types, dt) })}
                >
                  {dt.replace('_', ' ')}
                </button>
              ))}
            </div>

            <label>Cloud providers</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {CLOUD_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="secondary"
                  style={{
                    marginTop: 0, padding: '4px 10px', fontSize: 12,
                    background: form.cloud_providers.includes(c) ? 'var(--accent)' : 'transparent',
                    color: form.cloud_providers.includes(c) ? 'white' : 'var(--text)',
                  }}
                  onClick={() => setForm({ ...form, cloud_providers: toggleInArray(form.cloud_providers, c) })}
                >
                  {c}
                </button>
              ))}
            </div>

            <label>Tools & vendors used</label>
            <div className="tag-hint">Comma-separated — e.g. Stripe, GitHub, Google Workspace, Slack</div>
            <input
              placeholder="Stripe, GitHub, Google Workspace"
              value={form.tools_used}
              onChange={(e) => setForm({ ...form, tools_used: e.target.value })}
            />

            <label>Notes (optional)</label>
            <textarea
              placeholder="Anything else relevant: existing certifications, target audit date, specific systems…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save company'}</button>
          </form>
        )}
      </div>

      <ul className="company-list">
        {companies.map((c) => (
          <li key={c.id} onClick={() => onOpenCompany(c)}>
            <div>
              <div>{c.name}</div>
              <div className="meta">{c.industry} · {c.size_band} · {c.country}</div>
            </div>
            <span className="meta">View →</span>
          </li>
        ))}
        {companies.length === 0 && !showForm && <div className="meta">No companies yet. Add one to get started.</div>}
      </ul>
    </div>
  );
}
