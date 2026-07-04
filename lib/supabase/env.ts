export type PublicSupabaseConfig = { url: string; anonKey: string };

export const SUPABASE_RUNTIME_GLOBAL = "__ADINKRAROTA_SUPABASE__";

/**
 * Supabase clients expect the project origin (e.g. https://xxx.supabase.co).
 * Dashboard/API docs sometimes expose PostgREST paths — strip those if pasted.
 */
export function normalizeSupabaseProjectUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function parseSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): PublicSupabaseConfig | null {
  const trimmedKey = anonKey?.trim();
  if (!url?.trim() || !trimmedKey) return null;

  const normalizedUrl = normalizeSupabaseProjectUrl(url);
  if (!normalizedUrl) return null;

  return { url: normalizedUrl, anonKey: trimmedKey };
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
      return (
        parseSupabaseConfig(injected.url, injected.anonKey) ?? injected
      );
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
