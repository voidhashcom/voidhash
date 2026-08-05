"use client";

import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, Logo } from "@voidhash/ui";
import { Check } from "lucide-react";

import { redirectToSignOut } from "@/features/auth/lib/sign-out";
import { useAuth } from "@/features/studio/components/auth-context";
import { isOrganizationWaitlisted } from "@/lib/waitlist";

export const Route = createFileRoute("/studio/_authenticated/waitlist")({
  ssr: false,
  component: WaitlistPage,
});

/**
 * The holding screen shown to a signed-in user whose organization is still on
 * the waitlist. Reached via the gate in the `/studio/_authenticated` layout,
 * which redirects here instead of rendering Studio.
 */
function WaitlistPage() {
  const { user } = useAuth();
  const waitlistedOrganization = user.organizations.find(isOrganizationWaitlisted);

  const signOut = () => {
    redirectToSignOut("/");
  };

  // Approved (or org-less) users have no business here — `/studio` sends them
  // on to their organization or to organization creation.
  if (!waitlistedOrganization) {
    return <Navigate replace to="/studio" />;
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <Card className="mt-4 rounded-2xl text-center">
            <CardContent>
              <div className="flex flex-col items-center pt-4 pb-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Check className="size-5 text-muted-foreground" />
                </div>
                <h1 className="mt-4 font-medium text-2xl tracking-tight">You're on the list</h1>
                <p className="mt-2 text-muted-foreground">
                  {waitlistedOrganization.name} is on the waitlist. We're onboarding new teams in
                  batches and will email {user.email} as soon as it's your turn.
                </p>
              </div>
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
                Nothing else to do for now — your account and organization are already set up and
                waiting for you.
              </div>
            </CardContent>
          </Card>
          <div className="text-center text-muted-foreground text-sm">
            Signed in to a wrong account?{" "}
            <button
              className="cursor-pointer text-foreground underline underline-offset-4"
              onClick={signOut}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
