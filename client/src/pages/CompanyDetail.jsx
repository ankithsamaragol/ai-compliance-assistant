import { useEffect, useState } from 'react';
import { api, getToken } from '../api/client';
import VendorRegister from './VendorRegister';
import Evidence from './Evidence';
import Timeline from './Timeline';
import ComplianceGapAnalysis from './ComplianceGapAnalysis';
import ComplianceChat from './ComplianceChat';
import {
  IconHome, IconSparkle, IconDocument, IconAlertTriangle, IconBuilding, IconBook,
  IconShieldCheck, IconClipboard, IconCheckSquare, IconFileText, IconClock, IconSettings,
  IconChevronDown,
} from '../components/Icons';

const NAV = [
  { key: 'overview', label: 'Dashboard', icon: IconHome, enabled: true },
  { key: 'chat', label: 'AI Compliance Officer', icon: IconSparkle, enabled: true },
  { key: 'documents', label: 'Documents', icon: IconDocument, enabled: true },
  { key: 'risks', label: 'Risks', icon: IconAlertTriangle, enabled: false },
  { key: 'vendors', label: 'Vendors', icon: IconBuilding, enabled: true },
  { key: 'frameworks', label: 'Frameworks', icon: IconBook, enabled: false },
  { key: 'controls', label: 'Controls', icon: IconShieldCheck, enabled: false },
  { key: 'evidence', label: 'Evidence', icon: IconClipboard, enabled: true },
  { key: 'tasks', label: 'Tasks & Actions', icon: IconCheckSquare, enabled: false },
  { key: 'reports', label: 'Reports', icon: IconFileText, enabled: false },
  { key: 'timeline', label: 'Timeline', icon: IconClock, enabled: true },
  { key: 'settings', label: 'Settings', icon: IconSettings, enabled: false },
];

export default function CompanyDetail({ company, onBack, userName, userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [catalog, setCatalog] = useState([]);
  const [providers, setProviders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [framework, setFramework] = useState('');
  const [docType, setDocType] = useState('');
  const [provider, setProvider] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeDoc, setActiveDoc] = useState(null);
  const [gapRefreshKey, setGapRefreshKey] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayName = userName || userEmail;
  const initials = displayName ? displayName[0].toUpperCase() : '?';

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
    api.listVendors(company.id).then((v) => setVendorCount(v.length)).catch(() => {});
    api.listEvidence(company.id).then((v) => setEvidenceCount(v.length)).catch(() => {});
    refreshDocuments();
  }, [company.id]);

  function refreshDocuments() {
    api.listDocuments(company.id).then(setDocuments).catch((err) => setError(err.message));
  }

  const currentFrameworkDocTypes = catalog.find((f) => f.key === framework)?.docTypes || [];
  const currentProvider = providers.find((p) => p.key === provider);
  const realDocuments = documents.filter((d) => d.framework !== 'executive_report');

  function jumpToGenerate(fw, dt) {
    setFramework(fw);
    setDocType(dt);
    setActiveTab('documents');
  }

  function jumpToVendors() {
    setActiveTab('vendors');
  }

  async function generate() {
    setError('');
    setGenerating(true);
    try {
      const doc = await api.generateDocument(company.id, framework, docType, provider);
      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
      setGapRefreshKey((k) => k + 1);
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
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand" onClick={onBack} title="Back to companies">
          <div className="workspace-brand-mark"><IconShieldCheck size={18} /></div>
          <div>
            <div className="workspace-brand-name">Compliance Officer</div>
            <div className="workspace-brand-sub">AI-Powered Compliance</div>
          </div>
        </div>

        <div className="workspace-company-switch">
          <IconBuilding size={14} />
          <span>{company.name}</span>
          <span className="switch-link" onClick={onBack}>Switch</span>
        </div>

        <nav className="workspace-nav">
          {NAV.map((tab) => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.key}
                className={`workspace-nav-item ${activeTab === tab.key ? 'active' : ''} ${tab.enabled ? '' : 'disabled'}`}
                onClick={() => tab.enabled && setActiveTab(tab.key)}
                title={tab.enabled ? undefined : 'Coming soon'}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.key === 'documents' && <span className="workspace-nav-badge">{realDocuments.length}</span>}
                {tab.key === 'vendors' && <span className="workspace-nav-badge">{vendorCount}</span>}
                {tab.key === 'evidence' && <span className="workspace-nav-badge">{evidenceCount}</span>}
                {!tab.enabled && <span className="workspace-nav-soon">Soon</span>}
              </div>
            );
          })}
        </nav>

        <div className="workspace-sidebar-spacer" />

        <div className="workspace-user" onClick={() => setUserMenuOpen((v) => !v)}>
          <div className="workspace-user-avatar">{initials}</div>
          <div className="workspace-user-meta">
            <span className="workspace-user-name">{displayName || 'Account'}</span>
            <span className="workspace-user-role">Admin</span>
          </div>
          <IconChevronDown size={14} />
          {userMenuOpen && (
            <div className="workspace-user-menu" onClick={(e) => e.stopPropagation()}>
              <button className="secondary" style={{ width: '100%', marginTop: 0 }} onClick={onLogout}>Log out</button>
            </div>
          )}
        </div>
      </aside>

      <main className="workspace-main">
          {activeTab === 'overview' && (
            <ComplianceGapAnalysis
              company={company}
              userName={userName}
              refreshKey={gapRefreshKey}
              documents={documents}
              onSelectDocumentAction={jumpToGenerate}
              onSelectVendorAction={jumpToVendors}
              onNavigateToChat={() => setActiveTab('chat')}
              provider={provider}
              onReportGenerated={(doc) => {
                setDocuments((prev) => [doc, ...prev]);
                setActiveDoc(doc);
                setActiveTab('documents');
              }}
            />
          )}

          {activeTab === 'documents' && (
            <>
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
            </>
          )}

          {activeTab === 'vendors' && providers.length > 0 && (
            <VendorRegister
              company={company}
              providers={providers}
              provider={provider}
              setProvider={setProvider}
              onChange={(count) => {
                setGapRefreshKey((k) => k + 1);
                if (typeof count === 'number') setVendorCount(count);
                else api.listVendors(company.id).then((v) => setVendorCount(v.length)).catch(() => {});
              }}
            />
          )}

          {activeTab === 'chat' && providers.length > 0 && (
            <ComplianceChat company={company} providers={providers} provider={provider} setProvider={setProvider} />
          )}

          {activeTab === 'evidence' && providers.length > 0 && (
            <Evidence
              company={company}
              providers={providers}
              provider={provider}
              setProvider={setProvider}
              onChange={() => {
                setGapRefreshKey((k) => k + 1);
                api.listEvidence(company.id).then((v) => setEvidenceCount(v.length)).catch(() => {});
              }}
            />
          )}

          {activeTab === 'timeline' && <Timeline company={company} />}
      </main>
    </div>
  );
}
