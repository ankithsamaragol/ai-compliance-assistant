import { useEffect, useState } from 'react';
import { api, setToken } from '../api/client';

// A team-invite link points at this same page with ?teamInvite=<token> — distinct from the
// unrelated `inviteCode` field below (that one gates who can sign up to the app at all; this one
// decides which existing team a new signup joins). Read once on mount; a full page load is how
// the link arrives since this app has no client-side router.
const teamInviteToken = new URLSearchParams(window.location.search).get('teamInvite');

const FAQ = [
  {
    q: 'Does this give me an ISO 27001 / SOC 2 / CMMC certificate?',
    a: 'No — and no software can. Real certification requires an accredited independent auditor (a certification body for ISO 27001, a licensed CPA firm for SOC 2, a C3PAO for CMMC). This app helps you prepare — draft the right documents, close real gaps, track evidence — so that process goes faster when you do it.',
  },
  {
    q: 'Does my company data get sent to a third party?',
    a: 'Only for the specific action you run, and only if you pick a cloud AI provider (Groq) for it. Every AI action lets you switch to a local provider (Ollama) instead, which runs entirely on your own machine — you choose per action, not once for the whole app.',
  },
  {
    q: 'Can my team use this together?',
    a: 'Yes — invite teammates from the Team page. Right now everyone in a workspace sees the same companies and data; there\'s no per-company permission split yet.',
  },
  {
    q: 'What frameworks does it cover?',
    a: 'ISO 27001, GDPR, CMMC / NIST 800-171, and ISO 42001 (AI governance).',
  },
  {
    q: 'Is this ready for my whole company to depend on?',
    a: 'This is a new, actively-evolving product. It\'s genuinely useful for building and organizing a real compliance program today — treat it as that, not as a finished, guaranteed system yet. Reach out any time something\'s unclear.',
  },
];

function InfoPanel({ title, onBack, children }) {
  return (
    <div className="panel" style={{ maxWidth: 480, margin: '60px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" className="secondary" style={{ marginTop: 0 }} onClick={onBack}>← Back</button>
      </div>
      {children}
    </div>
  );
}

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState(teamInviteToken ? 'signup' : 'login');
  const [infoView, setInfoView] = useState(null); // null | 'about' | 'faq'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [dataAck, setDataAck] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitedOrgName, setInvitedOrgName] = useState('');

  useEffect(() => {
    if (!teamInviteToken) return;
    api.getInvitePreview(teamInviteToken)
      .then((preview) => setInvitedOrgName(preview.orgName))
      .catch((err) => setError(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, account } = mode === 'login'
        ? await api.login(email, password)
        : await api.signup(email, password, inviteCode, name, teamInviteToken || undefined);
      setToken(token);
      onAuthed(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (infoView === 'about') {
    return (
      <InfoPanel title="About" onBack={() => setInfoView(null)}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          AI Compliance Assistant helps small businesses and startups build a real security and
          privacy compliance program across ISO 27001, GDPR, CMMC / NIST 800-171, and ISO 42001 —
          AI-drafted policies grounded in your actual company profile, automatic vendor risk
          detection, a structured risk register, and gap tracking that tells you exactly what's
          next and why it matters.
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          It's built on one rule: AI drafts and reasons, but every score, verdict, and alert a
          client would rely on comes from plain, deterministic logic — never an AI guess. This is a
          new product, actively evolving, built to make real compliance work faster to get right,
          not to replace the accredited auditors that real certification still requires.
        </p>
      </InfoPanel>
    );
  }

  if (infoView === 'faq') {
    return (
      <InfoPanel title="FAQ" onBack={() => setInfoView(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          {FAQ.map((item) => (
            <div key={item.q}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.q}</div>
              <div className="meta" style={{ marginTop: 3, lineHeight: 1.5 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </InfoPanel>
    );
  }

  return (
    <div>
      <div className="panel" style={{ maxWidth: 380, margin: '80px auto 16px' }}>
        <h2 style={{ marginTop: 0 }}>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
        {teamInviteToken && (
          <div className="meta" style={{ marginBottom: 12 }}>
            {invitedOrgName ? `You're joining ${invitedOrgName}.` : 'Checking your invite link…'}
          </div>
        )}
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {mode === 'signup' && (
            <>
              <label>Invite code</label>
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
              <label style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto', marginRight: 8 }}
                  checked={dataAck}
                  onChange={(e) => setDataAck(e.target.checked)}
                  required
                />
                I understand: choosing a cloud AI provider (e.g. Groq) sends my company profile data
                to that third party to generate results. Choosing a local provider (Ollama) keeps
                everything on this machine. I can switch providers per action at any time.
              </label>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </div>
      <div className="auth-footer">
        <span onClick={() => setInfoView('about')}>About</span>
        <span className="auth-footer-sep">·</span>
        <span onClick={() => setInfoView('faq')}>FAQ</span>
      </div>
    </div>
  );
}
