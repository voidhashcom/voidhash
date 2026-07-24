import { useSuspenseQuery } from "@tanstack/react-query";
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
  cn,
  Page,
  PageHeader,
} from "@voidhash/ui";
import { PlusIcon, RepeatIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";
import { listPaywallLocationsOptions } from "@/features/studio/lib/tanstack-query/paywall-locations";
import { listPaywallsOptions } from "@/features/studio/lib/tanstack-query/paywalls";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { PaywallLocationPhonePreview } from "@/features/studio/paywall-locations/components/paywall-location-detail-page/paywall-location-phone-preview";
import { PaywallLocationProperties } from "@/features/studio/paywall-locations/components/paywall-location-detail-page/paywall-location-properties";
import { PaywallCombobox } from "@/features/studio/paywall-locations/components/shared/paywall-combobox";
import { PaywallLocationActionsMenu } from "@/features/studio/paywall-locations/components/shared/paywall-location-actions-menu";
import { PaywallLocationStats } from "@/features/studio/paywall-locations/components/shared/paywall-location-stats";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/paywall-locations/$id",
)({
  component: PaywallLocationDetailPage,
  errorComponent: PaywallLocationDetailPageError,
});

function PaywallLocationDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the paywall location",
      }}
    />
  );
}

function PaywallLocationDetailPage() {
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

  const { data: locations } = useSuspenseQuery(
    listPaywallLocationsOptions({ includeArchived: true, projectId: project.id }),
  );
  const { data: paywalls } = useSuspenseQuery(
    listPaywallsOptions({ includeArchived: true, projectId: project.id }),
  );

  const location = locations.find((item) => item.id === (id as string));

  if (!location) {
    return (
      <VoidhashErrorCard
        error={{ code: "NOT_FOUND", message: "This paywall location does not exist." }}
      />
    );
  }

  const isArchived = location.archivedAt != null;
  const showingPaywallId = location.activeShowing?.paywallId;
  // `activeShowing.paywall` carries only id/name/slug; the full record is what
  // holds the rendered thumbnail the preview needs.
  const showingPaywall = paywalls.find((paywall) => paywall.id === showingPaywallId) ?? null;

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
                    to="/studio/$organizationSlug/$projectSlug/settings/paywall-locations"
                  >
                    Paywall Locations
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{location.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {isArchived && <Badge variant="secondary">Archived</Badge>}
          <PaywallLocationActionsMenu location={location} />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7 xl:col-span-8">
            <div className="space-y-6">
              <div>
                <h1 className="font-semibold text-3xl tracking-tight">{location.name}</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  {location.activeShowing?.paywall
                    ? `Serving ${location.activeShowing.paywall.name}`
                    : "Not serving a paywall"}
                </p>
              </div>
              <PaywallLocationProperties
                location={location}
                paywallCombobox={
                  isArchived ? undefined : (
                    <PaywallCombobox
                      currentPaywallId={showingPaywallId}
                      locationId={location.id}
                      projectId={project.id}
                      // `-ml-2.5` cancels the button's own padding so its label
                      // lines up with the plain-text values in the rows above.
                      trigger={
                        <Button
                          className={cn("-ml-2.5 max-w-full", showingPaywall && "text-foreground")}
                          size="sm"
                          variant="ghost"
                        >
                          {showingPaywall ? (
                            <span className="truncate">{showingPaywall.name}</span>
                          ) : (
                            <>
                              <PlusIcon />
                              Select a paywall...
                            </>
                          )}
                        </Button>
                      }
                    />
                  )
                }
              />
            </div>

            <PaywallLocationStats
              description="Events captured at this location."
              emptyDescription="Place a paywall here to start collecting stats."
              emptyTitle="Nothing placed yet"
              locationSlugs={location.activeShowing ? [location.slug] : []}
              projectId={project.id}
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <div className="mx-auto w-full max-w-[300px] space-y-6 lg:sticky lg:top-24">
              <PaywallLocationPhonePreview
                organizationSlug={organizationSlug as string}
                paywall={showingPaywall}
                projectSlug={projectSlug as string}
              />
              <PaywallCombobox
                currentPaywallId={showingPaywallId}
                locationId={location.id}
                projectId={project.id}
                trigger={
                  <Button className="w-full" disabled={isArchived} size="lg" variant="outline">
                    <RepeatIcon />
                    {showingPaywall ? "Change paywall" : "Place a paywall"}
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
