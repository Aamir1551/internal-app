import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type LogRow = { session_id: string | null; user_prompt: string | null; created_at: string };

type AnonSession = {
  session_id: string;
  firstPrompt: string;
  turnCount: number;
  lastAt: string;
  untracked?: boolean;
};

export function AnonUserSessionsPage() {
  const { anonId = '' } = useParams();
  const [sessions, setSessions] = useState<AnonSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('function_call_logs')
        .select('session_id, user_prompt, created_at')
        .eq('anon_id', anonId)
        .order('created_at', { ascending: true })
        .limit(5000);

      if (cancelled) return;
      if (e) { setError(e.message); return; }

      const rows = (data ?? []) as LogRow[];

      const sessionMap = new Map<string, { prompts: string[]; lastAt: string }>();
      let untracked = 0;
      let untrackedLastAt = '';
      let untrackedFirstPrompt = '';

      for (const row of rows) {
        if (!row.session_id) {
          untracked++;
          untrackedLastAt = row.created_at;
          if (!untrackedFirstPrompt && row.user_prompt) untrackedFirstPrompt = row.user_prompt;
          continue;
        }
        const sid = row.session_id;
        if (!sessionMap.has(sid)) sessionMap.set(sid, { prompts: [], lastAt: row.created_at });
        const s = sessionMap.get(sid)!;
        if (row.user_prompt && !s.prompts.includes(row.user_prompt)) s.prompts.push(row.user_prompt);
        s.lastAt = row.created_at;
      }

      const list: AnonSession[] = [...sessionMap.entries()]
        .map(([sid, { prompts, lastAt }]) => ({
          session_id: sid,
          firstPrompt: prompts[0] ?? 'Unknown',
          turnCount: prompts.length,
          lastAt,
          untracked: false,
        }))
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

      if (untracked > 0) {
        list.push({
          session_id: '__untracked__',
          firstPrompt: untrackedFirstPrompt || 'Unknown',
          turnCount: untracked,
          lastAt: untrackedLastAt,
          untracked: true,
        });
      }

      setSessions(list);
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
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No sessions found.</div>
      ) : (
        <>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => s.untracked ? (
              <div key="untracked" className="card p-4" style={{ opacity: 0.6 }}>
                <div className="font-medium truncate">{s.firstPrompt}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  {s.turnCount} {s.turnCount === 1 ? 'message' : 'messages'} before session tracking · {formatDate(s.lastAt)}
                </div>
              </div>
            ) : (
              <Link
                key={s.session_id}
                to={`/anon/${anonId}/sessions/${s.session_id}`}
                className="card p-4 flex items-center justify-between hover:bg-[var(--color-card-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.firstPrompt}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                    {s.turnCount} {s.turnCount === 1 ? 'message' : 'messages'} · {formatDate(s.lastAt)}
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
