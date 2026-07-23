import { useState } from 'react';
import { getToken, setToken } from './api/client';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [openCompany, setOpenCompany] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  function logout() {
    setToken(null);
    setAuthed(false);
    setOpenCompany(null);
    setUserEmail('');
  }

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
          <div className="topbar-user">
            {userEmail && <span className="topbar-email">{userEmail}</span>}
            <button className="secondary" onClick={logout}>Log out</button>
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
