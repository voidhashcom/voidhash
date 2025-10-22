'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  GradientAvatar,
  Skeleton
} from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { NavUserDropdown } from './nav-user-dropdown';

function NavUserSkeleton() {
  return <Skeleton className="h-8 w-8 rounded-full" />;
}

export function NavUser() {
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();

  if (currentUserStatus === 'pending') {
    return <NavUserSkeleton />;
  }

  if (currentUserStatus === 'error') {
    return <NavUserSkeleton />;
  }

  if (currentUser) {
    return (
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              type="button"
            >
              <GradientAvatar
                alt={currentUser.name}
                className="h-8 w-8 rounded-lg"
                fallback={currentUser.id}
                src={currentUser.image ?? undefined}
              />
            </button>
          </DropdownMenuTrigger>
          <NavUserDropdown user={currentUser} />
        </DropdownMenu>
      </div>
    );
  }

  return <NavUserSkeleton />;
}
