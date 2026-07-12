import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreatePaywallLocationModalButton } from "@/features/studio/paywall-locations/create-paywall-location-modal-button";
import { PaywallLocationRow } from "@/features/studio/paywall-locations/paywall-location-row";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import {
  listPaywallLocationsOptions,
  listPaywallsOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/paywall-locations",
)({
  component: ProjectPaywallLocationsPage,
  errorComponent: ProjectPaywallLocationsPageError,
  pendingComponent: ProjectPaywallLocationsPageSkeleton,
});

function ProjectPaywallLocationsPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading paywall locations",
      }}
    />
  );
}

function ProjectPaywallLocationsPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Paywall Locations</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        <Card className="p-0">
          <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Loading locations...
          </div>
        </Card>
      </div>
    </Page>
  );
}

function ProjectPaywallLocationsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: locations } = useSuspenseQuery(
    listPaywallLocationsOptions({ projectId: project.id }),
  );
  const { data: paywalls } = useSuspenseQuery(listPaywallsOptions({ projectId: project.id }));

  return (
    <Page>
      <PageHeader rightActions={<CreatePaywallLocationModalButton projectId={project.id} />}>
        <PageHeaderTitle>Paywall Locations</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        {locations.length === 0 ? (
          <Card className="p-0">
            <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
              No paywall locations yet. Create one to start assigning paywalls.
            </div>
          </Card>
        ) : (
          <Card className="grid gap-0 divide-y p-0">
            {locations.map((location) => (
              <PaywallLocationRow
                key={location.id}
                location={location}
                paywalls={paywalls}
                projectId={project.id}
              />
            ))}
          </Card>
        )}
      </div>
    </Page>
  );
}
