import { createFileRoute } from "@tanstack/react-router";
import { Spinner } from "@voidhash/ui";
import { useEffect } from "react";
import { useAuth } from "@/features/studio/components/auth-context";
import { isOrganizationWaitlisted } from "@/lib/waitlist";

export const Route = createFileRoute("/studio/_authenticated/")({
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const navigate = Route.useNavigate();

  useEffect(() => {
    // Skip waitlisted organizations so the user lands directly in one they can
    // actually use. When every organization is waitlisted the surrounding
    // `WaitlistGate` renders the waitlist screen instead of this route.
    const organizationToGoTo = user.organizations.find(
      (organization) => !isOrganizationWaitlisted(organization),
    );

    if (!organizationToGoTo) {
      void navigate({
        replace: true,
        to: "/studio/create-organization",
      });
      return;
    }

    void navigate({
      params: { organizationSlug: organizationToGoTo.slug },
      replace: true,
      to: "/studio/$organizationSlug",
    });
  }, [navigate, user]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
