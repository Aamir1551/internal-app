import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/adminApi';
import { KIND_ORDER, KINDS, type KindSpec } from '@/lib/kinds';

type Row = Record<string, unknown> & { id: string; created_at?: string; submitted_by?: string | null };
type Group = { spec: KindSpec; rows: Row[] };

export function PendingPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [emailById, setEmailById] = useState<Record<string, string>>({});

  const load = async () => {
    const results = await Promise.all(KIND_ORDER.map(async (id) => {
      const spec = KINDS[id];
      const { data } = await supabase
        .from(spec.table)
        .select('*')
        .eq('approved', false)
        .order('created_at', { ascending: false })
        .limit(200);
      return { spec, rows: (data ?? []) as Row[] };
    }));
    const nonEmpty = results.filter((g) => g.rows.length > 0);
    setGroups(nonEmpty);

    const ids = Array.from(new Set(
      nonEmpty.flatMap((g) => g.rows.map((r) => r.submitted_by)).filter(Boolean),
    )) as string[];
    const next = { ...emailById };
    await Promise.all(ids.map(async (id) => {
      if (next[id]) return;
      const u = await getAuthUser(id);
      if (u?.email) next[id] = u.email;
    }));
    setEmailById(next);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const total = groups?.reduce((acc, g) => acc + g.rows.length, 0) ?? 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Pending approvals</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          {groups === null ? 'Loading…' : (
            <>{total} {total === 1 ? 'entry' : 'entries'} waiting for review. Approve to make visible; reject to delete.</>
          )}
        </p>
      </div>

      {groups === null ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          Nothing pending. Everything's been reviewed.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ spec, rows }) => (
            <section key={spec.id}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
                {spec.emoji} {spec.plural} · {rows.length}
              </h2>
              <div className="space-y-3">
                {rows.map((row) => (
                  <PendingCard
                    key={row.id}
                    spec={spec}
                    row={row}
                    submitterEmail={row.submitted_by ? emailById[row.submitted_by] : null}
                    onResolved={load}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function PendingCard({
  spec, row, submitterEmail, onResolved,
}: {
  spec: KindSpec; row: Row; submitterEmail: string | null | undefined; onResolved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setPending(true); setError(null);
    try { await fn(); setDismissed(true); onResolved(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  };

  const approve = () => run(async () => {
    const { error } = await supabase.from(spec.table).update({ approved: true }).eq('id', row.id);
    if (error) throw error;
  });

  const reject = () => run(async () => {
    const { error } = await supabase.from(spec.table).delete().eq('id', row.id);
    if (error) throw error;
  });

  if (dismissed) return null;

  const title = String(row[spec.titleField] ?? '(untitled)');
  const secondary = spec.secondaryField ? row[spec.secondaryField] : null;
  const submitterLabel = submitterEmail ?? (row.submitted_by ? `user ${row.submitted_by.slice(0, 8)}` : 'anonymous');

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="pill">{spec.emoji} {spec.label}</span>
            <span className="pill">by {submitterLabel}</span>
            {row.created_at && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>submitted {timeAgo(String(row.created_at))}</span>
            )}
          </div>
          <h3 className="text-base font-medium">{title}</h3>
          {secondary ? (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{String(secondary)}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button onClick={approve} disabled={pending} className="btn btn-success">{pending ? '…' : 'Approve'}</button>
          <button onClick={reject} disabled={pending} className="btn btn-danger">Reject</button>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-4">
        {spec.fields.map((f) => {
          const v = row[f.key];
          if (v === null || v === undefined || v === '') return null;
          return (
            <div key={f.key} className="min-w-0">
              <dt className="label">{f.label}</dt>
              <dd className="truncate whitespace-pre-wrap">
                {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
              </dd>
            </div>
          );
        })}
      </dl>

      {error && <p className="mt-3 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
