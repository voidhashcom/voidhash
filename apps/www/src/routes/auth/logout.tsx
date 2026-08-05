import { createFileRoute, redirect } from "@tanstack/react-router";
import { Spinner } from "@voidhash/ui";

import { AuthLenticularBackground } from "@/features/auth/components/auth-lenticular-background";
import { performSignOut } from "@/features/auth/lib/session";
import { toSafeReturnPathname } from "@/features/auth/lib/validation";

export const Route = createFileRoute("/auth/logout")({
  component: LogoutPage,
  loader: async ({ location }) => {
    const returnTo =
      toSafeReturnPathname(new URLSearchParams(location.searchStr).get("returnTo")) ?? "/";

    // A provider with a hosted sign-out endpoint performs its own redirect and
    // reports `null`; one that only holds a cookie hands the target back to us.
    const target = await performSignOut(returnTo);
    if (target !== null) throw redirect({ href: target });
  },
});

function LogoutPage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <AuthLenticularBackground className="absolute inset-0" />
      <div className="relative z-10 flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    </div>
  );
}
