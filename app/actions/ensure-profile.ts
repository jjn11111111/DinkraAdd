"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EnsureProfileResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

/**
 * Ensures a profiles row exists for the signed-in user (repairs missing trigger rows).
 * Does not change account_type — membership stays server/webhook controlled.
 */
export async function ensureUserProfile(): Promise<EnsureProfileResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Authentication is not configured." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Please sign in again." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: "Profile repair is temporarily unavailable." };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true, created: false };
  }

  const meta = user.user_metadata ?? {};
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || "",
      account_type: "guest",
      birth_name: (meta.birth_name as string) || null,
      birth_date: (meta.birth_date as string) || null,
      birth_time: (meta.birth_time as string) || null,
      birth_place: (meta.birth_place as string) || null,
      gender: (meta.gender as string) || null,
      year_started: new Date().getFullYear(),
      readings_this_year: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return { ok: false, error: "Could not create your profile." };
  }

  return { ok: true, created: true };
}
