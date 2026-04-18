import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

export function SignInPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'signed_in') return <Navigate to="/" replace />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending'); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setStatus('error'); setError(error.message); }
    else setStatus('sent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">BatleyGPT Internal</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
          Admin access only. Enter your whitelisted email for a magic link.
        </p>

        {status === 'sent' ? (
          <div className="p-4 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <p className="text-sm">
              Magic link sent to <strong>{email}</strong>. Check your inbox and click the link to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div>
              <label className="label block mb-2">Email</label>
              <input
                type="email"
                autoFocus
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'sending'}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
