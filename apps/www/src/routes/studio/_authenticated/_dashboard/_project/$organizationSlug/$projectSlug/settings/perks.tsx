import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreatePerkModalButton } from "@/features/studio/perks/create-perk-modal-button";
import { PerkRecord } from "@/features/studio/perks/perk-record";
import { PerkRecordSkeleton } from "@/features/studio/perks/perk-record-skeleton";
import { PerksPageEmptyState } from "@/features/studio/perks/perks-page-empty-state";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listPerksOptions } from "@/features/studio/lib/tanstack-query/perks";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/perks",
)({
  component: PerksPage,
  errorComponent: PerksPageError,
  pendingComponent: PerksPageSkeleton,
});

function PerksPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the perks",
      }}
    />
  );
}

function PerksPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Perks</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
            <PerkRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </Page>
  );
}

function PerksPage() {
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

  const { data: perks } = useSuspenseQuery(listPerksOptions({ projectId: project.id }));

  return (
    <Page>
      <PageHeader
        rightActions={perks.length > 0 ? <CreatePerkModalButton projectId={project.id} /> : null}
      >
        <PageHeaderTitle>Perks</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        {perks.length === 0 ? (
          <PerksPageEmptyState projectId={project.id} />
        ) : (
          <Card className="grid gap-0 divide-y p-0">
            {perks.map((perk) => (
              <PerkRecord key={perk.id} perk={perk} />
            ))}
          </Card>
        )}
      </div>
    </Page>
  );
}
