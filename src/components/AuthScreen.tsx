import { useState, type FormEvent } from 'react';
import { api, authClient } from '../lib/api';
import { FoxCubLogo } from './icons';

/** Sign-in form, or first-run setup when no admin exists yet. */
export function AuthScreen({ setup, onDone }: { setup: boolean; onDone: () => void }) {
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
      if (setup) {
        await api('/setup', { body: { name, email, password } });
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? 'Could not sign in.');
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="wallpaper" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <main className="auth-screen">
        <form className="auth-card" onSubmit={submit}>
          <FoxCubLogo size={40} className="auth-logo" />
          <h1 className="auth-title">{setup ? 'Welcome to Fox Cub CMS' : 'Sign in to Fox Cub CMS'}</h1>
          {setup && (
            <p className="auth-sub">Create the first admin account. You can invite more people from Users once you are in.</p>
          )}
          {setup && (
            <label className="field">
              <span className="auth-label">Name</span>
              <input className="g-input" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="auth-label">Email</span>
            <input
              className="g-input"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="auth-label">Password</span>
            <input
              className="g-input"
              type="password"
              required
              minLength={setup ? 8 : undefined}
              autoComplete={setup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="publish-btn auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : setup ? 'Create admin account' : 'Sign in'}
          </button>
        </form>
      </main>
    </>
  );
}
