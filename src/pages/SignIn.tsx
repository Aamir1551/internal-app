import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

export function SignInPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (auth.status === 'signed_in') return <Navigate to="/" replace />;

  const signIn = async () => {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">BatleyGPT Internal</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Admin access only.
          </p>
        </div>
        <button className="btn btn-primary w-full" onClick={signIn} disabled={loading}>
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      </div>
    </div>
  );
}
