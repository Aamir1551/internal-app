import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { kindFromTable } from '@/lib/kinds';

type Row = Record<string, unknown> & { id: string; approved: boolean };

export function DirectoryTablePage() {
  const { table = '' } = useParams();
  const spec = kindFromTable(table);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'approved' | 'pending'>('all');

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from(spec.table).select('*').order('created_at', { ascending: false }).limit(500);
      if (status === 'approved') query = query.eq('approved', true);
      if (status === 'pending') query = query.eq('approved', false);
      if (q) query = query.ilike(spec.titleField, `%${q}%`);
      const { data } = await query;
      if (!cancelled) setRows((data ?? []) as Row[]);
    })();
    return () => { cancelled = true; };
  }, [spec, q, status]);

  if (!spec) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>Unknown table: {table}</div>;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/directory" className="btn">← Back</Link>
        <div>
          <h1 className="text-2xl font-semibold">{spec.emoji} {spec.plural}</h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{spec.table}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 max-w-2xl">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${spec.titleField}…`} className="input" />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input" style={{ maxWidth: 160 }}>
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {rows === null ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>No entries match.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#0e1115' }}>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>
                  {spec.fields.find((f) => f.key === spec.titleField)?.label ?? 'Title'}
                </th>
                {spec.secondaryField && (
                  <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>
                    {spec.fields.find((f) => f.key === spec.secondaryField)?.label ?? spec.secondaryField}
                  </th>
                )}
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium truncate max-w-sm">{String(row[spec.titleField] ?? '(untitled)')}</td>
                  {spec.secondaryField && (
                    <td className="px-4 py-3 truncate max-w-xs" style={{ color: 'var(--color-muted)' }}>
                      {String(row[spec.secondaryField] ?? '')}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {row.approved
                      ? <span className="pill pill-success">Approved</span>
                      : <span className="pill pill-warning">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/directory/${spec.table}/${row.id}`} className="btn">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
