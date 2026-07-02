// Central site configuration
// The NEXT_PUBLIC_BASE_URL env var takes priority, then VERCEL_URL, then the hardcoded production URL

/**
 * Parses NEXT_PUBLIC_BASE_URL into a valid origin. Vercel values like
 * `www.example.com` (no scheme) are normalized to `https://www.example.com`.
 */
export function getConfiguredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  const withScheme = raw.includes("://") ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Client: never use NEXT_PUBLIC_BASE_URL if it points at another host than this tab.
    // Preview deploys change hostname every time; a stale BASE_URL breaks auth redirects.
    const current = window.location.origin;
    const envRaw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    if (envRaw) {
      try {
        const envUrl = new URL(
          envRaw.includes("://") ? envRaw : `https://${envRaw}`
        );
        if (envUrl.origin === current) {
          return envUrl.origin;
        }
      } catch {
        /* use current */
      }
    }
    return current;
  }

  // Server-side
  const configured = getConfiguredSiteOrigin();
  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Hardcoded production fallback (matches Supabase site_url)
  return "https://adinkrarota.3eyecrosstrain.com";
}

/** Auth email links land here; must match Supabase Redirect URLs allowlist. */
export function getAuthCallbackUrl(baseUrl?: string): string {
  const base = (baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  return `${base}/auth/callback`;
}

/** Prefer Origin / forwarded host so preview deploys get the correct callback URL. */
export function getOriginFromRequest(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      /* fall through */
    }
  }

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      "https";
    return `${proto}://${host}`;
  }

  return getBaseUrl();
}
