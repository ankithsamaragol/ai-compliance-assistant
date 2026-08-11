import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ProviderNotice from '../components/ProviderNotice';
import PanelHeader from '../components/PanelHeader';
import { IconBuilding } from '../components/Icons';

const TIER_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export default function VendorRegister({ company, providers, provider, setProvider, onChange }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listVendors(company.id).then(setVendors).catch((err) => setError(err.message));
  }, [company.id]);

  const currentProvider = providers.find((p) => p.key === provider);

  async function detect() {
    setError('');
    setLoading(true);
    try {
      const { vendors: rows } = await api.detectVendors(company.id, provider);
      setVendors(rows);
      onChange?.(rows.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    try {
      await api.deleteVendor(id);
      setVendors((prev) => {
        const next = prev.filter((v) => v.id !== id);
        onChange?.(next.length);
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <PanelHeader
        icon={<IconBuilding size={16} />}
        title="Vendor Risk Register"
        description="Auto-detected from cloud providers and tools used in the company profile."
        action={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ProviderNotice provider={currentProvider} />
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button onClick={detect} disabled={loading} style={{ marginTop: 0 }}>
              {loading ? 'Detecting…' : vendors.length ? 'Re-detect vendors' : 'Detect vendors'}
            </button>
          </div>
        )}
      />

      {error && <div className="error">{error}</div>}

      {vendors.length === 0 ? (
        <div className="meta" style={{ marginTop: 14 }}>
          No vendors detected yet. Add tools/cloud providers to the company profile, then click "Detect vendors".
        </div>
      ) : (
        <div className="vendor-card-grid">
          {vendors.map((v) => (
            <div key={v.id} className="vendor-card">
              <div className="vendor-card-head">
                <div>
                  <div className="vendor-card-name">{v.name}</div>
                  <div className="vendor-card-category">{v.category.replace('_', ' ')}</div>
                </div>
                <span className={`tier-badge tier-${v.risk_tier}`}>{TIER_LABEL[v.risk_tier] || v.risk_tier}</span>
              </div>

              {v.reasoning && <div className="vendor-card-reasoning">{v.reasoning}</div>}

              {v.recommended_controls?.length > 0 && (
                <div className="vendor-card-controls">
                  {v.recommended_controls.map((c, i) => <span key={i} className="control-chip">{c}</span>)}
                </div>
              )}

              <div className="vendor-card-foot">
                <span className="meta" style={{ fontSize: 11.5 }}>Review {v.review_frequency || 'not set'}</span>
                <button className="secondary" style={{ marginTop: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => remove(v.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
