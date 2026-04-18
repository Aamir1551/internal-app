import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { Shell } from './Shell';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: 'var(--color-muted)' }}>
        Loading…
      </div>
    );
  }
  if (auth.status === 'signed_out') return <Navigate to="/signin" replace />;
  if (!auth.isAdmin) return <Navigate to="/unauthorized" replace />;
  return <Shell email={auth.email}>{children}</Shell>;
}
