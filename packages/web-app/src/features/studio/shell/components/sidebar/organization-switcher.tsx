"use client";

import { Link } from "@tanstack/react-router";
import { GradientAvatar } from "@voidhash/ui/gradient-avatar";
import { useAuth } from "@/features/studio/components/auth-context";

import { OrganizationProjectSwitcher } from "../nav-bar/organization-project-switcher";
import { Button } from "@voidhash/ui";

export function OrganizationSwitcher({ organizationSlug }: { organizationSlug: string | null }) {
  const { user } = useAuth();

  const activeOrganization = user.organizations.find((o) => o.slug === organizationSlug);
  if (!activeOrganization) {
    return null;
  }
  return (
    <div className="flex items-center justify-between w-full">
      <Button variant="ghost" asChild className="flex-1 justify-start pl-1 rounded-l-2xl">
        <Link params={{ organizationSlug: organizationSlug ?? "" }} to="/studio/$organizationSlug">
          <div className="flex items-center gap-2">
            <GradientAvatar
              alt={activeOrganization.name}
              className="h-6 w-6 rounded-lg text-xs"
              fallback={activeOrganization.id}
              src={activeOrganization.logo ?? undefined}
            />
            <span className="truncate text-foreground- text-sm">{activeOrganization.name}</span>
          </div>
        </Link>
      </Button>
      <OrganizationProjectSwitcher
        activeOrganization={activeOrganization}
        activeProject={null}
        user={user}
      />
    </div>
  );
}
