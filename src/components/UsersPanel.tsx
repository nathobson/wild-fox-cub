import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, formatDate, type AdminUser } from '../lib/api';

interface UsersPanelProps {
  onToast: (message: string) => void;
}

export function UsersPanel({ onToast }: UsersPanelProps) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: AdminUser[]; currentUserId: string }>('/users');
      setUsers(res.users);
      setCurrentUserId(res.currentUserId);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setPassword = async (user: AdminUser) => {
    const self = user.id === currentUserId;
    const password = window.prompt(
      self ? 'Choose a new password (at least 8 characters)' : `New password for ${user.email} (at least 8 characters). They will be signed out.`,
    );
    if (!password) return;
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: { password } });
      onToast(self ? 'Your password was changed' : `Password updated for ${user.email}`);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const remove = async (user: AdminUser) => {
    if (!window.confirm(`Remove ${user.email}? They will lose access immediately.`)) return;
    try {
      await api(`/users/${user.id}`, { method: 'DELETE' });
      onToast(`${user.email} was removed`);
      void load();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="panel-scroll">
      <div className="panel">
        <header className="panel-header">
          <h1 className="panel-title">Users</h1>
        </header>

        <section className="panel-card">
          {error && <p className="form-error">{error}</p>}
          {!users && !error && <p className="panel-empty">Loading…</p>}
          {users && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.name}
                      {user.id === currentUserId && <span className="tag">You</span>}
                    </td>
                    <td>{user.email}</td>
                    <td className="muted">{formatDate(user.createdAt)}</td>
                    <td className="row-actions">
                      <button className="text-btn" onClick={() => setPassword(user)}>
                        {user.id === currentUserId ? 'Change password' : 'Reset password'}
                      </button>
                      {user.id !== currentUserId && (
                        <button className="text-btn danger" onClick={() => remove(user)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <AddUserForm
          onAdded={(user) => {
            onToast(`${user.email} can now sign in`);
            void load();
          }}
        />
      </div>
    </div>
  );
}

function AddUserForm({ onAdded }: { onAdded: (user: AdminUser) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: AdminUser }>('/users', { body: { name, email, password } });
      setName('');
      setEmail('');
      setPassword('');
      onAdded(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel-card" onSubmit={submit}>
      <h2 className="panel-card-title">Add an admin</h2>
      <p className="panel-sub">Share the email and password with them — they can change the password after signing in.</p>
      <div className="form-grid">
        <label className="field">
          <span className="auth-label">Name</span>
          <input className="g-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="auth-label">Email</span>
          <input className="g-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="auth-label">Temporary password</span>
          <input
            className="g-input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button className="publish-btn" type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add admin'}
        </button>
      </div>
    </form>
  );
}
