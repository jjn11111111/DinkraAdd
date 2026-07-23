import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getSupabaseConfig } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return supabaseResponse;
  }

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: getServerAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes the session cookie if expired — required for SSR + server actions.
  await supabase.auth.getUser();

  return supabaseResponse;
}
