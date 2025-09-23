import { authenticateWithSession, UserService } from '@voidhash/core/services';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  GradientAvatar,
  Skeleton
} from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { NavUserDropdown } from './nav-user-dropdown';

function NavUserSkeleton() {
  return <Skeleton className="h-8 w-8 rounded-full" />;
}

export const _NavUserContent = Effect.fn('NavUserContent')(function* () {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const userService = yield* UserService;
        const user = yield* userService.getUser(yield* headers);
        return { user };
      })
    )
  );

  if (Either.isLeft(data)) {
    return <div>Error loading user</div>;
  }

  const { user } = data.right;

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            type="button"
          >
            {user && (
              <GradientAvatar
                alt={user.name}
                className="h-8 w-8 rounded-lg"
                fallback={user.id}
                src={user.image ?? undefined}
              />
            )}
          </button>
        </DropdownMenuTrigger>
        {user && <NavUserDropdown user={user} />}
      </DropdownMenu>
    </div>
  );
});

export const NavUserContent = ServerComponent.build(_NavUserContent);

export function NavUser() {
  return (
    <Suspense fallback={<NavUserSkeleton />}>
      <NavUserContent />
    </Suspense>
  );
}
