import { Link, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users & Chats' },
  { to: '/pending', label: 'Pending' },
  { to: '/directory', label: 'Directory' },
  { to: '/function-calls', label: 'Function Calls' },
  { to: '/admins', label: 'Admins' },
];

export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen">
      <nav className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold text-base flex items-center gap-2">
              <span>⚡</span> BatleyGPT Internal
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[var(--color-card)] text-[var(--color-foreground)]' : 'text-[var(--color-muted)]'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{email}</span>
            <button onClick={signOut} className="btn">Sign out</button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
