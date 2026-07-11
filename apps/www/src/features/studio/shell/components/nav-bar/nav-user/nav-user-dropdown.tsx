"use client";

import {
  Avatar,
  AvatarFallback,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  GradientAvatar,
  ThemeToggle,
} from "@voidhash/ui";
import type { User } from "@voidhash/rpc";
import { BadgeCheck, LogOut, Settings, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";

import { redirectToSignOut } from "@/features/auth/lib/workos";

export function NavUserDropdown({
  user,
  onAccountClick,
}: {
  user: typeof User.Type;
  onAccountClick: () => void;
}) {
  const { setTheme, theme } = useTheme();

  const handleSignOut = () => {
    redirectToSignOut("/auth/login");
  };

  return (
    <DropdownMenuContent
      align="end"
      className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
      side="bottom"
      sideOffset={4}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar className="h-8 w-8 rounded-full">
            <GradientAvatar
              alt={user.name}
              className="h-8 w-8"
              fallback={user.id}
              src={user.image ?? undefined}
            />
            <AvatarFallback className="rounded-full">CN</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-muted-foreground text-xs">{user.email}</span>
          </div>
        </div>
      </DropdownMenuLabel>

      <DropdownMenuSeparator />
      <div className="flex w-full items-center justify-between gap-2 p-2">
        <span className="text-muted-foreground text-sm ">Theme</span>
        <div>
          <ThemeToggle setTheme={setTheme} theme={theme ?? "system"} />
        </div>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onAccountClick}>
        <Settings />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <button className="w-full" onClick={handleSignOut} type="button">
          <LogOut />
          Log out
        </button>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
