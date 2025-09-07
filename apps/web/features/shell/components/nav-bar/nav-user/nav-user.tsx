import {
  DropdownMenu,
  DropdownMenuTrigger,
  GradientAvatar,
  Skeleton
} from '@voidhash/ui';
import { Effect } from 'effect';
import { Suspense } from 'react';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { UserService } from '@/lib/services/user.service';
import { NavUserDropdown } from './nav-user-dropdown';

function NavUserSkeleton() {
  return <Skeleton className="h-8 w-8 rounded-full" />;
}

export async function NavUserContent() {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const userService = yield* UserService;
          const user = yield* userService.getUser();
          return { user };
        })
      );
    })
  );

  if (data.isErr()) {
    return <div>Error loading user</div>;
  }

  const { user } = data.value;

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
}

export function NavUser() {
  return (
    <Suspense fallback={<NavUserSkeleton />}>
      <NavUserContent />
    </Suspense>
  );
}
