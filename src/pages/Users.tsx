import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { listAuthUsers, type AuthUser } from '@/lib/adminApi';

type UserRow = AuthUser & { sessionCount: number };

type AnonRow = { anon_id: string; promptCount: number; lastSeen: string };

type Tab = 'signed-in' | 'anonymous';

export function UsersPage() {
  const [tab, setTab] = useState<Tab>('signed-in');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Users & Chats</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Drill in to see every session and message.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('signed-in')}
          className={`btn ${tab === 'signed-in' ? 'btn-active' : ''}`}
        >
          Signed-in
        </button>
        <button
          onClick={() => setTab('anonymous')}
          className={`btn ${tab === 'anonymous' ? 'btn-active' : ''}`}
        >
          Anonymous
        </button>
      </div>

      {tab === 'signed-in' ? <SignedInUsers /> : <AnonUsers />}
    </>
  );
}

function SignedInUsers() {
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
      <div className="mb-6 max-w-lg">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email…"
          className="input"
        />
      </div>

      {error && <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>}

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

const PAGE_SIZE = 100;

function AnonUsers() {
  const [anons, setAnons] = useState<AnonRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (from: number, append: boolean) => {
    const { data, error: e } = await supabase
      .from('anon_sessions')
      .select('anon_id, updated_at')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (e) { setError(e.message); return; }
    const rows = (data ?? []) as { anon_id: string; updated_at: string }[];
    setHasMore(rows.length === PAGE_SIZE);

    // Dedupe by anon_id, keep latest updated_at and count sessions
    const map = new Map<string, { count: number; lastSeen: string }>();
    for (const row of rows) {
      const existing = map.get(row.anon_id);
      if (!existing) {
        map.set(row.anon_id, { count: 1, lastSeen: row.updated_at });
      } else {
        existing.count++;
        if (row.updated_at > existing.lastSeen) existing.lastSeen = row.updated_at;
      }
    }

    const page: AnonRow[] = [...map.entries()]
      .map(([anon_id, { count, lastSeen }]) => ({ anon_id, promptCount: count, lastSeen }))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    setAnons((prev) => append ? [...prev, ...page] : page);
  };

  useEffect(() => {
    let cancelled = false;
    fetchPage(0, false).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadMore = async () => {
    const next = offset + PAGE_SIZE;
    setLoadingMore(true);
    await fetchPage(next, true);
    setOffset(next);
    setLoadingMore(false);
  };

  if (error) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (loading) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;
  if (anons.length === 0) return (
    <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No anonymous users yet.</div>
  );

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: '#0e1115' }}>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Anon ID</th>
              <th className="px-4 py-3 font-medium text-right" style={{ color: 'var(--color-muted)' }}>Sessions</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Last seen</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {anons.map((a) => (
              <tr key={a.anon_id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>{a.anon_id}</td>
                <td className="px-4 py-3 text-right tabular-nums">{a.promptCount}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{formatDate(a.lastSeen)}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/anon/${a.anon_id}`} className="btn">View chats →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <button onClick={loadMore} disabled={loadingMore} className="btn">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
