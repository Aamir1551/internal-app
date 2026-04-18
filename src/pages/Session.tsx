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

export function SessionPage() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fnCalls, setFnCalls] = useState<FnCall[]>([]);
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
      if (!cancelled) {
        setMessages((msgs ?? []) as Message[]);
        setFnCalls((fns ?? []) as FnCall[]);
        setOwnerEmail(user?.email ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (!session) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/users/${session.user_id}`} className="btn">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{session.title || 'Untitled chat'}</h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {ownerEmail ?? '(unknown)'} · {messages.length} messages · {fnCalls.length} tool calls
            {session.deleted && ' · deleted by user'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="flex flex-col gap-3 min-w-0">
          {messages.length === 0 ? (
            <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
              No messages in this session.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={m.type === 'user' ? 'bubble-user' : 'bubble-assistant'}>{m.content}</div>
              </div>
            ))
          )}
        </div>

        <aside className="space-y-2">
          <div className="label">Tool calls ({fnCalls.length})</div>
          {fnCalls.length === 0 ? (
            <div className="card p-4 text-sm" style={{ color: 'var(--color-muted)' }}>
              No tool calls logged for this session.
            </div>
          ) : (
            fnCalls.map((f) => (
              <div key={f.id} className="card p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold">{f.tool_name}</span>
                  {f.tool_error
                    ? <span className="pill pill-danger">error</span>
                    : <span className="pill pill-success">ok</span>}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {new Date(f.created_at).toLocaleTimeString()} · {f.duration_ms ?? '—'}ms
                </div>
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-muted)' }}>Args</summary>
                  <pre className="mt-1 text-xs overflow-x-auto rounded bg-black/30 p-2">
                    {JSON.stringify(f.tool_args, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </aside>
      </div>
    </>
  );
}
