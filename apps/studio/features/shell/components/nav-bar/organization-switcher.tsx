'use client';

import { Skeleton } from '@voidhash/ui';
import { GradientAvatar } from '@voidhash/ui/gradient-avatar';
import { useCurrentUser } from 'hooks/tanstack-query';
import Link from 'next/link';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

function OrganizationSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function OrganizationSwitcher({
  organizationSlug
}: {
  organizationSlug: string | null;
}) {
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();

  if (currentUserStatus === 'pending') {
    return <OrganizationSwitcherSkeleton />;
  }

  if (currentUserStatus === 'error') {
    return <OrganizationSwitcherSkeleton />;
  }

  if (currentUser) {
    const activeOrganization = currentUser.organizations.find(
      (o) => o.slug === organizationSlug
    );
    if (!activeOrganization) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        <Link href={`/${organizationSlug}`}>
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
          user={currentUser}
        />
      </div>
    );
  }

  return <OrganizationSwitcherSkeleton />;
}
