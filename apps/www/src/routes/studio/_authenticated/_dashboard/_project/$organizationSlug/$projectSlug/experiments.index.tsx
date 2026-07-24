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
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { z } from "zod";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreateExperimentButton } from "@/features/studio/experiments/components/experiments-page/create-experiment-button";
import { ExperimentRecord } from "@/features/studio/experiments/components/experiments-page/experiment-record";
import { ExperimentsPageEmptyState } from "@/features/studio/experiments/components/experiments-page/experiments-page-empty-state";
import { ExperimentsPageSkeleton } from "@/features/studio/experiments/components/experiments-page/experiments-page-skeleton";
import { EXPERIMENT_STATUS } from "@/features/studio/experiments/lib/experiment-status";
import { listExperimentsOptions } from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
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

const isExperimentTab = (value: string): value is ExperimentTab =>
  EXPERIMENT_TABS.some((item) => item.value === value);

const experimentsSearchSchema = z.object({
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
    throw new Error("Project not found");
  }

  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: allExperiments } = useSuspenseQuery(
    listExperimentsOptions({ includeArchived: true, projectId: project.id }),
  );

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
    <Page className={cn(isEmpty && "flex flex-col")}>
      <PageHeader
        className="shrink-0"
        rightActions={<CreateExperimentButton projectId={project.id} />}
      >
        <PageHeaderTitle>A/B Tests</PageHeaderTitle>
      </PageHeader>
      <PageBar className="shrink-0 pl-2">
        <ToggleGroup
          onValueChange={(value: string) => {
            if (isExperimentTab(value)) {
              void navigate({ replace: true, search: (prev) => ({ ...prev, tab: value }) });
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
          <ExperimentsPageEmptyState projectId={project.id} tab={tab} />
        ) : (
          <Table containerClassName="overflow-x-auto">
            <TableHeader>
              <TableRow>
                <TableHead>A/B test</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Primary metric</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((experiment) => (
                <ExperimentRecord
                  experiment={experiment}
                  key={experiment.id}
                  organizationSlug={organizationSlug as string}
                  projectSlug={projectSlug as string}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Page>
  );
}
