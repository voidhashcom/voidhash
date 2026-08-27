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
import { useRef, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/features/studio/components/auth-context";
import { listPaywallsOptions } from "@/features/studio/lib/tanstack-query/paywalls";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { CreatePaywallButton } from "@/features/studio/paywalls/components/paywalls-page/create-paywall-button";
import { PaywallCard } from "@/features/studio/paywalls/components/paywalls-page/paywall-card";
import { PaywallCardSkeleton } from "@/features/studio/paywalls/components/paywalls-page/paywall-card-skeleton";
import { PaywallTable } from "@/features/studio/paywalls/components/paywalls-page/paywall-table";
import {
  loadPaywallView,
  type PaywallView,
  PaywallViewSettings,
  persistPaywallView,
} from "@/features/studio/paywalls/components/paywalls-page/paywall-view-settings";
import { PaywallsPageEmptyState } from "@/features/studio/paywalls/components/paywalls-page/paywalls-page-empty-state";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const THUMBNAIL_REFRESH_INTERVAL_MS = 2_000;
const THUMBNAIL_REFRESH_WINDOW_MS = 45_000;

const PAYWALL_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
] as const;

type PaywallTab = (typeof PAYWALL_TABS)[number]["value"];

const DEFAULT_PAYWALL_TAB: PaywallTab = "active";

const isPaywallTab = (value: string): value is PaywallTab =>
  PAYWALL_TABS.some((item) => item.value === value);

// The status filter lives in the URL so a view can be linked, bookmarked and
// survive a reload. `.catch` keeps a stale or hand-edited `?tab=` from failing
// validation and dropping the page into its error boundary.
const paywallsSearchSchema = z.object({
  tab: z
    .enum(PAYWALL_TABS.map((item) => item.value))
    .default(DEFAULT_PAYWALL_TAB)
    .catch(DEFAULT_PAYWALL_TAB),
});

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/paywalls/",
)({
  component: PaywallsIndexRoute,
  errorComponent: PaywallsPageError,
  pendingComponent: PaywallsPageSkeleton,
  validateSearch: zodValidator(paywallsSearchSchema),
});

function PaywallsIndexRoute() {
  const paywallsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.paywalls.key);

  if (!paywallsEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <PaywallsPage />;
}

function PaywallsPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the paywalls",
      }}
    />
  );
}

function PaywallsPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Paywalls</PageHeaderTitle>
      </PageHeader>
      <PageBar>
        <div className="flex items-center gap-4">
          {PAYWALL_TABS.map((tab) => (
            <div className="h-5 w-14 rounded bg-muted" key={tab.value} />
          ))}
        </div>
      </PageBar>
      <div className="grid w-full grid-cols-2 gap-6 px-4 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <PaywallCardSkeleton key={index} />
        ))}
      </div>
    </Page>
  );
}

function PaywallsPage() {
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
  // Filter changes replace the current entry so browsing tabs doesn't bury the
  // page the user arrived from under a stack of history entries.
  const changeTab = (next: PaywallTab) => {
    void navigate({ replace: true, search: (prev) => ({ ...prev, tab: next }) });
  };
  const [view, setView] = useState<PaywallView>(loadPaywallView);
  const changeView = (next: PaywallView) => {
    setView(next);
    persistPaywallView(next);
  };
  const thumbnailRefreshDeadline = useRef(Date.now() + THUMBNAIL_REFRESH_WINDOW_MS);
  const paywallsQueryOptions = listPaywallsOptions({
    includeArchived: true,
    projectId: project.id,
  });

  // Fetch archived paywalls alongside active ones so tab switches are a
  // client-side filter — no refetch (and no skeleton flash) when changing tabs.
  const { data: allPaywalls } = useSuspenseQuery({
    ...paywallsQueryOptions,
    // Thumbnail generation starts after the designer connection becomes idle,
    // so the first list response commonly arrives before thumbnailUrl is set.
    refetchInterval: (query) =>
      Date.now() < thumbnailRefreshDeadline.current &&
      query.state.data?.some((paywall) => paywall.thumbnailUrl === null)
        ? THUMBNAIL_REFRESH_INTERVAL_MS
        : false,
  });

  const paywalls = allPaywalls.filter((paywall) => {
    const isArchived = paywall.archivedAt != null;
    switch (tab) {
      case "all":
        return true;
      case "active":
        return !isArchived;
      case "inactive":
        // Paywalls only have archived vs not today; nothing maps to inactive yet.
        return false;
      case "archived":
        return isArchived;
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  });

  const isEmpty = paywalls.length === 0;

  return (
    // The empty state stretches to fill the inset so it can center vertically;
    // the populated list keeps the default top-aligned block flow.
    <Page className={cn(isEmpty && "flex flex-col")}>
      <PageHeader
        className="shrink-0"
        rightActions={<CreatePaywallButton projectId={project.id} />}
      >
        <PageHeaderTitle>Paywalls</PageHeaderTitle>
      </PageHeader>
      <PageBar
        className="shrink-0 pl-2"
        rightActions={<PaywallViewSettings onViewChange={changeView} view={view} />}
      >
        <ToggleGroup
          onValueChange={(value: string) => {
            if (isPaywallTab(value)) {
              changeTab(value);
            }
          }}
          type="single"
          value={tab}
        >
          {PAYWALL_TABS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageBar>
      <div className={cn("w-full px-4 pt-4", isEmpty && "flex flex-1 flex-col pb-4")}>
        {isEmpty ? (
          <PaywallsPageEmptyState projectId={project.id} tab={tab} />
        ) : view === "table" ? (
          <PaywallTable
            organizationSlug={organizationSlug as string}
            paywalls={paywalls}
            projectSlug={projectSlug as string}
          />
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {paywalls.map((paywall) => (
              <PaywallCard
                key={paywall.id}
                organizationSlug={organizationSlug as string}
                paywall={paywall}
                projectSlug={projectSlug as string}
              />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
