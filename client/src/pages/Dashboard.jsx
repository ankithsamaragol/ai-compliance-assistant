import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { IconBuilding, IconShieldCheck, IconFileText, IconBook, IconSearch } from '../components/Icons';

const SIZE_BANDS = ['1-10', '11-50', '51-200', '200+'];
const DATA_TYPE_OPTIONS = ['customer_pii', 'payment_data', 'health_data', 'employee_data', 'usage_analytics'];
const CLOUD_OPTIONS = ['aws', 'gcp', 'azure', 'on_prem', 'other'];

function emptyForm() {
  return {
    name: '', industry: '', size_band: SIZE_BANDS[0], country: '', contact_email: '',
    processes_pii: false, processes_eu_data: false,
    data_types: [], cloud_providers: [], tools_used: '', ai_systems_used: '', notes: '',
  };
}

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function scoreColor(score) {
  if (score >= 75) return 'var(--accent)';
  if (score >= 40) return '#b8860b';
  return 'var(--danger)';
}

const FRAMEWORK_SHORT = {
  iso27001: 'ISO 27001', gdpr: 'GDPR', cmmc: 'CMMC', iso42001: 'ISO 42001',
  risk_assessment: 'Risk', audit_evidence: 'Audit',
};

export default function Dashboard({ onOpenCompany }) {
  const [companies, setCompanies] = useState([]);
  const [gapByCompany, setGapByCompany] = useState({});
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listCompanies().then((data) => {
      setCompanies(data);
      data.forEach((c) => {
        api.getGapAnalysis(c.id).then((gap) => {
          setGapByCompany((prev) => ({ ...prev, [c.id]: gap }));
        }).catch(() => {});
      });
    }).catch((err) => setError(err.message));
  }, []);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [companies, search],
  );

  const totals = useMemo(() => {
    const gaps = Object.values(gapByCompany);
    const avgReadiness = gaps.length
      ? Math.round(gaps.reduce((sum, g) => {
        const frameworkAvg = g.frameworks.reduce((s, f) => s + f.score, 0) / g.frameworks.length;
        return sum + frameworkAvg;
      }, 0) / gaps.length)
      : 0;
    const totalDocuments = gaps.reduce((sum, g) => sum + g.documentsReady, 0);
    const frameworkCount = gaps[0]?.frameworks.length || 0;
    return { avgReadiness, totalDocuments, frameworkCount };
  }, [gapByCompany]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        tools_used: form.tools_used.split(',').map((s) => s.trim()).filter(Boolean),
        ai_systems_used: form.ai_systems_used.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const company = await api.createCompany(payload);
      setCompanies((prev) => [company, ...prev]);
      api.getGapAnalysis(company.id).then((gap) => {
        setGapByCompany((prev) => ({ ...prev, [company.id]: gap }));
      }).catch(() => {});
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h2 className="section-heading" style={{ marginBottom: 4 }}>Your Companies</h2>
          <div className="meta">Manage and monitor compliance across all your organizations.</div>
        </div>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New company'}</button>
      </div>

      {companies.length > 0 && (
        <div className="stats-bar">
          <div className="stat-tile">
            <div className="stat-tile-icon"><IconBuilding size={18} /></div>
            <div><div className="stat-tile-value">{companies.length}</div><div className="stat-tile-label">Total companies</div></div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-icon"><IconShieldCheck size={18} /></div>
            <div><div className="stat-tile-value">{totals.avgReadiness}%</div><div className="stat-tile-label">Average readiness</div></div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-icon"><IconFileText size={18} /></div>
            <div><div className="stat-tile-value">{totals.totalDocuments}</div><div className="stat-tile-label">Total documents</div></div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-icon"><IconBook size={18} /></div>
            <div><div className="stat-tile-value">{totals.frameworkCount}</div><div className="stat-tile-label">Frameworks tracked</div></div>
          </div>
        </div>
      )}

      {companies.length > 0 && (
        <div className="company-search" style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: 10, color: 'var(--muted)' }}><IconSearch size={16} /></span>
          <input
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      )}

      {showForm && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>New company</h3>
          <form onSubmit={submit}>
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

            <label>AI systems used or built</label>
            <div className="tag-hint">Comma-separated — e.g. GPT-4 API customer chatbot, internal fraud-detection model</div>
            <input
              placeholder="GPT-4 API customer chatbot, internal recommendation model"
              value={form.ai_systems_used}
              onChange={(e) => setForm({ ...form, ai_systems_used: e.target.value })}
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
        </div>
      )}

      {companies.length === 0 && !showForm && (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No companies yet</div>
          <div className="meta">Add a company to start generating compliance documents.</div>
        </div>
      )}

      {companies.length > 0 && filteredCompanies.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div className="meta">No companies match "{search}".</div>
        </div>
      )}

      <div className="company-grid">
        {filteredCompanies.map((c) => {
          const gap = gapByCompany[c.id];
          return (
            <div className="company-card" key={c.id} onClick={() => onOpenCompany(c)}>
              {c.logo_data_url && <img className="company-card-logo" src={c.logo_data_url} alt="" />}
              <div className="company-card-name">{c.name}</div>
              <div className="meta">{c.industry}</div>
              <div className="meta">{c.size_band} employees · {c.country}</div>
              {gap && (
                <div className="framework-pill-row">
                  {gap.frameworks.map((fw) => (
                    <span key={fw.key} className="framework-pill" style={{ color: scoreColor(fw.score) }}>
                      {FRAMEWORK_SHORT[fw.key] || fw.label} {fw.score}%
                    </span>
                  ))}
                </div>
              )}
              <div className="company-card-footer">
                <span className="meta">Updated {new Date(c.updated_at || c.created_at).toLocaleDateString()}</span>
                <span className="view-link">Open workspace →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
