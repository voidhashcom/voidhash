import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Page,
  PageHeader,
} from "@voidhash/ui";
import { ExternalLinkIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { PaywallDetailProperties } from "@/features/studio/paywalls/detail/paywall-detail-properties";
import { PaywallDetailStats } from "@/features/studio/paywalls/detail/paywall-detail-stats";
import { PaywallPhonePreview } from "@/features/studio/paywalls/detail/paywall-phone-preview";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listPaywallLocationsOptions } from "@/features/studio/lib/tanstack-query/paywall-locations";
import {
  getPaywallDraftReleaseOptions,
  listPaywallsOptions,
} from "@/features/studio/lib/tanstack-query/paywalls";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/paywalls/$id",
)({
  component: PaywallDetailPage,
  errorComponent: PaywallDetailPageError,
});

function PaywallDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the paywall",
      }}
    />
  );
}

function PaywallDetailPage() {
  const { id, organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: paywalls } = useSuspenseQuery(
    listPaywallsOptions({ includeArchived: true, projectId: project.id }),
  );
  const { data: locations } = useSuspenseQuery(
    listPaywallLocationsOptions({ projectId: project.id }),
  );
  const { data: draftRelease } = useQuery(
    getPaywallDraftReleaseOptions({ paywallId: id as string }),
  );

  const paywall = paywalls.find((item) => item.id === (id as string));

  if (!paywall) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This paywall does not exist." }} />
    );
  }

  const isArchived = paywall.archivedAt != null;
  const liveLocations = locations.filter(
    (location) => location.activeShowing?.paywallId === paywall.id,
  );
  const liveRelease = liveLocations.reduce<{ htmlUrl: string; version: number } | null>(
    (latest, location) => {
      const release = location.activeShowing?.paywallRelease;
      if (!release) {
        return latest;
      }
      return latest && latest.version >= release.version
        ? latest
        : { htmlUrl: release.htmlUrl, version: release.version };
    },
    null,
  );

  return (
    <Page>
      <PageHeader className="px-2">
        <div className="flex items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    params={{ organizationSlug, projectSlug }}
                    to="/studio/$organizationSlug/$projectSlug/paywalls"
                  >
                    Paywalls
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{paywall.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {isArchived && <Badge variant="secondary">Archived</Badge>}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7 xl:col-span-8">
            <div className="space-y-6">
              <div>
                <h1 className="font-semibold text-3xl tracking-tight">{paywall.name}</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  {liveLocations.length > 0
                    ? `Live at ${liveLocations.length} location${liveLocations.length === 1 ? "" : "s"}`
                    : "Not assigned to a location"}
                </p>
              </div>
              <PaywallDetailProperties
                createdAt={paywall.createdAt}
                draftVersion={draftRelease?.version ?? null}
                isArchived={isArchived}
                liveLocations={liveLocations}
                liveRelease={liveRelease}
                slug={paywall.slug}
              />
            </div>

            <PaywallDetailStats
              locationSlugs={liveLocations.map((location) => location.slug)}
              projectId={project.id}
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <div className="mx-auto w-full max-w-[300px] space-y-6 lg:sticky lg:top-24">
              <PaywallPhonePreview
                organizationSlug={organizationSlug}
                paywall={paywall}
                projectSlug={projectSlug}
              />
              <Button asChild className="w-full" variant="outline" size="lg">
                <Link
                  params={{ id: paywall.id, organizationSlug, projectSlug }}
                  rel="noreferrer"
                  target="_blank"
                  to="/studio/$organizationSlug/$projectSlug/design/$id"
                >
                  Edit paywall
                  <ExternalLinkIcon />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
