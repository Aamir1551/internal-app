import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/adminApi';

type FlaggedSession = {
  kind: 'session';
  id: string;
  title: string | null;
  updated_at: string;
  user_id: string;
  userEmail: string | null;
};

type FlaggedAnonSession = {
  kind: 'anon';
  id: string;
  title: string | null;
  updated_at: string;
  anon_id: string;
};

type Item = FlaggedSession | FlaggedAnonSession;

type Filter = 'all' | 'signed-in' | 'anonymous';

export function FlaggedChatsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessRes, anonRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, title, updated_at, user_id')
          .eq('flagged', true)
          .order('updated_at', { ascending: false }),
        supabase
          .from('anon_sessions')
          .select('id, title, updated_at, anon_id')
          .eq('flagged', true)
          .order('updated_at', { ascending: false }),
      ]);

      if (cancelled) return;
      if (sessRes.error) { setError(sessRes.error.message); return; }
      if (anonRes.error) { setError(anonRes.error.message); return; }

      const sessRows = (sessRes.data ?? []) as { id: string; title: string | null; updated_at: string; user_id: string }[];
      const anonRows = (anonRes.data ?? []) as { id: string; title: string | null; updated_at: string; anon_id: string }[];

      // Resolve user emails in parallel
      const userEmails: Record<string, string | null> = {};
      await Promise.all(
        [...new Set(sessRows.map((r) => r.user_id))].map(async (uid) => {
          const u = await getAuthUser(uid);
          userEmails[uid] = u?.email ?? null;
        })
      );

      if (cancelled) return;

      const all: Item[] = [
        ...sessRows.map((r): FlaggedSession => ({
          kind: 'session',
          id: r.id,
          title: r.title,
          updated_at: r.updated_at,
          user_id: r.user_id,
          userEmail: userEmails[r.user_id] ?? null,
        })),
        ...anonRows.map((r): FlaggedAnonSession => ({
          kind: 'anon',
          id: r.id,
          title: r.title,
          updated_at: r.updated_at,
          anon_id: r.anon_id,
        })),
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setItems(all);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = items?.filter((i) => {
    if (filter === 'signed-in') return i.kind === 'session';
    if (filter === 'anonymous') return i.kind === 'anon';
    return true;
  });

  const signedInCount = items?.filter((i) => i.kind === 'session').length ?? 0;
  const anonCount = items?.filter((i) => i.kind === 'anon').length ?? 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Flagged Chats</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Sessions you've flagged for review.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'signed-in', 'anonymous'] as Filter[]).map((f) => {
          const label = f === 'all'
            ? `All (${(items?.length ?? 0)})`
            : f === 'signed-in'
              ? `Signed-in (${signedInCount})`
              : `Anonymous (${anonCount})`;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn ${filter === f ? 'btn-active' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>}

      {!filtered ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          No flagged chats{filter !== 'all' ? ` in this category` : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const href = item.kind === 'session'
              ? `/sessions/${item.id}`
              : `/anon/${item.anon_id}/sessions/${item.id}`;
            const subtitle = item.kind === 'session'
              ? (item.userEmail ?? item.user_id)
              : item.anon_id;
            return (
              <Link
                key={item.id}
                to={href}
                className="card p-4 flex items-center justify-between hover:bg-[var(--color-card-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{item.title || 'Untitled chat'}</div>
                    <span className={`pill ${item.kind === 'anon' ? '' : 'pill-success'}`}>
                      {item.kind === 'anon' ? 'anon' : 'signed-in'}
                    </span>
                  </div>
                  <div className="text-xs mt-1 font-mono truncate" style={{ color: 'var(--color-muted)' }}>
                    {subtitle} · {formatDate(item.updated_at)}
                  </div>
                </div>
                <div className="text-sm ml-4 shrink-0" style={{ color: 'var(--color-muted)' }}>View →</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
