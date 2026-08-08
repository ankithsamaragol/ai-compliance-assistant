import { useEffect, useState } from 'react';
import { api } from '../api/client';
import VendorRegister from './VendorRegister';
import Risks from './Risks';
import Evidence from './Evidence';
import Timeline from './Timeline';
import ComplianceGapAnalysis from './ComplianceGapAnalysis';
import ComplianceChat from './ComplianceChat';
import Settings from './Settings';
import Documents from './Documents';
import {
  IconHome, IconSparkle, IconDocument, IconAlertTriangle, IconBuilding,
  IconShieldCheck, IconClipboard, IconClock, IconSettings,
  IconChevronDown,
} from '../components/Icons';

const NAV = [
  { key: 'overview', label: 'Dashboard', icon: IconHome, enabled: true },
  { key: 'chat', label: 'AI Compliance Officer', icon: IconSparkle, enabled: true },
  { key: 'documents', label: 'Documents', icon: IconDocument, enabled: true },
  { key: 'risks', label: 'Risks', icon: IconAlertTriangle, enabled: true },
  { key: 'vendors', label: 'Vendors', icon: IconBuilding, enabled: true },
  { key: 'evidence', label: 'Evidence', icon: IconClipboard, enabled: true },
  { key: 'timeline', label: 'Timeline', icon: IconClock, enabled: true },
  { key: 'settings', label: 'Settings', icon: IconSettings, enabled: true },
];

export default function CompanyDetail({ company, onBack, userName, userEmail, onLogout, onCompanyUpdated, onAccountUpdated }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [catalog, setCatalog] = useState([]);
  const [providers, setProviders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [riskCount, setRiskCount] = useState(0);
  const [framework, setFramework] = useState('');
  const [docType, setDocType] = useState('');
  const [provider, setProvider] = useState('');
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
    api.listRisks(company.id).then((v) => setRiskCount(v.length)).catch(() => {});
    refreshDocuments();
  }, [company.id]);

  function refreshDocuments() {
    api.listDocuments(company.id).then(setDocuments).catch((err) => setError(err.message));
  }

  const realDocuments = documents.filter((d) => d.framework !== 'executive_report');

  function jumpToGenerate(fw, dt) {
    setFramework(fw);
    setDocType(dt);
    setActiveTab('documents');
  }

  function jumpToVendors() {
    setActiveTab('vendors');
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
          {company.logo_data_url ? <img className="company-logo-sm" src={company.logo_data_url} alt="" /> : <IconBuilding size={14} />}
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
                {tab.key === 'risks' && <span className="workspace-nav-badge">{riskCount}</span>}
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
          {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
          {activeTab === 'overview' && (
            <ComplianceGapAnalysis
              company={company}
              userName={userName}
              refreshKey={gapRefreshKey}
              documents={documents}
              onSelectDocumentAction={jumpToGenerate}
              onSelectVendorAction={jumpToVendors}
              onNavigateToChat={() => setActiveTab('chat')}
              onNavigateToDocuments={() => setActiveTab('documents')}
              onNavigateToEvidence={() => setActiveTab('evidence')}
              provider={provider}
              onReportGenerated={(doc) => {
                setDocuments((prev) => [doc, ...prev]);
                setActiveDoc(doc);
                setActiveTab('documents');
              }}
            />
          )}

          {activeTab === 'documents' && (
            <Documents
              company={company}
              catalog={catalog}
              providers={providers}
              provider={provider}
              setProvider={setProvider}
              framework={framework}
              setFramework={setFramework}
              docType={docType}
              setDocType={setDocType}
              documents={documents}
              setDocuments={setDocuments}
              activeDoc={activeDoc}
              setActiveDoc={setActiveDoc}
              onGapRefresh={() => setGapRefreshKey((k) => k + 1)}
            />
          )}

          {activeTab === 'risks' && providers.length > 0 && (
            <Risks
              company={company}
              providers={providers}
              provider={provider}
              setProvider={setProvider}
              onChange={(count) => {
                if (typeof count === 'number') setRiskCount(count);
                else api.listRisks(company.id).then((v) => setRiskCount(v.length)).catch(() => {});
              }}
            />
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

          {activeTab === 'settings' && (
            <Settings
              company={company}
              userName={userName}
              onCompanyUpdated={onCompanyUpdated}
              onAccountUpdated={onAccountUpdated}
              onAlertsCreated={() => setGapRefreshKey((k) => k + 1)}
            />
          )}
      </main>
    </div>
  );
}
