'use client';

import { Result } from '@effect-atom/atom-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  GradientAvatar,
  Skeleton
} from '@voidhash/ui';
import { useUser } from 'atom/user';
import { NavUserDropdown } from './nav-user-dropdown';

function NavUserSkeleton() {
  return <Skeleton className="h-8 w-8 rounded-full" />;
}

export function NavUser() {
  return useUser().pipe(
    Result.matchWithWaiting({
      onWaiting: () => <NavUserSkeleton />,
      onError: () => <NavUserSkeleton />,
      onDefect: () => <NavUserSkeleton />,
      onSuccess: ({ value: user }) => (
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
      )
    })
  );
}
