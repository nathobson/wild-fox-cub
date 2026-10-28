import { useCallback, useEffect, useState } from 'react';
import { api, formatDate, type Submission } from '../lib/api';

export function InboxPanel() {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ submissions: Submission[] }>('/submissions')).submissions);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this message?')) return;
    await api(`/submissions/${id}`, { method: 'DELETE' });
    setItems((current) => current?.filter((s) => s.id !== id) ?? null);
  };

  return (
    <div className="panel-scroll">
      <div className="panel">
        <header className="panel-header">
          <h1 className="panel-title">Inbox</h1>
        </header>
        {error && <p className="form-error">{error}</p>}
        {!items && !error && <p className="panel-empty">Loading…</p>}
        {items?.length === 0 && (
          <section className="panel-card">
            <p className="panel-empty">No messages yet. Add a Contact block to a page and publish to start receiving them.</p>
          </section>
        )}
        {items?.map((item) => (
          <article className="panel-card message" key={item.id}>
            <header className="message-head">
              <div>
                <strong>{item.name || 'Anonymous'}</strong>
                {item.email && (
                  <a className="message-email" href={`mailto:${item.email}`}>
                    {item.email}
                  </a>
                )}
              </div>
              <span className="muted">
                {formatDate(item.createdAt)} · {item.page}
              </span>
            </header>
            {item.message && <p className="message-body">{item.message}</p>}
            <div className="dialog-actions">
              <button className="text-btn danger" onClick={() => remove(item.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
