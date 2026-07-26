import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api/client';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [openCompany, setOpenCompany] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectBanner, setConnectBanner] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('github_connect');
    if (status) {
      setConnectBanner(
        status === 'success' ? 'GitHub connected — open your company\'s Evidence tab to see the synced signal.'
          : status === 'denied' ? 'GitHub connection was cancelled.'
          : 'GitHub connection failed. Try again from the Evidence tab.',
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (authed && !userEmail) {
      api.getMe().then((account) => {
        setUserEmail(account.email);
        setUserName(account.name || '');
      }).catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function logout() {
    setToken(null);
    setAuthed(false);
    setOpenCompany(null);
    setUserEmail('');
    setUserName('');
    setMenuOpen(false);
  }

  const displayName = userName || userEmail;
  const initials = displayName ? displayName[0].toUpperCase() : '?';

  return (
    <div className="app">
      {!openCompany && (
        <div className="topbar">
          <div className="topbar-brand">
            <div className="topbar-mark">AI</div>
            <div>
              <h1>Compliance Assistant</h1>
              <div className="sub">ISO 27001 · GDPR · CMMC · ISO 42001 · Risk · Audit</div>
            </div>
          </div>
          {authed && (
            <div className="topbar-user" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setMenuOpen((v) => !v)}>
                <div className="topbar-avatar">{initials}</div>
                <div className="topbar-user-meta">
                  <span className="topbar-user-name">{displayName || 'Account'}</span>
                  <span className="topbar-user-role">Admin</span>
                </div>
              </div>
              {menuOpen && (
                <div className="panel" style={{ position: 'absolute', right: 0, top: 46, minWidth: 160, padding: 8, margin: 0, zIndex: 20 }}>
                  <button className="secondary" style={{ width: '100%', marginTop: 0 }} onClick={logout}>Log out</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {connectBanner && !openCompany && (
        <div className="app-body" style={{ paddingBottom: 0 }}>
          <div className="data-notice data-notice-cloud" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>{connectBanner}</span>
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={() => setConnectBanner('')}>Dismiss</button>
          </div>
        </div>
      )}

      <div className={`app-body ${!authed ? 'narrow' : ''} ${openCompany ? 'full-bleed' : ''}`}>
        {!authed && (
          <Auth onAuthed={(account) => { setAuthed(true); setUserEmail(account?.email || ''); setUserName(account?.name || ''); }} />
        )}
        {authed && !openCompany && <Dashboard onOpenCompany={setOpenCompany} />}
        {authed && openCompany && (
          <CompanyDetail
            company={openCompany}
            userName={userName}
            userEmail={userEmail}
            onLogout={logout}
            onBack={() => setOpenCompany(null)}
            onCompanyUpdated={setOpenCompany}
          />
        )}
      </div>
    </div>
  );
}
