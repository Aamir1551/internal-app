import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/adminApi';

const PAGE_SIZE = 50;

type LogRow = {
  id: string;
  session_id: string | null;
  user_id: string | null;
  anon_id: string | null;
  user_prompt: string | null;
  tool_name: string;
  tool_args: Record<string, unknown> | null;
  tool_result: unknown;
  tool_error: string | null;
  duration_ms: number | null;
  final_reply: string | null;
  created_at: string;
};

export function FunctionCallsPage() {
  const [tool, setTool] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [tools, setTools] = useState<string[]>([]);
  const [emailById, setEmailById] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('function_call_logs').select('tool_name').limit(1000);
      const set = new Set<string>();
      for (const r of data ?? []) if (r.tool_name) set.add(r.tool_name);
      setTools(Array.from(set).sort());
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('function_call_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (tool) query = query.eq('tool_name', tool);
      if (q) query = query.ilike('user_prompt', `%${q}%`);
      const { data, count } = await query;
      if (cancelled) return;
      const list = (data ?? []) as LogRow[];
      setRows(list);
      setTotal(count ?? 0);

      const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
      const emails: Record<string, string> = { ...emailById };
      await Promise.all(ids.map(async (id) => {
        if (emails[id]) return;
        const u = await getAuthUser(id);
        if (u?.email) emails[id] = u.email;
      }));
      if (!cancelled) setEmailById(emails);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, q, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Function call log</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Every tool Gemini invoked, with arguments, results, and the final reply shown to the user.
        </p>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <select value={tool} onChange={(e) => { setTool(e.target.value); setPage(1); }} className="input" style={{ maxWidth: 240 }}>
          <option value="">All tools</option>
          {tools.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search user prompt…"
          className="input"
          style={{ maxWidth: 360 }}
        />
        {(tool || q) && <button className="btn" onClick={() => { setTool(''); setQ(''); setPage(1); }}>Clear</button>}
      </div>

      {rows === null ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          No tool calls recorded yet. They'll show up here the next time Gemini runs a tool.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <LogEntry key={r.id} row={r} email={r.user_id ? emailById[r.user_id] : null} />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-muted)' }}>
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="flex gap-2">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </>
  );
}

function LogEntry({ row, email }: { row: LogRow; email: string | null | undefined }) {
  const when = new Date(row.created_at);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm font-semibold">{row.tool_name}</span>
            {row.tool_error
              ? <span className="pill pill-danger">error</span>
              : <span className="pill pill-success">ok</span>}
            {row.duration_ms !== null && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{row.duration_ms}ms</span>
            )}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {when.toLocaleString('en-GB')} · {email ?? (row.anon_id ? `anon:${row.anon_id.slice(0, 8)}` : 'unknown')}
            {row.session_id && (
              <> · <Link to={`/sessions/${row.session_id}`} className="underline">session</Link></>
            )}
          </div>
        </div>
      </div>

      {row.user_prompt && (
        <div className="mb-3">
          <div className="label mb-1">User asked</div>
          <div className="text-sm whitespace-pre-wrap rounded-md p-3" style={{ background: '#0e1115' }}>
            {row.user_prompt}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <details>
          <summary className="label cursor-pointer mb-1">Arguments</summary>
          <pre className="text-xs overflow-x-auto rounded-md p-3" style={{ background: '#0e1115' }}>
            {JSON.stringify(row.tool_args ?? {}, null, 2)}
          </pre>
        </details>
        <details>
          <summary className="label cursor-pointer mb-1">{row.tool_error ? 'Error' : 'Result'}</summary>
          <pre className="text-xs overflow-x-auto rounded-md p-3" style={{ background: '#0e1115', color: row.tool_error ? 'var(--color-danger)' : undefined }}>
            {row.tool_error ?? truncate(JSON.stringify(row.tool_result ?? null, null, 2), 4000)}
          </pre>
        </details>
      </div>

      {row.final_reply && (
        <details className="mt-3">
          <summary className="label cursor-pointer mb-1">Gemini replied</summary>
          <div className="text-sm whitespace-pre-wrap rounded-md p-3 mt-1" style={{ background: '#0e1115' }}>
            {row.final_reply}
          </div>
        </details>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n\n… truncated (${s.length - max} more chars)`;
}
