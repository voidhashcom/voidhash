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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageHeader,
} from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { PaywallDetailStats } from "@/features/studio/paywalls/detail/paywall-detail-stats";
import { PaywallPreviewCard } from "@/features/studio/paywalls/detail/paywall-preview-card";
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
      <PageHeader
        className="px-2"
        rightActions={
          <Button asChild className="mr-2">
            <Link
              params={{ id: paywall.id, organizationSlug, projectSlug }}
              to="/studio/$organizationSlug/$projectSlug/design/$id"
            >
              Edit paywall
            </Link>
          </Button>
        }
      >
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

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-6">
            <PaywallDetailStats
              locationSlugs={liveLocations.map((location) => location.slug)}
              projectId={project.id}
            />
          </div>
          <div className="col-span-4 space-y-6">
            <PaywallPreviewCard liveRelease={liveRelease} paywall={paywall} />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Slug</p>
                  <p className="font-mono text-xs">{paywall.slug}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Live version</p>
                  <p>{liveRelease ? `v${liveRelease.version}` : "Not live"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Latest draft</p>
                  <p>{draftRelease ? `v${draftRelease.version}` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Locations</p>
                  {liveLocations.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {liveLocations.map((location) => (
                        <li key={location.id}>
                          {location.name}{" "}
                          <span className="font-mono text-muted-foreground text-xs">
                            {location.slug}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>None</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}
