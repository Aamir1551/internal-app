import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
          Your email is not on the admin whitelist. Ask an admin to add you.
        </p>
        <button onClick={signOut} className="btn w-full">Sign out</button>
      </div>
    </div>
  );
}
