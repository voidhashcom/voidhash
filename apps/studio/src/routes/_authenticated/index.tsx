import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "src/components/auth-context";

import { currentUserOptions } from "@/lib/tanstack-query";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async ({ context }) => {
    const user =
      await context.queryClient.ensureQueryData(currentUserOptions());

    const organizationToGoTo = user.organizations[0];
    if (!organizationToGoTo) {
      throw redirect({ to: "/create-organization" });
    }
    throw redirect({
      params: { organizationSlug: organizationToGoTo.slug },
      to: "/$organizationSlug",
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  return <div>Hello {user.email}!</div>;
}
