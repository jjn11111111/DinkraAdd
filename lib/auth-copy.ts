// User-facing messages when a service is unavailable (e.g. not configured).
// Avoid "configure X" so end users aren't confused—they can't configure it.
export const AUTH_UNAVAILABLE_MESSAGE =
  "Sign-in and registration are temporarily unavailable. Please try again later.";

/**
 * Shown under AUTH_UNAVAILABLE when the deployer may be viewing the site.
 *
 * Two different env vars confuse people:
 * - NEXT_PUBLIC_SUPABASE_* → required to talk to Supabase (missing = this banner).
 * - NEXT_PUBLIC_BASE_URL → optional; your own site's URL for redirects; does NOT replace Supabase.
 */
export const AUTH_UNAVAILABLE_DEPLOYER_HINT = [
  "Add these in Vercel → Project → Settings → Environment Variables (Production + Preview). Then Redeploy once.",
  "",
  "Required — use either naming style (not both):",
  "  • NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "  • OR SUPABASE_URL + SUPABASE_ANON_KEY",
  "",
  "Values from Supabase → Project Settings → API:",
  "  • Project URL (https://xxxxx.supabase.co — .co not .com)",
  "  • anon / public key",
  "",
  "Also recommended:",
  "  • SUPABASE_SERVICE_ROLE_KEY (server — webhooks, membership sync)",
  "  • NEXT_PUBLIC_BASE_URL = your live site URL (e.g. https://dinkra-add.vercel.app)",
  "",
  "Supabase → Authentication → URL configuration must include:",
  "  • Site URL = your production domain",
  "  • Redirect URLs: https://YOUR_DOMAIN/auth/callback and https://*.vercel.app/**",
].join("\n");

export const PAYMENT_UNAVAILABLE_MESSAGE =
  "Payment processing is temporarily unavailable. Please try again later.";
