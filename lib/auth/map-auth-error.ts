/** Maps Supabase/auth errors to messages suitable for end users (no internal jargon). */
export function mapAuthErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (
    lower.includes("database error saving new user") ||
    lower.includes("profiles_account_type_check") ||
    lower.includes("member_pending")
  ) {
    return "We couldn't finish creating your account. Please try again, or register as Guest first and upgrade from your Portal after signing in.";
  }

  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead, or use Forgot password if you need to reset your password.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email or password is incorrect. If you just registered, confirm your email first, or use Forgot password.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox and spam folder for the confirmation link.";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  if (lower.includes("password") && lower.includes("weak")) {
    return "Please choose a stronger password (at least 8 characters).";
  }

  return raw;
}
