"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getAuthCallbackUrl } from "@/lib/site-config";
import {
  AUTH_UNAVAILABLE_MESSAGE,
} from "@/lib/auth-copy";
import { AuthDeployerHint } from "@/components/auth-deployer-hint";
import { useSupabaseReady } from "@/hooks/use-supabase-ready";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft } from "lucide-react";

/** Supabase returns e.g. "…after 11 seconds" or code over_email_send_rate_limit. */
function parseRateLimitCooldownSeconds(message: string): number | null {
  const m = message.match(/after\s+(\d+)\s*seconds?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) return Math.min(Math.max(1, n), 3600);
  }
  if (
    /over_email_send_rate_limit|over_sms_send_rate_limit|429/i.test(message)
  ) {
    return 60;
  }
  return null;
}

function RateLimitHint() {
  return (
    <p className="mt-2 text-xs text-muted-foreground font-normal normal-case leading-snug border-t border-destructive/20 pt-2">
      Same-address email cooldown from Supabase (anti-spam). Use the countdown on the
      button, then tap once. To shorten waits while testing: Supabase Dashboard →{" "}
      <strong>Authentication → Emails</strong> → rate limits for the same user.
    </p>
  );
}

function looksLikeRecoverySendFailure(message: string): boolean {
  return /error sending recovery email|unexpected_failure|\b500\b/i.test(
    message,
  );
}

function looksLikeInvalidRedirectError(message: string): boolean {
  return /invalid path specified|redirect.*not allowed|redirect_to/i.test(
    message,
  );
}

function looksLikeMisconfiguredSupabaseUrl(message: string): boolean {
  return /supabase url looks misconfigured|supabase url is invalid/i.test(
    message,
  );
}

function RecoveryEmailTroubleshooting({
  redirectTo,
  invalidRedirect = false,
}: {
  redirectTo: string;
  invalidRedirect?: boolean;
}) {
  let origin = "";
  let onVercel = false;
  try {
    const u = new URL(redirectTo);
    origin = u.origin;
    onVercel = u.hostname.endsWith(".vercel.app");
  } catch {
    origin = "";
  }

  return (
    <>
      {invalidRedirect ? (
        <p className="mt-2 text-xs text-muted-foreground font-normal normal-case leading-snug border-t border-destructive/20 pt-2">
          Supabase rejected the redirect URL for this tab. In{" "}
          <strong className="text-foreground/90">Authentication → URL configuration</strong>,
          add the lines below under <strong>Redirect URLs</strong> (keep your production
          domain as <strong>Site URL</strong>).
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground font-normal normal-case leading-snug border-t border-destructive/20 pt-2">
          Supabase could not send the reset email (server-side). In almost all
          cases the dashboard shows why: open{" "}
          <strong className="text-foreground/90">Logs</strong> → filter{" "}
          <strong className="text-foreground/90">Auth</strong> (or{" "}
          <strong className="text-foreground/90">Edge</strong> / API) and read
          the latest error — often <code className="text-foreground/85">535</code>{" "}
          (SMTP) or a blocked &quot;From&quot; address.
        </p>
      )}
      <details className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 open:pb-2">
        <summary className="cursor-pointer list-none px-2 py-2 text-xs font-medium text-foreground/90 [&::-webkit-details-marker]:hidden">
          <span className="underline-offset-2 hover:underline">
            {invalidRedirect
              ? "Show redirect URL fix"
              : "Show SMTP & redirect URL steps"}
          </span>
        </summary>
        <div className="space-y-2 px-2 pb-2 text-xs text-muted-foreground font-normal normal-case leading-snug border-t border-destructive/15 pt-2">
          {!invalidRedirect && (
            <>
              <p className="text-foreground/90 font-medium">Gmail (common fix for 535)</p>
              <p>
                Dashboard → <strong>Authentication</strong> → <strong>Emails</strong> →
                Custom SMTP. Host <code className="text-foreground/85">smtp.gmail.com</code>
                , port <code className="text-foreground/85">587</code>. Username and sender
                = the same Gmail address. Password = Google{" "}
                <strong>App password</strong> (not your normal Gmail password). See{" "}
                <code className="text-foreground/85">SUPABASE_EMAIL_SETUP.md</code>.
              </p>
              <p className="text-foreground/90 font-medium pt-1">Other SMTP providers</p>
              <p>
                SendGrid, Amazon SES, or Resend as <strong>SMTP</strong> in the same
                Supabase screen — use that provider&apos;s host, port, and credentials.
              </p>
            </>
          )}
          <p className="text-foreground/90 font-medium pt-1">Redirect URLs</p>
          <p>Add these under Supabase → Authentication → URL configuration:</p>
          <code className="block w-full p-2 rounded-md bg-muted text-foreground text-[11px] break-all border border-border whitespace-pre-wrap">
            {redirectTo}
            {"\n"}https://*.vercel.app/**
            {"\n"}http://localhost:3000/auth/callback
          </code>
          {onVercel && (
            <p>
              Preview tabs like this one are covered by{" "}
              <code className="text-foreground/85">https://*.vercel.app/**</code>.
            </p>
          )}
          <p>
            Keep your real site as <strong>Site URL</strong>. Preview hosts only
            belong under Redirect URLs.
            {origin ? (
              <>
                {" "}
                This tab:{" "}
                <code className="text-foreground/85 break-all">{origin}</code>.
              </>
            ) : null}
          </p>
        </div>
      </details>
    </>
  );
}

