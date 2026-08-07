import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  cn,
  Page,
  PageBar,
  PageHeader,
  PageHeaderTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { z } from "zod";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreateExperimentButton } from "@/features/studio/experiments/components/experiments-page/create-experiment-button";
import { ExperimentsPageEmptyState } from "@/features/studio/experiments/components/experiments-page/experiments-page-empty-state";
import { ExperimentsPageSkeleton } from "@/features/studio/experiments/components/experiments-page/experiments-page-skeleton";
import { ExperimentsTable } from "@/features/studio/experiments/components/experiments-page/experiments-table";
import { useExperimentMetrics } from "@/features/studio/experiments/lib/experiment-metrics";
import { EXPERIMENT_STATUS } from "@/features/studio/experiments/lib/experiment-status";
import {
  listExperimentsOptions,
  listPaywallLocationsOptions,
} from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import {
  isMetricRange,
  METRIC_RANGE_OPTIONS,
  type MetricRange,
} from "@/features/studio/paywall-locations/lib/paywall-location-metrics";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const EXPERIMENT_TABS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Running", value: "running" },
  { label: "Paused", value: "paused" },
  { label: "Concluded", value: "concluded" },
  { label: "Archived", value: "archived" },
] as const;

type ExperimentTab = (typeof EXPERIMENT_TABS)[number]["value"];

const DEFAULT_EXPERIMENT_TAB: ExperimentTab = "all";
const DEFAULT_METRIC_RANGE: MetricRange = "last_30d";

const isExperimentTab = (value: string): value is ExperimentTab =>
  EXPERIMENT_TABS.some((item) => item.value === value);

// Both filters live in the URL so a view can be linked, bookmarked and survive
// a reload. `.catch` keeps stale or hand-edited params from failing validation
// and dropping the page into its error boundary.
const experimentsSearchSchema = z.object({
  range: z
    .enum(METRIC_RANGE_OPTIONS.map((option) => option.value))
    .default(DEFAULT_METRIC_RANGE)
    .catch(DEFAULT_METRIC_RANGE),
  tab: z
    .enum(EXPERIMENT_TABS.map((item) => item.value))
    .default(DEFAULT_EXPERIMENT_TAB)
    .catch(DEFAULT_EXPERIMENT_TAB),
});

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/experiments/",
)({
  component: ExperimentsIndexRoute,
  errorComponent: ExperimentsIndexPageError,
  pendingComponent: ExperimentsPageSkeleton,
  validateSearch: zodValidator(experimentsSearchSchema),
});

function ExperimentsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading A/B Tests",
      }}
    />
  );
}

/**
 * Gate the A/B Tests surface behind the `experimentation` internal feature flag,
 * matching the Feature Flags routes in the same suite.
 */
function ExperimentsIndexRoute() {
  const experimentationEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.experimentation.key);

  if (!experimentationEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <ExperimentsIndexPage />;
}

function ExperimentsIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { range, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Filter changes replace the current entry so browsing tabs doesn't bury the
  // page the user arrived from under a stack of history entries.
  const changeSearch = (next: Partial<{ range: MetricRange; tab: ExperimentTab }>) => {
    void navigate({ replace: true, search: (prev) => ({ ...prev, ...next }) });
  };

  // Archived tests come down with the rest so tab switches are a client-side
  // filter — no refetch (and no skeleton flash) when changing tabs.
  const { data: allExperiments } = useSuspenseQuery(
    listExperimentsOptions({ includeArchived: true, projectId: project.id }),
  );
  // Treatments name locations by id, but analytics events carry their slug, so
  // the table needs the mapping to scope a test's metrics. Archived locations
  // are included because a concluded test can still reference one.
  const { data: locations } = useSuspenseQuery(
    listPaywallLocationsOptions({ includeArchived: true, projectId: project.id }),
  );
  const { isPending: isMetricsPending, metricsFor } = useExperimentMetrics({
    projectId: project.id,
    range,
  });

  const locationSlugsById = new Map(locations.map((location) => [location.id, location.slug]));

  const experiments = allExperiments.filter((experiment) => {
    const isArchived = experiment.archivedAt != null;
    switch (tab) {
      case "all":
        return true;
      case "draft":
        return !isArchived && experiment.status === EXPERIMENT_STATUS.draft;
      case "running":
        return !isArchived && experiment.status === EXPERIMENT_STATUS.running;
      case "paused":
        return !isArchived && experiment.status === EXPERIMENT_STATUS.paused;
      case "concluded":
        return !isArchived && experiment.status === EXPERIMENT_STATUS.concluded;
      case "archived":
        return isArchived;
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  });

  const isEmpty = experiments.length === 0;

  return (
    // The empty state stretches to fill the inset so it can center vertically;
    // the populated table keeps the default top-aligned block flow.
    <Page className={cn(isEmpty && "flex flex-col")}>
      <PageHeader
        className="shrink-0"
        rightActions={
          <CreateExperimentButton
            organizationSlug={organizationSlug as string}
            projectId={project.id}
            projectSlug={projectSlug as string}
          />
        }
      >
        <PageHeaderTitle>A/B Tests</PageHeaderTitle>
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
            if (isExperimentTab(value)) {
              changeSearch({ tab: value });
            }
          }}
          type="single"
          value={tab}
        >
          {EXPERIMENT_TABS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageBar>
      <div className={cn("w-full px-4 pt-4", isEmpty && "flex flex-1 flex-col pb-4")}>
        {isEmpty ? (
          <ExperimentsPageEmptyState
            organizationSlug={organizationSlug as string}
            projectId={project.id}
            projectSlug={projectSlug as string}
            tab={tab}
          />
        ) : (
          <ExperimentsTable
            experiments={experiments}
            isMetricsPending={isMetricsPending}
            locationSlugsById={locationSlugsById}
            metricsFor={metricsFor}
            organizationSlug={organizationSlug as string}
            projectSlug={projectSlug as string}
          />
        )}
      </div>
    </Page>
  );
}
