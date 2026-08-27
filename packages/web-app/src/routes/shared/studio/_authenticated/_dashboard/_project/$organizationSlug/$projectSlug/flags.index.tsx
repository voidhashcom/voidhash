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

import { CreateFlagButton } from "@/features/studio/feature-flags/components/flags-page/create-flag-button";
import { FlagRecord } from "@/features/studio/feature-flags/components/flags-page/flag-record";
import { FlagsPageEmptyState } from "@/features/studio/feature-flags/components/flags-page/flags-page-empty-state";
import { FlagsPageSkeleton } from "@/features/studio/feature-flags/components/flags-page/flags-page-skeleton";
import { listFeatureFlagsOptions } from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const FLAG_TABS = [
  { label: "All", value: "all" },
  { label: "Enabled", value: "enabled" },
  { label: "Disabled", value: "disabled" },
  { label: "Archived", value: "archived" },
] as const;

type FlagTab = (typeof FLAG_TABS)[number]["value"];

const DEFAULT_FLAG_TAB: FlagTab = "all";

const isFlagTab = (value: string): value is FlagTab =>
  FLAG_TABS.some((item) => item.value === value);

const flagsSearchSchema = z.object({
  tab: z
    .enum(FLAG_TABS.map((item) => item.value))
    .default(DEFAULT_FLAG_TAB)
    .catch(DEFAULT_FLAG_TAB),
});

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/flags/",
)({
  component: FlagsIndexRoute,
  errorComponent: FlagsIndexPageError,
  pendingComponent: FlagsPageSkeleton,
  validateSearch: zodValidator(flagsSearchSchema),
});

/**
 * Gate the customer-facing Feature Flags product so disabled organizations
 * cannot reach it through a direct URL.
 */
function FlagsIndexRoute() {
  const featureFlagsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.featureFlags.key);

  if (!featureFlagsEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <FlagsIndexPage />;
}

function FlagsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading feature flags",
      }}
    />
  );
}

function FlagsIndexPage() {
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

  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: allFlags } = useSuspenseQuery(
    listFeatureFlagsOptions({ includeArchived: true, projectId: project.id }),
  );

  const flags = allFlags.filter((flag) => {
    const isArchived = flag.archivedAt != null;
    switch (tab) {
      case "all":
        return true;
      case "enabled":
        return !isArchived && flag.enabled;
      case "disabled":
        return !isArchived && !flag.enabled;
      case "archived":
        return isArchived;
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  });

  const isEmpty = flags.length === 0;

  return (
    <Page className={cn(isEmpty && "flex flex-col")}>
      <PageHeader className="shrink-0" rightActions={<CreateFlagButton projectId={project.id} />}>
        <PageHeaderTitle>Feature Flags</PageHeaderTitle>
      </PageHeader>
      <PageBar className="shrink-0 pl-2">
        <ToggleGroup
          onValueChange={(value: string) => {
            if (isFlagTab(value)) {
              void navigate({ replace: true, search: (prev) => ({ ...prev, tab: value }) });
            }
          }}
          type="single"
          value={tab}
        >
          {FLAG_TABS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageBar>
      <div className={cn("w-full px-4 pt-4", isEmpty && "flex flex-1 flex-col pb-4")}>
        {isEmpty ? (
          <FlagsPageEmptyState projectId={project.id} tab={tab} />
        ) : (
          <Table containerClassName="overflow-x-auto">
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <FlagRecord
                  flag={flag}
                  key={flag.id}
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
