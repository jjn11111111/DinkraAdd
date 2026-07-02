import { getSupabaseConfig, SUPABASE_RUNTIME_GLOBAL } from "@/lib/supabase/env";

/**
 * Injects Supabase URL + anon key at request time so auth works when env vars
 * are set on Vercel as SUPABASE_URL / SUPABASE_ANON_KEY (not only NEXT_PUBLIC_*).
 */
export function SupabaseRuntimeConfig() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");

  return (
    <script
      id="supabase-runtime-config"
      dangerouslySetInnerHTML={{
        __html: `window.${SUPABASE_RUNTIME_GLOBAL}=${json}`,
      }}
    />
  );
}
