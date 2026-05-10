import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KIND_ORDER, KINDS } from '@/lib/kinds';

type Counts = {
  pending: number;
  sessions: number;
  messages: number;
  fnCalls: number;
};

async function loadCounts(): Promise<Counts> {
  const head = (t: string, filter?: { col: string; val: unknown }) => {
    let q = supabase.from(t).select('*', { count: 'exact', head: true });
    if (filter) q = q.eq(filter.col, filter.val);
    return q;
  };

  const [pendingResults, sessions, messages, fnCalls] = await Promise.all([
    Promise.all(KIND_ORDER.map((id) => head(KINDS[id].table, { col: 'approved', val: false }))),
    head('sessions'),
    head('messages'),
    head('function_call_logs'),
  ]);

  const pending = pendingResults.reduce((sum, r) => sum + (r.count ?? 0), 0);
  return {
    pending,
    sessions: sessions.count ?? 0,
    messages: messages.count ?? 0,
    fnCalls: fnCalls.count ?? 0,
  };
}

export function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCounts().then((c) => { if (!cancelled) setCounts(c); });
    return () => { cancelled = true; };
  }, []);

  const tiles = counts ? [
    { to: '/pending', label: 'Pending approvals', value: counts.pending, accent: counts.pending > 0 },
    { to: '/users', label: 'Chat sessions', value: counts.sessions },
    { to: '/function-calls', label: 'Total messages', value: counts.messages },
    { to: '/function-calls', label: 'Tool calls logged', value: counts.fnCalls },
  ] : [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Review pending submissions, inspect conversations, and audit function calls.
        </p>
      </div>

      {!counts ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {tiles.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="card p-5 block hover:bg-[var(--color-card-hover)] transition-colors"
              style={t.accent ? { borderColor: 'var(--color-warning)' } : undefined}
            >
              <div className="text-3xl font-semibold tabular-nums">{t.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{t.label}</div>
            </Link>
          ))}
        </div>
      )}

      <Todos />

      <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>Quick links</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickLink to="/users" title="Users & Chats" hint="Search by email → full conversation history." />
        <QuickLink to="/pending" title="Pending submissions" hint="Community-submitted directory entries awaiting approval." />
        <QuickLink to="/directory" title="Edit directory" hint="Browse and modify approved entries across every category." />
        <QuickLink to="/function-calls" title="Function calls" hint="Audit trail of every tool Gemini invoked, with args and results." />
        <QuickLink to="/admins" title="Manage admins" hint="Add or remove emails authorized to access this dashboard." />
      </div>
    </>
  );
}

function QuickLink({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link to={to} className="card p-4 block hover:bg-[var(--color-card-hover)] transition-colors">
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{hint}</div>
    </Link>
  );
}

type Todo = { id: string; text: string; done: boolean; created_at: string };

function Todos() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('admin_todos')
      .select('id, text, done, created_at')
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setTodos((data ?? []) as Todo[]); });
    return () => { cancelled = true; };
  }, []);

  const addTodo = async () => {
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    const { data } = await supabase
      .from('admin_todos')
      .insert({ text })
      .select('id, text, done, created_at')
      .single();
    if (data) setTodos((prev) => [...(prev ?? []), data as Todo]);
    setDraft('');
    setAdding(false);
    inputRef.current?.focus();
  };

  const toggleDone = async (todo: Todo) => {
    const next = !todo.done;
    await supabase.from('admin_todos').update({ done: next }).eq('id', todo.id);
    setTodos((prev) => prev?.map((t) => t.id === todo.id ? { ...t, done: next } : t) ?? null);
  };

  const deleteTodo = async (id: string) => {
    await supabase.from('admin_todos').delete().eq('id', id);
    setTodos((prev) => prev?.filter((t) => t.id !== id) ?? null);
  };

  const pending = todos?.filter((t) => !t.done) ?? [];
  const done = todos?.filter((t) => t.done) ?? [];

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
        TODOs {todos !== null && `· ${pending.length} open`}
      </h2>
      <div className="card overflow-hidden">
        {todos === null ? (
          <div className="p-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>Loading…</div>
        ) : (
          <>
            {todos.length === 0 && (
              <div className="p-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>No TODOs yet.</div>
            )}
            {[...pending, ...done].map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleDone(todo)}
                  className="shrink-0 cursor-pointer"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span
                  className="flex-1 text-sm"
                  style={todo.done ? { color: 'var(--color-muted)', textDecoration: 'line-through' } : undefined}
                >
                  {todo.text}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-xs shrink-0"
                  style={{ color: 'var(--color-muted)' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
                placeholder="Add a TODO…"
                className="input flex-1"
                disabled={adding}
              />
              <button onClick={addTodo} disabled={adding || !draft.trim()} className="btn btn-primary shrink-0">
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
