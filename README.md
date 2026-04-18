# BatleyGPT — Internal Admin

Vite + React SPA that talks to the same Supabase project as the main BatleyGPT app.

## What's in it

- **Dashboard** — headline counts (pending submissions, sessions, messages, tool calls)
- **Users & Chats** — search `auth.users` by email → drill into any session's full message transcript
- **Pending** — every `rag_*` row where `approved=false`, approve or reject inline
- **Directory** — browse and edit approved entries per category
- **Function Calls** — paginated audit of every tool Gemini invoked (args, result, final reply)
- **Admins** — manage the email whitelist (`admin_emails` table)

## Auth

Supabase magic link. The email has to be in the `admin_emails` table; anyone else lands on `/unauthorized`. Because this is a browser-only app the service-role key never ships — instead RLS policies grant admins full read/write on the relevant tables using their own JWT. A tiny edge function (`admin-users`) handles the one thing RLS can't: listing `auth.users` by email.

## Setup

```bash
cp .env.example .env.local     # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev                     # http://localhost:3000
```

Enter your whitelisted email, click the magic link, you're in.

## Related migrations (in `../batleyGPT/supabase/migrations/`)

- `20260418000001_admin_emails.sql` — whitelist table, seeded with aamirsoni1551@gmail.com
- `20260418000002_function_call_logs.sql` — audit log populated by the `chat` edge function
- `20260418000003_admin_rls_policies.sql` — `is_admin()` helper and admin read/write policies across admin_emails, sessions, messages, function_call_logs, and every rag_* table

## Related edge functions

- `admin-users` — lists `auth.users` by email (service-role proxied, admin-gated)
- `chat` — modified to log each tool call + final reply to `function_call_logs`
