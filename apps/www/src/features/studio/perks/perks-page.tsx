"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Card } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listPerksOptions } from "@/features/studio/lib/tanstack-query/perks";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { CreatePerkModalButton } from "./create-perk-modal-button";
import { PerkRecord } from "./perk-record";
import { PerksPageEmptyState } from "./perks-page-empty-state";
import { PerksPageSkeleton } from "./perks-page-skeleton";

export const PerksPage = () => {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );
  const { data: perks, status: perksStatus } = useQuery({
    ...listPerksOptions({ projectId: project?.id ?? "" }),
    enabled: !!project?.id,
  });

  if (perksStatus === "pending") {
    return <PerksPageSkeleton />;
  }

  if (perksStatus === "error" || !project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occured loading the perks",
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">Perks</h2>
          <p className="mt-1 text-muted-foreground">List of unlockable features / perks.</p>
        </div>
        {perks.length > 0 && <CreatePerkModalButton projectId={project.id} />}
      </div>

      <div className="mt-8">
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
    </div>
  );
};
