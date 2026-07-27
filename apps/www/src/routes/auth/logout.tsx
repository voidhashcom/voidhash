import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";
import { Spinner } from "@voidhash/ui";

import { AuthLenticularBackground } from "@/features/auth/components/auth-lenticular-background";
import { toSafeReturnPathname } from "@/features/auth/lib/validation";

export const Route = createFileRoute("/auth/logout")({
  component: LogoutPage,
  loader: async ({ location }) => {
    const returnTo = toSafeReturnPathname(
      new URLSearchParams(location.searchStr).get("returnTo"),
    ) ?? "/";

    await signOut({
      data: { returnTo },
    });
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
