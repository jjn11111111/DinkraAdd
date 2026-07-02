import { AUTH_UNAVAILABLE_DEPLOYER_HINT } from "@/lib/auth-copy";

/** Collapsible setup steps for deployers — keeps end-user auth errors readable. */
export function AuthDeployerHint() {
  return (
    <details className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 open:pb-2">
      <summary className="cursor-pointer list-none px-2 py-2 text-xs font-medium text-foreground/90 [&::-webkit-details-marker]:hidden">
        <span className="underline-offset-2 hover:underline">
          Deployer: fix Supabase configuration in Vercel
        </span>
      </summary>
      <p className="px-2 pb-2 text-xs text-muted-foreground font-normal normal-case leading-snug border-t border-destructive/15 pt-2 whitespace-pre-line">
        {AUTH_UNAVAILABLE_DEPLOYER_HINT}
      </p>
    </details>
  );
}
