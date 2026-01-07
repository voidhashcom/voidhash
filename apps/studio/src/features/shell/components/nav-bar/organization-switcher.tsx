'use client';

import { Link } from '@tanstack/react-router';
import { GradientAvatar } from '@voidhash/ui/gradient-avatar';
import { useAuth } from 'src/components/auth-context';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

export function OrganizationSwitcher({
  organizationSlug
}: {
  organizationSlug: string | null;
}) {
  const { user } = useAuth();

  const activeOrganization = user.organizations.find(
    (o) => o.slug === organizationSlug
  );
  if (!activeOrganization) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      <Link
        params={{ organizationSlug: organizationSlug ?? '' }}
        to="/$organizationSlug"
      >
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
}
