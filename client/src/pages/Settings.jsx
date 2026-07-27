import { useRef, useState } from 'react';
import { api } from '../api/client';
import { IconBuilding, IconUser, IconTrash } from '../components/Icons';

const SIZE_BANDS = ['1-10', '11-50', '51-200', '200+'];
const DATA_TYPE_OPTIONS = ['customer_pii', 'payment_data', 'health_data', 'employee_data', 'usage_analytics'];
const CLOUD_OPTIONS = ['aws', 'gcp', 'azure', 'on_prem', 'other'];

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function formFromCompany(company) {
  return {
    name: company.name || '',
    industry: company.industry || '',
    size_band: company.size_band || SIZE_BANDS[0],
    country: company.country || '',
    contact_email: company.contact_email || '',
    processes_pii: !!company.processes_pii,
    processes_eu_data: !!company.processes_eu_data,
    data_types: company.data_types || [],
    cloud_providers: company.cloud_providers || [],
    tools_used: (company.tools_used || []).join(', '),
    ai_systems_used: (company.ai_systems_used || []).join(', '),
    notes: company.notes || '',
  };
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginTop: 26, marginBottom: 4 }}>
      {children}
    </div>
  );
}

export default function Settings({ company, userName, onCompanyUpdated, onAccountUpdated, onAlertsCreated }) {
  const [form, setForm] = useState(() => formFromCompany(company));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAlerts, setSavedAlerts] = useState(null);

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef(null);

  const [accountName, setAccountName] = useState(userName || '');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSavedAlerts(null);
    try {
      const payload = {
        ...form,
        tools_used: form.tools_used.split(',').map((s) => s.trim()).filter(Boolean),
        ai_systems_used: form.ai_systems_used.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const { company: updated, alerts } = await api.updateCompany(company.id, payload);
      onCompanyUpdated?.(updated);
      setForm(formFromCompany(updated));
      setSavedAlerts(alerts);
      if (alerts?.length) onAlertsCreated?.(alerts);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    setLogoBusy(true);
    try {
      const updated = await api.uploadCompanyLogo(company.id, file);
      onCompanyUpdated?.(updated);
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeLogo() {
    setLogoError('');
    setLogoBusy(true);
    try {
      const updated = await api.removeCompanyLogo(company.id);
      onCompanyUpdated?.(updated);
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveAccountName(e) {
    e.preventDefault();
    setAccountError('');
    setAccountSaved(false);
    setSavingAccount(true);
    try {
      const updated = await api.updateMe(accountName);
      onAccountUpdated?.(updated);
      setAccountSaved(true);
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setSavingAccount(false);
    }
  }

  return (
    <div>
      <h2 className="section-heading">Settings</h2>
      <div className="section-subheading">Manage {company.name}'s profile and your own account.</div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBuilding size={16} />
          <h3 style={{ margin: 0 }}>Company profile</h3>
        </div>
        <div className="meta" style={{ marginTop: 4 }}>
          Keep this up to date — changes here (new vendors, new AI systems, new data types) are what
          drive the business-change alerts on your dashboard.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div className="settings-logo-preview">
            {company.logo_data_url
              ? <img src={company.logo_data_url} alt="" />
              : <span>{company.name?.[0]?.toUpperCase() || '?'}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Company logo</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoChange}
                disabled={logoBusy}
                style={{ display: 'none' }}
                id="logo-file-input"
              />
              <button type="button" className="secondary" style={{ marginTop: 0, fontSize: 12 }} disabled={logoBusy} onClick={() => fileInputRef.current?.click()}>
                {logoBusy ? 'Uploading…' : company.logo_data_url ? 'Replace logo' : 'Upload logo'}
              </button>
              {company.logo_data_url && (
                <button type="button" className="secondary" style={{ marginTop: 0, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} disabled={logoBusy} onClick={removeLogo}>
                  <IconTrash size={12} /> Remove
                </button>
              )}
            </div>
            <div className="tag-hint" style={{ marginTop: 6 }}>PNG, JPG, or WEBP, 500KB max — shown in the sidebar and on your company card.</div>
            {logoError && <div className="error" style={{ fontSize: 12 }}>{logoError}</div>}
          </div>
        </div>

        <form onSubmit={submit}>
          <SectionLabel>Basic information</SectionLabel>
          <div className="grid">
            <div>
              <label>Company name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Industry</label>
              <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} required />
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
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
          </div>

          <SectionLabel>Data & compliance signals</SectionLabel>
          <label style={{ marginTop: 8 }}>
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

          <SectionLabel>Tools, vendors & AI systems</SectionLabel>
          <label style={{ marginTop: 8 }}>Tools & vendors used</label>
          <div className="tag-hint">Comma-separated — e.g. Stripe, GitHub, Google Workspace, Slack</div>
          <input
            value={form.tools_used}
            onChange={(e) => setForm({ ...form, tools_used: e.target.value })}
          />

          <label>AI systems used or built</label>
          <div className="tag-hint">Comma-separated — e.g. GPT-4 API customer chatbot, internal fraud-detection model</div>
          <input
            value={form.ai_systems_used}
            onChange={(e) => setForm({ ...form, ai_systems_used: e.target.value })}
          />

          <SectionLabel>Notes</SectionLabel>
          <textarea
            style={{ marginTop: 8 }}
            placeholder="Anything else relevant: existing certifications, target audit date, specific systems…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {error && <div className="error">{error}</div>}
          {savedAlerts && (
            <div className="data-notice data-notice-local" style={{ marginTop: 12 }}>
              Saved.{' '}
              {savedAlerts.length
                ? `${savedAlerts.length} new alert${savedAlerts.length === 1 ? '' : 's'} raised on the dashboard from this change.`
                : 'No new compliance-relevant changes detected.'}
            </div>
          )}
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconUser size={16} />
          <h3 style={{ margin: 0 }}>Your account</h3>
        </div>
        <div className="meta" style={{ marginTop: 4, marginBottom: 14 }}>
          Your display name, shown in the sidebar and on generated reports.
        </div>
        <form onSubmit={saveAccountName} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ marginTop: 0 }}>Display name</label>
            <input value={accountName} onChange={(e) => { setAccountName(e.target.value); setAccountSaved(false); }} placeholder="Your name" />
          </div>
          <button type="submit" disabled={savingAccount} style={{ marginTop: 0 }}>{savingAccount ? 'Saving…' : 'Save'}</button>
        </form>
        {accountError && <div className="error">{accountError}</div>}
        {accountSaved && <div className="data-notice data-notice-local" style={{ marginTop: 12 }}>Saved.</div>}
      </div>
    </div>
  );
}
