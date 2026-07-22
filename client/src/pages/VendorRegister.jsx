import { useEffect, useState } from 'react';
import { api } from '../api/client';

const TIER_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export default function VendorRegister({ company, providers, provider, setProvider }) {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    try {
      await api.deleteVendor(id);
      setVendors((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Vendor Risk Register</h3>
          <div className="meta" style={{ marginTop: 4 }}>
            Auto-detected from cloud providers and tools used in the company profile.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
            {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={detect} disabled={loading} style={{ marginTop: 0 }}>
            {loading ? 'Detecting…' : vendors.length ? 'Re-detect vendors' : 'Detect vendors'}
          </button>
        </div>
      </div>

      {currentProvider?.dataNotice && (
        <div className={`data-notice ${currentProvider.local ? 'data-notice-local' : 'data-notice-cloud'}`} style={{ marginTop: 12 }}>
          {currentProvider.local ? '🔒' : '☁️'} {currentProvider.dataNotice}
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {vendors.length === 0 ? (
        <div className="meta" style={{ marginTop: 14 }}>
          No vendors detected yet. Add tools/cloud providers to the company profile, then click "Detect vendors".
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table className="vendor-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Risk</th>
                <th>Reasoning</th>
                <th>Recommended controls</th>
                <th>Review</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="vendor-name">{v.name}</td>
                  <td>{v.category.replace('_', ' ')}</td>
                  <td><span className={`tier-badge tier-${v.risk_tier}`}>{TIER_LABEL[v.risk_tier] || v.risk_tier}</span></td>
                  <td className="vendor-reasoning">{v.reasoning}</td>
                  <td>
                    <ul className="control-list">
                      {(v.recommended_controls || []).map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </td>
                  <td>{v.review_frequency}</td>
                  <td><button className="secondary" style={{ marginTop: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => remove(v.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
