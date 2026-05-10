import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type AnonSession = { id: string; title: string | null; created_at: string; updated_at: string; flagged: boolean; msgCount?: number };

export function AnonUserSessionsPage() {
  const { anonId = '' } = useParams();
  const [sessions, setSessions] = useState<AnonSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('anon_sessions')
        .select('id, title, created_at, updated_at, flagged')
        .eq('anon_id', anonId)
        .order('updated_at', { ascending: false });

      if (cancelled) return;
      if (e) { setError(e.message); return; }

      const rows = (data ?? []) as AnonSession[];
      setSessions(rows);

      if (rows.length > 0) {
        const { data: msgs } = await supabase
          .from('anon_messages')
          .select('session_id')
          .in('session_id', rows.map((r) => r.id));

        if (!cancelled && msgs) {
          const counts: Record<string, number> = {};
          for (const m of msgs) counts[m.session_id] = (counts[m.session_id] ?? 0) + 1;
          setSessions(rows.map((r) => ({ ...r, msgCount: counts[r.id] ?? 0 })));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [anonId]);

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/users" className="btn">← Back</Link>
        <div>
          <h1 className="text-2xl font-semibold">Anonymous User</h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-muted)' }}>{anonId}</p>
        </div>
      </div>

      {error && <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>}

      {sessions === null ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No sessions yet.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </h2>
            <button
              onClick={() => setShowFlaggedOnly((v) => !v)}
              className={`pill cursor-pointer transition-colors ${showFlaggedOnly ? 'pill-warning' : ''}`}
            >
              {showFlaggedOnly ? 'Flagged only ×' : `Flagged (${sessions.filter((s) => s.flagged).length})`}
            </button>
          </div>
          <div className="space-y-2">
            {sessions.filter((s) => !showFlaggedOnly || s.flagged).map((s) => (
              <Link
                key={s.id}
                to={`/anon/${anonId}/sessions/${s.id}`}
                className="card p-4 flex items-center justify-between hover:bg-[var(--color-card-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{s.title || 'Untitled chat'}</div>
                    {s.flagged && <span className="pill pill-warning">Flagged</span>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                    {s.msgCount != null ? `${s.msgCount} messages · ` : ''}{formatDate(s.updated_at)}
                  </div>
                </div>
                <div className="text-sm ml-4" style={{ color: 'var(--color-muted)' }}>View →</div>
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
