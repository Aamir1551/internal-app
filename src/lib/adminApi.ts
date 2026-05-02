import { supabase } from './supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

export type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

async function call<T>(body: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Cache-Control': 'no-store',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `admin-users ${res.status}`);
  return json as T;
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const all: AuthUser[] = [];
  for (let page = 1; page <= 10; page++) {
    const { users } = await call<{ users: AuthUser[] }>({ op: 'list', page, perPage: 1000 });
    all.push(...users);
    if (users.length < 1000) break;
  }
  return all;
}

export async function getAuthUser(userId: string): Promise<AuthUser | null> {
  try {
    const { user } = await call<{ user: AuthUser }>({ op: 'get', user_id: userId });
    return user;
  } catch {
    return null;
  }
}

export async function getSystemPrompt(): Promise<{ prompt: string }> {
  return call({ op: 'get_system_prompt' });
}

export async function saveSystemPrompt(value: string): Promise<void> {
  await call({ op: 'save_system_prompt', value });
}

export type TestMessage = { role: 'user' | 'agent'; content: string };
export type TestCaseDb = {
  id: string;
  category: string;
  description: string;
  messages: TestMessage[];
  created_at: string;
};

export async function listDbTests(): Promise<TestCaseDb[]> {
  const { tests } = await call<{ tests: TestCaseDb[] }>({ op: 'list_tests' });
  return tests;
}

export async function createDbTest(
  test: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>,
): Promise<void> {
  await call({ op: 'create_test', ...test });
}

export async function deleteDbTest(id: string): Promise<void> {
  await call({ op: 'delete_test', id });
}
