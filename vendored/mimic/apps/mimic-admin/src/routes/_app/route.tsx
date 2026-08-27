import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { AuthProvider } from "@/components/auth-context";
import { MimicSdkProvider } from "@/components/sdk-context";
import { getCredentials } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const credentials = getCredentials();
    if (!credentials) {
      // TanStack Router signals navigation by a thrown redirect; `runSync` on a
      // defect rethrows the redirect object verbatim so the router still sees it.
      return Effect.runSync(Effect.die(redirect({ to: "/login" })));
    }
    return { credentials };
  },
  component: AppLayout,
});

function AppLayout() {
  const { credentials } = Route.useRouteContext();
  return (
    <AuthProvider credentials={credentials}>
      <MimicSdkProvider credentials={credentials}>
        <Outlet />
      </MimicSdkProvider>
    </AuthProvider>
  );
}
