import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";
import { Spinner } from "@voidhash/ui";

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
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Spinner />
    </div>
  );
}
