"use client";

import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from "@voidhash/ui";
import { useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";

import { UserAvatarForm } from "./user-avatar";

type AccountSection = "account";

const NAV_ITEMS: ReadonlyArray<{ id: AccountSection; label: string }> = [
  { id: "account", label: "Account" },
];

/**
 * User account settings rendered inside a large modal with a left nav sidebar
 * styled to match the organization/project settings navigation. Controlled by
 * the caller (the nav-bar user dropdown opens it).
 */
export function UserSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [section, setSection] = useState<AccountSection>("account");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[54rem] max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">User settings</DialogTitle>
        <DialogDescription className="sr-only">Manage your account settings.</DialogDescription>

        <aside className="flex w-52 shrink-0 flex-col gap-1 border-border/60 border-r bg-muted/30 p-3">
          <div className="px-2 py-2 font-semibold text-foreground text-sm">Settings</div>
          {NAV_ITEMS.map((item) => (
            <button
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                section === item.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-8 p-6 pt-8">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-foreground text-lg tracking-tight">Account</h2>
              <p className="text-[13px] text-muted-foreground">{user.email}</p>
            </div>
            {section === "account" ? <UserAvatarForm user={user} /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
