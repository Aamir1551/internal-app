import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

export function AdminsPage() {
  const auth = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('admin_emails').select('email').order('email');
    setEmails((data ?? []).map((r: { email: string }) => r.email));
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Invalid email');
      return;
    }
    setPending(true); setError(null);
    const { error } = await supabase.from('admin_emails').insert({ email: clean });
    setPending(false);
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      setError(error.message);
      return;
    }
    setNewEmail('');
    load();
  };

  const remove = async (email: string) => {
    if (auth.status === 'signed_in' && email.toLowerCase() === auth.email.toLowerCase()) {
      setError('You cannot remove your own email');
      return;
    }
    if (!confirm(`Remove ${email} from admins?`)) return;
    setPending(true); setError(null);
    const { error } = await supabase.from('admin_emails').delete().eq('email', email);
    setPending(false);
    if (error) { setError(error.message); return; }
    load();
  };

  const currentEmail = auth.status === 'signed_in' ? auth.email : '';

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Admins</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Emails allowed to sign into this internal dashboard.
        </p>
      </div>

      <div className="space-y-6">
        <form onSubmit={add} className="card p-5">
          <div className="label mb-2">Add admin</div>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              className="input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        </form>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#0e1115' }}>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => {
                const isSelf = e.toLowerCase() === currentEmail.toLowerCase();
                return (
                  <tr key={e} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3">
                      {e}
                      {isSelf && <span className="pill ml-2">You</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn btn-danger" disabled={pending || isSelf} onClick={() => remove(e)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
