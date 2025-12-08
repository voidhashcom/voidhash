import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Skeleton } from '@voidhash/ui';
import { useAuth } from 'src/components/auth-context';
import { CreatePaywallCard } from '@/features/paywalls/create-paywall-card';
import { PaywallCard } from '@/features/paywalls/paywall-card';
import { PaywallCardSkeleton } from '@/features/paywalls/paywall-card-skeleton';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { listPaywallsOptions } from '@/lib/tanstack-query/paywalls';
import { CurrentUser } from '@/lib/utils/current-user';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/paywalls/'
)({
  pendingComponent: PaywallsPageSkeleton,
  errorComponent: PaywallsPageError,
  component: PaywallsPage
});

function PaywallsPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred loading the paywalls'
      }}
    />
  );
}

export function PaywallsPageSkeleton() {
  return (
    <div>
      <div className="mx-auto flex max-w-7xl flex-row items-center justify-between px-8 pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">Paywalls</h2>
          <p className="mt-1 text-muted-foreground">
            Design and manage your paywalls.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-6 px-8 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {/* Skeleton for create button */}

        <Skeleton className="h-full w-full rounded-xl" />

        {/* Skeleton cards */}
        {Array.from({ length: 3 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <PaywallCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function PaywallsPage() {
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

  const { data: paywalls } = useSuspenseQuery(
    listPaywallsOptions({ projectId: project.id })
  );

  return (
    <div>
      <div className="mx-auto flex max-w-7xl flex-row items-center justify-between px-8 pt-6">
        <div>
          <h1 className="font-normal text-3xl tracking-right">Paywalls</h1>
          <p className="mt-1 text-muted-foreground">
            Design and manage your paywalls.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-6 px-8 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {/* Create new paywall card - always first */}
        <CreatePaywallCard projectId={project.id} />

        {/* Existing paywalls */}
        {paywalls.map((paywall) => (
          <PaywallCard
            key={paywall.id}
            organizationSlug={organizationSlug as string}
            paywall={paywall}
            projectSlug={projectSlug as string}
          />
        ))}
      </div>
    </div>
  );
}
