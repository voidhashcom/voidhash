import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@voidhash/ui';
import { useAuth } from 'src/components/auth-context';
import { CreatePerkModalButton } from '@/features/perks/create-perk-modal-button';
import { PerkRecord } from '@/features/perks/perk-record';
import { PerksPageEmptyState } from '@/features/perks/perks-page-empty-state';
import { PerksPageSkeleton as PerksPageSkeletonComponent } from '@/features/perks/perks-page-skeleton';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { listPerksOptions } from '@/lib/tanstack-query/perks';
import { CurrentUser } from '@/lib/utils/current-user';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/developers/perks'
)({
  pendingComponent: PerksPageSkeleton,
  errorComponent: PerksPageError,
  component: PerksPage
});

function PerksPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred loading the perks'
      }}
    />
  );
}

function PerksPageSkeleton() {
  return <PerksPageSkeletonComponent />;
}

function PerksPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error('Project not found');
  }

  const { data: perks } = useSuspenseQuery(
    listPerksOptions({ projectId: project.id })
  );

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">Perks</h2>
          <p className="mt-1 text-muted-foreground">
            List of unlockable features / perks.
          </p>
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
}
