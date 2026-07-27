import { useState } from 'react';
import { api, setToken } from '../api/client';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [dataAck, setDataAck] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, account } = mode === 'login'
        ? await api.login(email, password)
        : await api.signup(email, password, inviteCode, name);
      setToken(token);
      onAuthed(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 380, margin: '80px auto' }}>
      <h2 style={{ marginTop: 0 }}>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
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
  );
}
