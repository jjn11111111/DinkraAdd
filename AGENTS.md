# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
ADINKRAROTA is a single **Next.js 16 (App Router) + React 19** app (package manager: **npm**, Node **22**). The whole product is one process; there is no separate backend service in this repo. See `README.md` for the standard scripts (`dev`, `build`, `start`, `lint`).

### Running / lint / build / test
- Dev server: `npm run dev` (serves `http://localhost:3000`). It reads `.env.local` at runtime, so changing env vars only requires restarting `npm run dev` (no rebuild).
- Lint: `npm run lint` (ESLint, `eslint-config-next`).
- Build: `npm run build` (Turbopack; runs TypeScript typecheck + static generation).
- There is **no automated test suite** in this repo (no test runner/scripts). "Testing" means lint + build + manual verification in the browser.

### Two run modes (important gotcha)
The app degrades gracefully based on whether Supabase env vars are present:
- **Without Supabase configured**: Home, **The Deck / Gallery**, and **Guidebook** work as a guest-less browse experience. **Auth, Readings, Reading history, Membership are gated** — the `/reading` page shows a "Begin Your Journey" login gate and the `/auth/register` page shows a red "temporarily unavailable" banner. This is expected, not a bug.
- **With Supabase configured**: registration, login, and the tarot **reading** flow (the flagship feature) all work.

### Enabling the full experience (local Supabase backend)
Auth + readings require a Supabase backend. For local dev there is no hosted project, so use the Supabase CLI local stack. The Docker engine and the `supabase` CLI are provisioned in the VM image; you only need to start them each session:

1. Start the Docker daemon if it isn't running: `sudo dockerd` (run it in a background/tmux session; verify with `docker info`). If the socket denies permission, `sudo chmod 666 /var/run/docker.sock`.
2. Start the local stack from the repo root: `supabase start` (first run pulls images). Note the printed `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`. The local keys are the standard Supabase demo defaults and are stable across runs.
3. Apply the DB schema (the CLI does **not** auto-apply the SQL in `scripts/`). Run each file in order against the DB container:
   ```
   for f in scripts/001_create_users_and_readings.sql scripts/002_rls_wrap_auth_uid_for_initplan.sql scripts/002_security_advisor_fixes.sql scripts/003_rls_policies.sql; do docker exec -i supabase_db_workspace psql -U postgres -d postgres < "$f"; done
   ```
   `scripts/003_rls_policies.sql` re-creates one policy already made in `001` and errors on that single line — harmless, ignore it.
4. Create `.env.local` (gitignored) pointing at the local stack, then restart `npm run dev`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase start`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase start`>
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```
   Email confirmations are disabled in `supabase/config.toml` (`enable_confirmations = false`), so registering a guest account logs in immediately without an email step. Registration auto-creates a `public.profiles` row via the `on_auth_user_created` trigger.

### Other optional integrations
- **AI features** (AI Collaborator / daily wisdom): need an LLM key, e.g. `GROQ_API_KEY` in `.env.local`. See `AI_SETUP.md`. Hidden/disabled without a key.
- **Stripe** (membership/checkout/webhooks): needs Stripe keys + `SUPABASE_SERVICE_ROLE_KEY`. Not required for readings.

### Rendering note
Card art lives in `public/images/cards/` and renders fine in a normal GPU browser. In a software-rendered/headless browser the CSS 3D card-flip (`transform-style: preserve-3d` + `backface-visibility`) can render mirrored/blank faces even though the card names/meanings still display correctly — a rendering artifact, not an app or data bug.
