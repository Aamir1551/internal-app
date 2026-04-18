import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { listAuthUsers, type AuthUser } from '@/lib/adminApi';

type UserRow = AuthUser & { sessionCount: number };

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const authUsers = await listAuthUsers();
        const ids = authUsers.map((u) => u.id);
        const counts: Record<string, number> = {};
        if (ids.length > 0) {
          const { data } = await supabase.from('sessions').select('user_id').in('user_id', ids);
          for (const s of data ?? []) counts[s.user_id] = (counts[s.user_id] ?? 0) + 1;
        }
        if (!cancelled) {
          setUsers(authUsers
            .map((u) => ({ ...u, sessionCount: counts[u.id] ?? 0 }))
            .sort((a, b) => b.sessionCount - a.sessionCount));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!users) return null;
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => (u.email ?? '').toLowerCase().includes(term));
  }, [users, q]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Users & Chats</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Search by email, then drill in to see every session and message.
        </p>
      </div>

      <div className="mb-6 max-w-lg">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email…"
          className="input"
        />
      </div>

      {error && (
        <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>
      )}

      {!filtered ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          {q ? `No users match "${q}".` : 'No users yet.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#0e1115' }}>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Email</th>
                <th className="px-4 py-3 font-medium text-right" style={{ color: 'var(--color-muted)' }}>Sessions</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Last sign-in</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium">{u.email ?? '(no email)'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.sessionCount}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{formatDate(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/users/${u.id}`} className="btn">View chats →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
