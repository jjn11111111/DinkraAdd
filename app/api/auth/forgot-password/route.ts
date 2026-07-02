import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthCallbackUrl, getOriginFromRequest } from "@/lib/site-config";
import { getSupabaseConfig } from "@/lib/supabase/env";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Sign-in and registration are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  try {
    const host = new URL(cfg.url).hostname;
    if (!host.endsWith(".supabase.co")) {
      return NextResponse.json(
        {
          error:
            "Supabase URL looks misconfigured. NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL (https://xxxxx.supabase.co), not your app URL.",
        },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Supabase URL is invalid. Check NEXT_PUBLIC_SUPABASE_URL in Vercel." },
      { status: 503 },
    );
  }

  const origin = getOriginFromRequest(request);
  const redirectTo = getAuthCallbackUrl(origin);

  // Implicit flow: email link carries tokens in the hash (no PKCE verifier cookie).
  const supabase = createClient(cfg.url, cfg.anonKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code ?? null,
        status: error.status ?? null,
        redirectTo,
      },
      { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 400 },
    );
  }

  return NextResponse.json({ ok: true, redirectTo });
}
