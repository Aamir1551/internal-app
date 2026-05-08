import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type LogRow = {
  id: string;
  user_prompt: string | null;
  tool_name: string | null;
  tool_args: unknown;
  tool_error: string | null;
  duration_ms: number | null;
  final_reply: string | null;
  created_at: string;
};

type Turn = {
  user_prompt: string;
  tools: LogRow[];
  final_reply: string | null;
};

function ToolCallCard({ call }: { call: LogRow }) {
  const [open, setOpen] = useState(false);
  const ok = !call.tool_error;
  return (
    <div
      className="border rounded-lg text-xs overflow-hidden"
      style={{ borderColor: ok ? 'var(--color-border)' : 'rgba(239,68,68,0.35)', background: '#0d1017' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-white/5 transition-colors"
      >
        <span style={{ color: 'var(--color-muted)' }}>⚙</span>
        <span className="font-mono font-semibold" style={{ color: ok ? 'var(--color-muted)' : 'var(--color-danger)' }}>
          {call.tool_name}
        </span>
        {call.duration_ms != null && (
          <span style={{ color: 'var(--color-muted)' }}>{call.duration_ms}ms</span>
        )}
        <span className={`pill ml-auto ${ok ? 'pill-success' : 'pill-danger'}`}>
          {ok ? 'ok' : 'error'}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="label mb-1">Args</div>
            <pre className="text-xs overflow-x-auto rounded p-2" style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--color-muted)' }}>
              {JSON.stringify(call.tool_args, null, 2)}
            </pre>
          </div>
          {call.tool_error && (
            <div>
              <div className="label mb-1" style={{ color: 'var(--color-danger)' }}>Error</div>
              <pre className="text-xs overflow-x-auto rounded p-2" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
                {call.tool_error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnonSessionPage() {
  const { anonId = '', sessionId = '' } = useParams();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('function_call_logs')
        .select('id, user_prompt, tool_name, tool_args, tool_error, duration_ms, final_reply, created_at')
        .eq('session_id', sessionId)
        .eq('anon_id', anonId)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (e) { setError(e.message); return; }

      const rows = (data ?? []) as LogRow[];

      // Group consecutive rows by user_prompt into turns
      const turnList: Turn[] = [];
      for (const row of rows) {
        const prompt = row.user_prompt ?? '';
        const last = turnList[turnList.length - 1];
        if (!last || last.user_prompt !== prompt) {
          turnList.push({ user_prompt: prompt, tools: [], final_reply: row.final_reply });
        }
        const t = turnList[turnList.length - 1];
        if (row.tool_name) t.tools.push(row);
        if (row.final_reply) t.final_reply = row.final_reply;
      }

      setTurns(turnList);
    })();
    return () => { cancelled = true; };
  }, [anonId, sessionId]);

  if (error) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (turns === null) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/anon/${anonId}`} className="btn">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">Session</h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-muted)' }}>{sessionId}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-3xl">
        {turns.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No messages.</div>
        ) : (
          turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-end">
                <div className="bubble-user">{turn.user_prompt}</div>
              </div>
              {turn.tools.map((t) => (
                <div key={t.id} className="px-2">
                  <ToolCallCard call={t} />
                </div>
              ))}
              {turn.final_reply && (
                <div className="flex justify-start">
                  <div className="bubble-assistant">{turn.final_reply}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
