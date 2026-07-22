import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { ArchiveIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreatePaywallButton } from "@/features/studio/paywalls/create-paywall-button";
import { PaywallCard } from "@/features/studio/paywalls/paywall-card";
import { PaywallCardSkeleton } from "@/features/studio/paywalls/paywall-card-skeleton";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listPaywallsOptions } from "@/features/studio/lib/tanstack-query/paywalls";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

const THUMBNAIL_REFRESH_INTERVAL_MS = 2_000;
const THUMBNAIL_REFRESH_WINDOW_MS = 45_000;

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/paywalls/",
)({
  component: PaywallsPage,
  errorComponent: PaywallsPageError,
  pendingComponent: PaywallsPageSkeleton,
});

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
      <div className="grid w-full grid-cols-2 gap-6 px-4 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
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
    throw new Error("Project not found");
  }

  const [showArchived, setShowArchived] = useState(false);
  const thumbnailRefreshDeadline = useRef(Date.now() + THUMBNAIL_REFRESH_WINDOW_MS);
  const paywallsQueryOptions = listPaywallsOptions({
    includeArchived: true,
    projectId: project.id,
  });

  // Fetch archived paywalls alongside active ones so toggling visibility is a
  // client-side filter — no refetch (and no skeleton flash) when flipping it.
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

  const archivedCount = allPaywalls.filter((paywall) => paywall.archivedAt != null).length;
  const paywalls = showArchived
    ? allPaywalls
    : allPaywalls.filter((paywall) => paywall.archivedAt == null);

  return (
    <Page>
      <PageHeader
        rightActions={
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <Button onClick={() => setShowArchived((value) => !value)} size="sm" variant="ghost">
                <ArchiveIcon />
                {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
              </Button>
            )}
            <CreatePaywallButton projectId={project.id} />
          </div>
        }
      >
        <PageHeaderTitle>Paywalls</PageHeaderTitle>
      </PageHeader>
      <div className="w-full px-4 pt-4">
        {paywalls.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            No paywalls yet. Create one to get started.
          </div>
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
