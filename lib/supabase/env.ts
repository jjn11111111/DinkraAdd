export type PublicSupabaseConfig = { url: string; anonKey: string };

export const SUPABASE_RUNTIME_GLOBAL = "__ADINKRAROTA_SUPABASE__";

function parseSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): PublicSupabaseConfig | null {
  const trimmedUrl = url?.trim();
  const trimmedKey = anonKey?.trim();
  if (!trimmedUrl || !trimmedKey) return null;
  if (!(trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://"))) {
    return null;
  }
  return { url: trimmedUrl, anonKey: trimmedKey };
}

/** NEXT_PUBLIC_* — inlined in the client bundle at build time. */
export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  return parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Server runtime: NEXT_PUBLIC_* or SUPABASE_URL / SUPABASE_ANON_KEY.
 * Use in Server Components, route handlers, and server actions.
 */
export function getSupabaseConfig(): PublicSupabaseConfig | null {
  return (
    getPublicSupabaseConfig() ??
    parseSupabaseConfig(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
    )
  );
}

/** Browser client: runtime injection from layout, then build-time NEXT_PUBLIC_*. */
export function getClientSupabaseConfig(): PublicSupabaseConfig | null {
  if (typeof window !== "undefined") {
    const injected = window[SUPABASE_RUNTIME_GLOBAL as keyof Window] as
      | PublicSupabaseConfig
      | undefined;
    if (injected?.url && injected?.anonKey) {
      return injected;
    }
  }
  return getPublicSupabaseConfig();
}

export function isSupabaseConfiguredOnServer(): boolean {
  return getSupabaseConfig() !== null;
}

declare global {
  interface Window {
    __ADINKRAROTA_SUPABASE__?: PublicSupabaseConfig;
  }
}
