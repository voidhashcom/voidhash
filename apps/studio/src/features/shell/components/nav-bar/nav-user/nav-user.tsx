'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  GradientAvatar
} from '@voidhash/ui';
import { useAuth } from 'src/components/auth-context';
import { NavUserDropdown } from './nav-user-dropdown';

export function NavUser() {
  const { user } = useAuth();

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            type="button"
          >
            <GradientAvatar
              alt={user.name}
              className="h-8 w-8 rounded-lg"
              fallback={user.id}
              src={user.image ?? undefined}
            />
          </button>
        </DropdownMenuTrigger>
        <NavUserDropdown user={user} />
      </DropdownMenu>
    </div>
  );
}
