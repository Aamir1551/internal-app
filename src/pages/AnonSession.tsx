import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type AnonMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

export function AnonSessionPage() {
  const { anonId = '', sessionId = '' } = useParams();
  const [title, setTitle] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [messages, setMessages] = useState<AnonMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessionRes, msgsRes] = await Promise.all([
        supabase.from('anon_sessions').select('title, flagged').eq('id', sessionId).maybeSingle(),
        supabase.from('anon_messages')
          .select('id, role, content, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;
      if (sessionRes.error) { setError(sessionRes.error.message); return; }
      if (msgsRes.error) { setError(msgsRes.error.message); return; }

      setTitle(sessionRes.data?.title ?? null);
      setFlagged(sessionRes.data?.flagged ?? false);
      setMessages((msgsRes.data ?? []) as AnonMessage[]);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const toggleFlag = async () => {
    setFlagging(true);
    const next = !flagged;
    const { error: e } = await supabase
      .from('anon_sessions')
      .update({ flagged: next })
      .eq('id', sessionId);
    if (!e) setFlagged(next);
    setFlagging(false);
  };

  if (error) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (messages === null) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/anon/${anonId}`} className="btn">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{title || 'Untitled chat'}</h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-muted)' }}>{sessionId}</p>
        </div>
        {flagged && <span className="pill pill-warning">Flagged</span>}
        <button
          onClick={toggleFlag}
          disabled={flagging}
          className={`btn ${flagged ? 'btn-danger' : ''}`}
          style={flagged ? {} : { color: 'var(--color-warning)' }}
        >
          {flagging ? '…' : flagged ? 'Unflag' : 'Flag'}
        </button>
      </div>

      <div className="flex flex-col gap-3 max-w-3xl">
        {messages.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No messages.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={m.role === 'user' ? 'bubble-user' : 'bubble-assistant'}>{m.content}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
