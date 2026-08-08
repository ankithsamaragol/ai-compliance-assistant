import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Team({ onBack }) {
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getMe().then(setMe).catch((err) => setError(err.message));
    api.getTeam().then(setMembers).catch((err) => setError(err.message));
  }, []);

  const isOwner = me?.role === 'owner';

  async function invite() {
    setError('');
    setInviting(true);
    setCopied(false);
    try {
      const { token } = await api.inviteTeamMember();
      setInviteLink(`${window.location.origin}/?teamInvite=${token}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function remove(accountId) {
    try {
      await api.removeTeamMember(accountId);
      setMembers((prev) => prev.filter((m) => m.id !== accountId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 className="section-heading" style={{ marginBottom: 4 }}>Team</h2>
          {me?.orgName && <div className="meta">{me.orgName}</div>}
        </div>
        <button className="secondary" style={{ marginTop: 0 }} onClick={onBack}>← Back</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Members</h3>
            <div className="meta" style={{ marginTop: 4 }}>
              Everyone here sees the same companies and data — there's no per-company permission split yet.
            </div>
          </div>
          {isOwner && (
            <button onClick={invite} disabled={inviting} style={{ marginTop: 0 }}>
              {inviting ? 'Generating…' : 'Invite teammate'}
            </button>
          )}
        </div>

        {inviteLink && (
          <>
            <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={inviteLink} style={{ flex: 1, fontSize: 12 }} onFocus={(e) => e.target.select()} />
              <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
              Expires in 7 days, and works once — generate a new link for each teammate.
            </div>
          </>
        )}

        {members.length === 0 ? (
          <div className="meta" style={{ marginTop: 14 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="vendor-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  {isOwner && <th></th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="vendor-name">{m.name || '—'}</td>
                    <td>{m.email}</td>
                    <td>{m.role === 'owner' ? 'Owner' : 'Member'}</td>
                    <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                    {isOwner && (
                      <td>
                        {me && m.id !== me.id && (
                          <button className="secondary" style={{ marginTop: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => remove(m.id)}>
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
