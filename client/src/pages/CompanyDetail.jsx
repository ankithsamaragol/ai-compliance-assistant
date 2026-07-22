import { useEffect, useState } from 'react';
import { api, getToken } from '../api/client';

export default function CompanyDetail({ company, onBack }) {
  const [catalog, setCatalog] = useState([]);
  const [providers, setProviders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [framework, setFramework] = useState('');
  const [docType, setDocType] = useState('');
  const [provider, setProvider] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    api.getCatalog().then((data) => {
      setCatalog(data);
      if (data[0]) {
        setFramework(data[0].key);
        setDocType(data[0].docTypes[0]?.key || '');
      }
    }).catch((err) => setError(err.message));
    api.getProviders().then((data) => {
      setProviders(data);
      if (data[0]) setProvider(data[0].key);
    }).catch((err) => setError(err.message));
    refreshDocuments();
  }, [company.id]);

  function refreshDocuments() {
    api.listDocuments(company.id).then(setDocuments).catch((err) => setError(err.message));
  }

  const currentFrameworkDocTypes = catalog.find((f) => f.key === framework)?.docTypes || [];
  const currentProvider = providers.find((p) => p.key === provider);

  async function generate() {
    setError('');
    setGenerating(true);
    try {
      const doc = await api.generateDocument(company.id, framework, docType, provider);
      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function openDoc(docSummary) {
    const doc = await api.getDocument(docSummary.id);
    setActiveDoc(doc);
  }

  async function download(doc) {
    const res = await fetch(api.exportDocumentUrl(doc.id), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { setError('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-z0-9]+/gi, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <span className="back-link" onClick={onBack}>← Back to companies</span>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{company.name}</h2>
        <div className="meta">{company.industry} · {company.size_band} employees · {company.country}</div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Generate a document</h3>
        <div className="grid">
          <div>
            <label>Framework</label>
            <select value={framework} onChange={(e) => {
              setFramework(e.target.value);
              const dt = catalog.find((f) => f.key === e.target.value)?.docTypes[0]?.key || '';
              setDocType(dt);
            }}>
              {catalog.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label>Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {currentFrameworkDocTypes.map((dt) => <option key={dt.key} value={dt.key}>{dt.title}</option>)}
            </select>
          </div>
          <div>
            <label>Generator</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        </div>
        {currentProvider?.dataNotice && (
          <div className={`data-notice ${currentProvider.local ? 'data-notice-local' : 'data-notice-cloud'}`}>
            {currentProvider.local ? '🔒' : '☁️'} {currentProvider.dataNotice}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <button onClick={generate} disabled={generating || !framework || !docType}>
          {generating ? 'Generating…' : 'Generate document'}
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Documents</h3>
        <div className="doc-grid">
          {documents.map((doc) => (
            <div className="doc-card" key={doc.id}>
              <span className="framework">{doc.framework.replace('_', ' ')}</span>
              <span className="title">{doc.title}</span>
              <span className={`status-badge status-${doc.status}`}>{doc.status}</span>
              {doc.provider && <span className="meta" style={{ fontSize: 11 }}>via {doc.model || doc.provider}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                {doc.status === 'ready' && (
                  <>
                    <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={() => openDoc(doc)}>Preview</button>
                    <button style={{ marginTop: 0, fontSize: 12 }} onClick={() => download(doc)}>Download .docx</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {documents.length === 0 && <div className="meta">No documents generated yet.</div>}
        </div>
      </div>

      {activeDoc?.content_md && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{activeDoc.title}</h3>
          <div className="doc-preview">{activeDoc.content_md}</div>
        </div>
      )}
    </div>
  );
}
