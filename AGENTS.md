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
   Then **grant table privileges** to the API roles (critical — the `scripts/` files only add RLS policies, not table GRANTs; hosted Supabase grants these by default, but the local DB does not when the schema is applied as `postgres`). Without this, every signed-in user silently reads back as a "guest" (profile fetch returns `permission denied for table profiles`) and readings never persist:
   ```
   docker exec -i supabase_db_workspace psql -U postgres -d postgres <<'SQL'
   GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
   SQL
   ```
   (RLS still restricts row access; these grants only allow the roles to touch the tables at all.)
4. Create `.env.local` (gitignored) pointing at the local stack, then restart `npm run dev`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase start`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase start`>
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```
   Email confirmations are disabled in `supabase/config.toml` (`enable_confirmations = false`), so registering a guest account logs in immediately without an email step. Registration auto-creates a `public.profiles` row via the `on_auth_user_created` trigger.

### Making a member account locally (test member-only features)
Guest signup is the only self-serve path; members are normally created by Stripe. To test member-only features (Celtic Cross, custom spreads, AI oracle, daily readings) without Stripe, flip the row directly (bypasses the `profiles_enforce_nonprivileged_update` trigger because `postgres` is privileged):
```
docker exec -i supabase_db_workspace psql -U postgres -d postgres -c "update public.profiles set account_type='member', membership_purchased_at=now() where email='<email>';"
```
Then sign out and back in so the client re-fetches the profile. To reset reading limits during testing: `update public.profiles set readings_this_year=0, last_reading_date=null;` (guests: 7/year, members: 1/day).

### Other optional integrations
- **AI features** (AI Collaborator / daily wisdom / spin-cycle insight): set `GROQ_API_KEY` in `.env.local` (only env var required; server-side, read at runtime so just restart `npm run dev`). See `AI_SETUP.md`. AI is also gated behind being signed in. Enable it in-app via the AI Collaborator → Enable AI → pick a model. Hidden/disabled without a key.
- **Stripe** (membership checkout/webhooks): set `STRIPE_SECRET_KEY` (test `sk_test_...`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test `pk_test_...`, build-time inlined so restart dev), and `STRIPE_WEBHOOK_SECRET`. Checkout uses dynamic `price_data` (no pre-created Stripe Price/product needed). Membership activation happens via the Stripe webhook (`app/api/webhooks/stripe/route.ts`) and needs `SUPABASE_SERVICE_ROLE_KEY`; for local webhooks run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the `whsec_...` it prints. Not required for readings.

### Rendering note
Card art lives in `public/images/cards/` and renders fine in a normal GPU browser. In a software-rendered/headless browser the CSS 3D card-flip (`transform-style: preserve-3d` + `backface-visibility`) can render mirrored/blank faces even though the card names/meanings still display correctly — a rendering artifact, not an app or data bug.
