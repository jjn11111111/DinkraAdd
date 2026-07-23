import type { SupabaseClient, User } from "@supabase/supabase-js";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ProfileMembershipRow = {
  account_type?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_id?: string | null;
};

export type SpinCycleAccessResult =
  | { ok: true; user: User; accountType: "member" }
  | { ok: false; status: 401 | 403 | 503; error: string };

function isActiveSubscriptionStatus(status: string): boolean {
  return status === "active" || status === "trialing";
}

async function persistMemberProfile(
  admin: SupabaseClient,
  user: User,
  opts: { subscriptionId: string; customerId: string | null },
) {
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || "",
      account_type: "member",
      stripe_payment_id: opts.subscriptionId,
      ...(opts.customerId ? { stripe_customer_id: opts.customerId } : {}),
      year_started: new Date().getFullYear(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

async function restoreActiveStripeMembership(
  user: User,
  profile: ProfileMembershipRow | null,
): Promise<boolean> {
  if (!isStripeConfigured() || !stripe) return false;

  const admin = getSupabaseAdmin();
  if (!admin) return false;

  const profileSubId =
    typeof profile?.stripe_payment_id === "string" &&
    profile.stripe_payment_id.startsWith("sub_")
      ? profile.stripe_payment_id
      : null;

  if (profileSubId) {
    const sub = await stripe.subscriptions.retrieve(profileSubId);
    if (isActiveSubscriptionStatus(sub.status)) {
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      await persistMemberProfile(admin, user, {
        subscriptionId: sub.id,
        customerId,
      });
      return true;
    }
  }

  const profileCustomerId =
    typeof profile?.stripe_customer_id === "string"
      ? profile.stripe_customer_id
      : null;

  const candidateCustomerIds = new Set<string>();
  if (profileCustomerId) {
    candidateCustomerIds.add(profileCustomerId);
  }

  if (user.email) {
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 5,
    });
    customers.data.forEach((customer) => candidateCustomerIds.add(customer.id));
  }

  for (const customerId of candidateCustomerIds) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    const active = subs.data.find((sub) => isActiveSubscriptionStatus(sub.status));
    if (active) {
      await persistMemberProfile(admin, user, {
        subscriptionId: active.id,
        customerId,
      });
      return true;
    }
  }

  return false;
}

export async function requireSpinCycleMember(
  supabase: SupabaseClient | null,
  featureLabel: string,
): Promise<SpinCycleAccessResult> {
  if (!supabase) {
    return { ok: false, status: 503, error: "Authentication is not configured." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: `Sign in required for ${featureLabel}.` };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, stripe_customer_id, stripe_payment_id")
    .eq("id", user.id)
    .maybeSingle();

  const profileAccountType = profile?.account_type;
  const metadataAccountType = user.user_metadata?.account_type;
  if (profileAccountType === "member" || metadataAccountType === "member") {
    return { ok: true, user, accountType: "member" };
  }

  try {
    const restored = await restoreActiveStripeMembership(user, profile);
    if (restored) {
      return { ok: true, user, accountType: "member" };
    }
  } catch (error) {
    console.error("Spin Cycle membership restore failed:", error);
  }

  return {
    ok: false,
    status: 403,
    error: `${featureLabel} is available with Membership ($2.22).`,
  };
}