export default function ForgotPasswordPage() {
  const supabaseReady = useSupabaseReady();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [lastRedirectTo, setLastRedirectTo] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownUntil == null) {
      queueMicrotask(() => {
        setCooldownLeft(0);
      });
      return;
    }
    const tick = () => {
      const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownUntil(null);
        setCooldownLeft(0);
        return;
      }
      setCooldownLeft(left);
    };
    queueMicrotask(tick);
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const configError =
    supabaseReady === false ? AUTH_UNAVAILABLE_MESSAGE : null;
  const displayError = error ?? configError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const redirectTo = getAuthCallbackUrl();
    setLastRedirectTo(redirectTo);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (typeof data?.redirectTo === "string") {
        setLastRedirectTo(data.redirectTo);
      }

      if (!res.ok) {
        const msg =
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "Could not send reset email. Please try again.";
        setLoading(false);
        setError(msg);
        const wait = parseRateLimitCooldownSeconds(msg);
        if (wait != null) {
          setCooldownUntil(Date.now() + wait * 1000);
        }
        return;
      }
    } catch {
      setLoading(false);
      setError("Network error. Check your connection and try again.");
      return;
    }

    setLoading(false);
    setCooldownUntil(null);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, hsl(var(--foreground) / 0.08) 0 1px, transparent 1px 32px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gold-gradient mb-2">
            Reset password
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 text-center">
            <p className="text-foreground text-sm">
              If an account exists for{" "}
              <span className="font-medium text-primary">{email}</span>, check
              your inbox (and spam) for the reset link.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">Return to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCooldownUntil(null);
                  }}
                  required
                  className="bg-background"
                  autoComplete="email"
                />
              </div>

              {displayError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {displayError}
                  {displayError === AUTH_UNAVAILABLE_MESSAGE && <AuthDeployerHint />}
                  {looksLikeMisconfiguredSupabaseUrl(displayError ?? "") && (
                    <AuthDeployerHint />
                  )}
                  {(displayError &&
                    /security purposes|only request this after|request this after \d+|over_email_send_rate_limit|429/i.test(
                      displayError,
                    )) && <RateLimitHint />}
                  {lastRedirectTo &&
                    displayError &&
                    (looksLikeRecoverySendFailure(displayError) ||
                      looksLikeInvalidRedirectError(displayError)) && (
                    <RecoveryEmailTroubleshooting
                      redirectTo={lastRedirectTo}
                      invalidRedirect={looksLikeInvalidRedirectError(displayError)}
                    />
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || cooldownLeft > 0 || supabaseReady === false}
              >
                {loading
                  ? "Sending…"
                  : cooldownLeft > 0
                    ? `Wait ${cooldownLeft}s to send again`
                    : "Send reset link"}
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
