import { Skeleton } from '@voidhash/ui';
import { GradientAvatar } from '@voidhash/ui/gradient-avatar';
import { Effect } from 'effect';
import Link from 'next/link';
import { Suspense } from 'react';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { UserService } from '@/lib/services/user.service';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

const OrganizationSwitcherComponent = async ({
  organizationSlug
}: {
  organizationSlug: string | null;
}) => {
  if (!organizationSlug) {
    return null;
  }

  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const userService = yield* UserService;
          const organizationService = yield* OrganizationService;
          const [user, activeOrganization] = yield* Effect.all(
            [
              userService.getUser(),
              organizationService.getOrganizationBySlug(organizationSlug).pipe(
                Effect.catchTags({
                  OrganizationNotFound: () =>
                    Effect.fail(
                      new NotFoundError({
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
      );
    })
  );

  if (data.isErr()) {
    return null;
  }

  const { user, activeOrganization } = data.value;

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
};

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
