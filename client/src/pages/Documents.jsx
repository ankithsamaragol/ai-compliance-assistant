import { useState } from 'react';
import { api, getToken } from '../api/client';
import ProviderNotice from '../components/ProviderNotice';
import PanelHeader from '../components/PanelHeader';
import { IconSearch, IconSparkle, IconDocument, IconCheckCircle } from '../components/Icons';

const PAGE_SIZE = 6;

export default function Documents({
  company, catalog, providers, provider, setProvider,
  framework, setFramework, docType, setDocType,
  documents, setDocuments, activeDoc, setActiveDoc, onGapRefresh,
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [consistency, setConsistency] = useState(null);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const [consistencyError, setConsistencyError] = useState('');

  const currentFrameworkDocTypes = catalog.find((f) => f.key === framework)?.docTypes || [];
  const currentProvider = providers.find((p) => p.key === provider);
  const realDocuments = documents.filter((d) => d.framework !== 'executive_report');
  const readyCount = realDocuments.filter((d) => d.status === 'ready').length;

  const q = search.trim().toLowerCase();
  const filteredDocuments = q
    ? realDocuments.filter((d) => d.title.toLowerCase().includes(q) || d.framework.replace('_', ' ').toLowerCase().includes(q))
    : realDocuments;

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageDocuments = filteredDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  async function generate() {
    setError('');
    setGenerating(true);
    try {
      const doc = await api.generateDocument(company.id, framework, docType, provider);
      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
      onGapRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function runConsistencyCheck() {
    setConsistencyError('');
    setCheckingConsistency(true);
    try {
      setConsistency(await api.checkDocumentConsistency(company.id, provider));
    } catch (err) {
      setConsistencyError(err.message);
    } finally {
      setCheckingConsistency(false);
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
    <>
      <div className="panel">
        <PanelHeader
          icon={<IconSparkle size={16} />}
          title="Generate a document"
          description="AI-drafted from this company's actual profile — not a generic template."
        />
        <div className="grid" style={{ marginTop: 14 }}>
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
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Generator</span>
              <ProviderNotice provider={currentProvider} />
            </label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button onClick={generate} disabled={generating || !framework || !docType}>
          {generating ? 'Generating…' : 'Generate document'}
        </button>
      </div>

      <div className="panel">
        <PanelHeader
          icon={<IconDocument size={16} />}
          title="Documents"
          action={realDocuments.length > 0 && (
            <div className="doc-search" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)' }}><IconSearch size={14} /></span>
              <input
                placeholder="Search by title or framework…"
                value={search}
                onChange={(e) => updateSearch(e.target.value)}
                style={{ paddingLeft: 30, width: 220 }}
              />
            </div>
          )}
        />

        <div className="doc-grid">
          {pageDocuments.map((doc) => (
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
          {realDocuments.length === 0 && <div className="meta">No documents generated yet.</div>}
          {realDocuments.length > 0 && filteredDocuments.length === 0 && (
            <div className="meta">No documents match "{search}".</div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              ← Previous
            </button>
            <span className="meta" style={{ fontSize: 12 }}>Page {currentPage} of {totalPages}</span>
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <PanelHeader
          icon={<IconCheckCircle size={16} />}
          title="Cross-document consistency"
          description="Checks whether retention period, breach-notification timing, and privacy contact agree across your generated documents."
          action={(
            <button style={{ marginTop: 0 }} onClick={runConsistencyCheck} disabled={checkingConsistency || readyCount < 2}>
              {checkingConsistency ? 'Checking…' : 'Check consistency'}
            </button>
          )}
        />
        {readyCount < 2 && <div className="meta" style={{ marginTop: 8 }}>Generate at least 2 documents to run this check.</div>}
        {consistencyError && <div className="error">{consistencyError}</div>}
        {consistency && (
          consistency.findings.length === 0 ? (
            <div className="meta" style={{ marginTop: 12 }}>
              No inconsistencies found across {consistency.checkedCount} document{consistency.checkedCount === 1 ? '' : 's'}.
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {consistency.findings.map((f) => (
                <div key={f.factKey} className="priority-item" style={{ display: 'block' }}>
                  <div className="priority-item-title">{f.label} is stated differently across documents</div>
                  {f.documents.map((d) => (
                    <div key={d.id} className="priority-item-meta" style={{ marginTop: 2 }}>
                      <strong>{d.title}</strong>: "{d.raw}" → {d.value}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {activeDoc?.content_md && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{activeDoc.title}</h3>
          <div className="doc-preview">{activeDoc.content_md}</div>
        </div>
      )}
    </>
  );
}
