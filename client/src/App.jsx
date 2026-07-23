import { useState } from 'react';
import { getToken, setToken } from './api/client';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [openCompany, setOpenCompany] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    setToken(null);
    setAuthed(false);
    setOpenCompany(null);
    setUserEmail('');
    setMenuOpen(false);
  }

  const initials = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <div className="app">
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
                <span className="topbar-user-name">{userEmail || 'Account'}</span>
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

      <div className={`app-body ${!authed ? 'narrow' : ''}`}>
        {!authed && <Auth onAuthed={(account) => { setAuthed(true); setUserEmail(account?.email || ''); }} />}
        {authed && !openCompany && <Dashboard onOpenCompany={setOpenCompany} />}
        {authed && openCompany && <CompanyDetail company={openCompany} onBack={() => setOpenCompany(null)} />}
      </div>
    </div>
  );
}
