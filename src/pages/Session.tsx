import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/adminApi';

type Session = {
  id: string; title: string; user_id: string;
  created_at: string; updated_at: string; deleted: boolean | null;
};
type Message = { id: string; type: 'user' | 'assistant'; content: string; created_at: string };
type FnCall = {
  id: string; tool_name: string;
  tool_args: unknown; tool_error: string | null;
  duration_ms: number | null; created_at: string;
};

type TimelineItem =
  | { kind: 'message'; data: Message }
  | { kind: 'tool'; data: FnCall };

function ToolCallCard({ call }: { call: FnCall }) {
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

export function SessionPage() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: s, error: e } = await supabase
        .from('sessions')
        .select('id, title, user_id, created_at, updated_at, deleted')
        .eq('id', sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (e) { setError(e.message); return; }
      if (!s) { setError('Session not found'); return; }
      setSession(s as Session);

      const [{ data: msgs }, { data: fns }, user] = await Promise.all([
        supabase.from('messages')
          .select('id, type, content, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true }),
        supabase.from('function_call_logs')
          .select('id, tool_name, tool_args, tool_error, duration_ms, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true }),
        getAuthUser((s as Session).user_id),
      ]);
      if (cancelled) return;

      const items: TimelineItem[] = [
        ...((msgs ?? []) as Message[]).map((m) => ({ kind: 'message' as const, data: m })),
        ...((fns ?? []) as FnCall[]).map((f) => ({ kind: 'tool' as const, data: f })),
      ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

      setTimeline(items);
      setOwnerEmail(user?.email ?? null);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (!session) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;

  const msgCount = timeline.filter((t) => t.kind === 'message').length;
  const toolCount = timeline.filter((t) => t.kind === 'tool').length;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/users/${session.user_id}`} className="btn">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{session.title || 'Untitled chat'}</h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {ownerEmail ?? '(unknown)'} · {msgCount} messages · {toolCount} tool calls
            {session.deleted && ' · deleted by user'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-3xl">
        {timeline.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
            No messages in this session.
          </div>
        ) : (
          timeline.map((item) => {
            if (item.kind === 'tool') {
              return (
                <div key={item.data.id} className="px-2">
                  <ToolCallCard call={item.data} />
                </div>
              );
            }
            const m = item.data as Message;
            return (
              <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={m.type === 'user' ? 'bubble-user' : 'bubble-assistant'}>{m.content}</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
