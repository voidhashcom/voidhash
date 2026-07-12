import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AuthProvider } from "@/components/auth-context";
import { MimicSdkProvider } from "@/components/sdk-context";
import { getCredentials } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const credentials = getCredentials();
    if (!credentials) {
      throw redirect({ to: "/login" });
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
