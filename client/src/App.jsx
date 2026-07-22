import { useState } from 'react';
import { getToken, setToken } from './api/client';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [openCompany, setOpenCompany] = useState(null);

  function logout() {
    setToken(null);
    setAuthed(false);
    setOpenCompany(null);
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>AI Compliance Assistant</h1>
          <div className="sub">ISO 27001 · GDPR · Risk Assessments · Audit Evidence</div>
        </div>
        {authed && <button className="secondary" onClick={logout}>Log out</button>}
      </div>

      {!authed && <Auth onAuthed={() => setAuthed(true)} />}
      {authed && !openCompany && <Dashboard onOpenCompany={setOpenCompany} />}
      {authed && openCompany && <CompanyDetail company={openCompany} onBack={() => setOpenCompany(null)} />}
    </div>
  );
}
