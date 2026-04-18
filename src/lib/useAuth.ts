import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; email: string; userId: string; isAdmin: boolean };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.email) {
        if (!cancelled) setState({ status: 'signed_out' });
        return;
      }

      // A row in admin_emails visible to *us* proves we're an admin — the RLS
      // policy only returns rows to admins.
      const { data } = await supabase
        .from('admin_emails')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (!cancelled) {
        setState({
          status: 'signed_in',
          email: user.email,
          userId: user.id,
          isAdmin: !!data,
        });
      }
    };

    evaluate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { evaluate(); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
