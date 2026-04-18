import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getAuthUser, type AuthUser } from '@/lib/adminApi';

type Session = { id: string; title: string; created_at: string; updated_at: string; deleted: boolean | null };

export function UserSessionsPage() {
  const { userId = '' } = useParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, sess] = await Promise.all([
        getAuthUser(userId),
        supabase.from('sessions')
          .select('id, title, created_at, updated_at, deleted')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setUser(u);
      const rows = (sess.data ?? []) as Session[];
      setSessions(rows);
      if (rows.length > 0) {
        const { data } = await supabase.from('messages').select('session_id').in('session_id', rows.map((r) => r.id));
        const c: Record<string, number> = {};
        for (const m of data ?? []) c[m.session_id] = (c[m.session_id] ?? 0) + 1;
        if (!cancelled) setCounts(c);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/users" className="btn">← Back</Link>
        <div>
          <h1 className="text-2xl font-semibold">{user?.email ?? 'Loading…'}</h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>User ID: {userId}</p>
        </div>
      </div>

      {sessions === null ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          This user has no chat sessions yet.
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
            {sessions.length} chat {sessions.length === 1 ? 'session' : 'sessions'}
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="card p-4 flex items-center justify-between hover:bg-[var(--color-card-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{s.title || 'Untitled chat'}</div>
                    {s.deleted && <span className="pill pill-danger">Deleted</span>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                    {counts[s.id] ?? '—'} messages · updated {formatDate(s.updated_at)}
                  </div>
                </div>
                <div className="text-sm" style={{ color: 'var(--color-muted)' }}>View →</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
