import {
  authenticateWithSession,
  OrganizationNotFoundError,
  OrganizationService,
  UserService
} from '@voidhash/core/services';
import { Skeleton } from '@voidhash/ui';
import { GradientAvatar } from '@voidhash/ui/gradient-avatar';
import { Effect, Either } from 'effect';
import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

const _OrganizationSwitcherComponent = Effect.fn(
  'OrganizationSwitcherComponent'
)(function* ({ organizationSlug }: { organizationSlug: string | null }) {
  if (!organizationSlug) {
    return null;
  }

  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const userService = yield* UserService;
        const organizationService = yield* OrganizationService;
        const [user, activeOrganization] = yield* Effect.all(
          [
            userService.getUser(yield* headers),
            organizationService.getOrganizationBySlug(organizationSlug).pipe(
              Effect.catchTags({
                OrganizationNotFound: () =>
                  Effect.fail(
                    new OrganizationNotFoundError({
                      message: 'Organization not found'
                    })
                  )
              })
            )
          ],
          {
            concurrency: 'unbounded'
          }
        );

        return { user, activeOrganization };
      })
    )
  );

  if (Either.isLeft(data)) {
    return null;
  }

  const { user, activeOrganization } = data.right;

  return (
    <div className="flex items-center gap-2">
      <Link href={`/${organizationSlug}`}>
        <div className="flex items-center gap-2">
          <GradientAvatar
            alt={activeOrganization.name}
            className="h-6 w-6 rounded-lg text-xs"
            fallback={activeOrganization.id}
            src={undefined}
          />
          <span className="truncate text-foreground- text-sm">
            {activeOrganization.name}
          </span>
        </div>
      </Link>
      <OrganizationProjectSwitcher
        activeOrganization={activeOrganization}
        activeProject={null}
        user={user}
      />
    </div>
  );
});

export const OrganizationSwitcherComponent = ServerComponent.build(
  _OrganizationSwitcherComponent
);

function OrganizationSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function OrganizationSwitcher({
  organizationSlug
}: {
  organizationSlug: string | null;
}) {
  return (
    <Suspense fallback={<OrganizationSwitcherSkeleton />}>
      <OrganizationSwitcherComponent organizationSlug={organizationSlug} />
    </Suspense>
  );
}
