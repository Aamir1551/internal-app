import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { kindFromTable, type KindSpec } from '@/lib/kinds';

type Row = Record<string, unknown> & { id: string; approved: boolean };

export function DirectoryEditPage() {
  const { table = '', id = '' } = useParams();
  const spec = kindFromTable(table);
  const [row, setRow] = useState<Row | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from(spec.table).select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (!data) setNotFound(true);
      else setRow(data as Row);
    })();
    return () => { cancelled = true; };
  }, [spec, id]);

  if (!spec) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>Unknown table: {table}</div>;
  if (notFound) return <div className="card p-6 text-sm" style={{ color: 'var(--color-danger)' }}>Not found.</div>;
  if (!row) return <div className="card p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>;

  const title = String(row[spec.titleField] ?? '(untitled)');

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/directory/${spec.table}`} className="btn">← Back</Link>
        <div>
          <h1 className="text-2xl font-semibold">{spec.emoji} {title}</h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{spec.label} · ID {row.id}</p>
        </div>
      </div>
      <EditForm spec={spec} row={row} />
    </>
  );
}

function EditForm({ spec, row }: { spec: KindSpec; row: Row }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; msg?: string }>({ kind: 'idle' });
  const [approved, setApproved] = useState<boolean>(!!row.approved);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of spec.fields) v[f.key] = row[f.key] ?? (f.type === 'bool' ? null : '');
    return v;
  });

  const save = async () => {
    setPending(true); setStatus({ kind: 'idle' });
    try {
      const patch: Record<string, unknown> = { approved };
      for (const f of spec.fields) {
        const v = values[f.key];
        patch[f.key] = v === '' ? null : v;
      }
      const { error } = await supabase.from(spec.table).update(patch).eq('id', row.id);
      if (error) throw error;
      setStatus({ kind: 'ok', msg: 'Saved' });
    } catch (e) {
      setStatus({ kind: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this entry permanently?')) return;
    setPending(true); setStatus({ kind: 'idle' });
    try {
      const { error } = await supabase.from(spec.table).delete().eq('id', row.id);
      if (error) throw error;
      navigate(`/directory/${spec.table}`);
    } catch (e) {
      setStatus({ kind: 'error', msg: e instanceof Error ? e.message : String(e) });
      setPending(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="card p-6 space-y-5">
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">Approved</span>
          {approved
            ? <span className="pill pill-success">Visible to users</span>
            : <span className="pill pill-warning">Hidden</span>}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {spec.fields.map((f) => (
          <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
            <label className="label block mb-1.5">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                className="input"
                value={String(values[f.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : f.type === 'bool' ? (
              <select
                className="input"
                value={values[f.key] === true ? 'true' : values[f.key] === false ? 'false' : ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value === '' ? null : e.target.value === 'true' }))}
              >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : f.type === 'number' ? (
              <input
                type="number"
                step="any"
                className="input"
                value={values[f.key] === null || values[f.key] === undefined ? '' : String(values[f.key])}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            ) : (
              <input
                type="text"
                className="input"
                value={String(values[f.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>Delete</button>
        {status.kind === 'ok' && <span className="text-sm" style={{ color: 'var(--color-success)' }}>{status.msg}</span>}
        {status.kind === 'error' && <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{status.msg}</span>}
      </div>
    </form>
  );
}
