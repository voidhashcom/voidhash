import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  cn,
  DataTableSkeleton,
  Page,
  PageBar,
  PageHeader,
  PageHeaderTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { z } from "zod";
import { useAuth } from "@/features/studio/components/auth-context";
import {
  listPaywallLocationsOptions,
  listPaywallsOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import {
  isMetricRange,
  METRIC_RANGE_OPTIONS,
  type MetricRange,
  usePaywallLocationMetrics,
} from "@/features/studio/paywall-locations/lib/paywall-location-metrics";
import { CreatePaywallLocationModalButton } from "@/features/studio/paywall-locations/components/paywall-locations-page/create-paywall-location-modal-button";
import { PaywallLocationsPageEmptyState } from "@/features/studio/paywall-locations/components/paywall-locations-page/paywall-locations-page-empty-state";
import { PaywallLocationsTable } from "@/features/studio/paywall-locations/components/paywall-locations-page/paywall-locations-table";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const LOCATION_TABS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "empty", label: "Empty" },
  { value: "archived", label: "Archived" },
] as const;

type LocationTab = (typeof LOCATION_TABS)[number]["value"];

const DEFAULT_LOCATION_TAB: LocationTab = "all";
const DEFAULT_METRIC_RANGE: MetricRange = "last_30d";

const isLocationTab = (value: string): value is LocationTab =>
  LOCATION_TABS.some((item) => item.value === value);

// Both filters live in the URL so a view can be linked, bookmarked and survive
// a reload. `.catch` keeps stale or hand-edited params from failing validation
// and dropping the page into its error boundary.
const paywallLocationsSearchSchema = z.object({
  range: z
    .enum(METRIC_RANGE_OPTIONS.map((option) => option.value))
    .default(DEFAULT_METRIC_RANGE)
    .catch(DEFAULT_METRIC_RANGE),
  tab: z
    .enum(LOCATION_TABS.map((item) => item.value))
    .default(DEFAULT_LOCATION_TAB)
    .catch(DEFAULT_LOCATION_TAB),
});

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/paywall-locations/",
)({
  component: ProjectPaywallLocationsPage,
  errorComponent: ProjectPaywallLocationsPageError,
  pendingComponent: ProjectPaywallLocationsPageSkeleton,
  validateSearch: zodValidator(paywallLocationsSearchSchema),
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
      <PageBar className="pl-2">
        <div className="flex items-center gap-4">
          {LOCATION_TABS.map((tab) => (
            <div className="h-5 w-14 rounded bg-muted" key={tab.value} />
          ))}
        </div>
      </PageBar>
      <div className="w-full px-4 pt-4">
        <DataTableSkeleton />
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

  const { range, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Filter changes replace the current entry so browsing tabs doesn't bury the
  // page the user arrived from under a stack of history entries.
  const changeSearch = (next: Partial<{ range: MetricRange; tab: LocationTab }>) => {
    void navigate({ replace: true, search: (prev) => ({ ...prev, ...next }) });
  };

  // Archived locations come down with the rest so tab switches are a
  // client-side filter — no refetch (and no skeleton flash) when changing tabs.
  const { data: allLocations } = useSuspenseQuery(
    listPaywallLocationsOptions({ includeArchived: true, projectId: project.id }),
  );
  // A location can keep serving an archived paywall, so the lookup that feeds
  // the hover preview has to include archived records too.
  const { data: paywalls } = useSuspenseQuery(
    listPaywallsOptions({ includeArchived: true, projectId: project.id }),
  );
  const { isPending: isMetricsPending, metricsFor } = usePaywallLocationMetrics({
    projectId: project.id,
    range,
  });

  const paywallsById = new Map(paywalls.map((paywall) => [paywall.id, paywall]));

  const locations = allLocations.filter((location) => {
    const isArchived = location.archivedAt != null;
    switch (tab) {
      case "all":
        return true;
      case "live":
        return !isArchived && location.activeShowing != null;
      case "empty":
        return !isArchived && location.activeShowing == null;
      case "archived":
        return isArchived;
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  });

  const hasNoLocations = allLocations.length === 0;

  return (
    // The empty state stretches to fill the inset so it can center vertically;
    // the populated table keeps the default top-aligned block flow.
    <Page className={cn(hasNoLocations && "flex flex-col")}>
      <PageHeader
        className="shrink-0"
        rightActions={<CreatePaywallLocationModalButton projectId={project.id} />}
      >
        <PageHeaderTitle>Paywall Locations</PageHeaderTitle>
      </PageHeader>
      <PageBar
        className="shrink-0 pl-2"
        rightActions={
          <ToggleGroup
            onValueChange={(value: string) => {
              if (isMetricRange(value)) {
                changeSearch({ range: value });
              }
            }}
            type="single"
            value={range}
          >
            {METRIC_RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem className="cursor-pointer" key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <ToggleGroup
          onValueChange={(value: string) => {
            if (isLocationTab(value)) {
              changeSearch({ tab: value });
            }
          }}
          type="single"
          value={tab}
        >
          {LOCATION_TABS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageBar>
      <div className={cn("w-full px-4 pt-4", hasNoLocations && "flex flex-1 flex-col pb-4")}>
        {hasNoLocations ? (
          <PaywallLocationsPageEmptyState projectId={project.id} />
        ) : locations.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">
            No locations in this view.
          </p>
        ) : (
          <PaywallLocationsTable
            isMetricsPending={isMetricsPending}
            locations={locations}
            metricsFor={metricsFor}
            organizationSlug={organizationSlug as string}
            paywallsById={paywallsById}
            projectSlug={projectSlug as string}
          />
        )}
      </div>
    </Page>
  );
}
