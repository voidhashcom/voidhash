"use client";

import { DropdownMenu, DropdownMenuTrigger, GradientAvatar } from "@voidhash/ui";
import { useState } from "react";
import { UserSettingsModal } from "@/features/studio/account/user-settings-modal";
import { useAuth } from "@/features/studio/components/auth-context";

import { NavUserDropdown } from "./nav-user-dropdown";

export function NavUser() {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            type="button"
          >
            <GradientAvatar
              alt={user.name}
              className="h-6 w-6 rounded-lg"
              fallback={user.id}
              src={user.image ?? undefined}
            />
          </button>
        </DropdownMenuTrigger>
        <NavUserDropdown onAccountClick={() => setSettingsOpen(true)} user={user} />
      </DropdownMenu>
      <UserSettingsModal onOpenChange={setSettingsOpen} open={settingsOpen} />
    </>
  );
}
