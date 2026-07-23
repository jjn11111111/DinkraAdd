/** Stored in auth user_metadata — routes new members to checkout. Never written to profiles.account_type. */
export const REGISTRATION_INTENT_MEMBER = "member" as const;

export type RegistrationIntent = typeof REGISTRATION_INTENT_MEMBER;

export function userWantsMembershipCheckout(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  if (metadata.registration_intent === REGISTRATION_INTENT_MEMBER) return true;
  // Legacy signups before registration_intent (broken DB path)
  if (metadata.account_type === "member_pending") return true;
  return false;
}
