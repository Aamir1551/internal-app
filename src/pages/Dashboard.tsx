import { useEffect, useState } from 'react';
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
