import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KIND_ORDER, KINDS } from '@/lib/kinds';

export function DirectoryPage() {
  const [counts, setCounts] = useState<Record<string, { approved: number; pending: number }>>({});

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(KIND_ORDER.map(async (id) => {
        const spec = KINDS[id];
        const [a, p] = await Promise.all([
          supabase.from(spec.table).select('*', { count: 'exact', head: true }).eq('approved', true),
          supabase.from(spec.table).select('*', { count: 'exact', head: true }).eq('approved', false),
        ]);
        return [spec.id, { approved: a.count ?? 0, pending: p.count ?? 0 }] as const;
      }));
      setCounts(Object.fromEntries(entries));
    })();
  }, []);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Directory</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Browse every category. Click one to edit its entries.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {KIND_ORDER.map((id) => {
          const spec = KINDS[id];
          const c = counts[id];
          return (
            <Link
              key={spec.id}
              to={`/directory/${spec.table}`}
              className="card p-5 block hover:bg-[var(--color-card-hover)] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-medium">{spec.emoji} {spec.plural}</div>
                {c && c.pending > 0 && <span className="pill pill-warning">{c.pending} pending</span>}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {c ? `${c.approved} approved · ` : ''}{spec.table}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
