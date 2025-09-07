'use client';
import type { Organization } from '@voidhash/db';
import {
  GradientAvatar,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  Skeleton
} from '@voidhash/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import { NavMain } from './nav-main';

const ActiveOrganization = ({
  activeOrganization
}: {
  activeOrganization: Organization;
}) => {
  return (
    <div className="group flex items-center gap-2">
      <ChevronLeft className="-ml-1 absolute size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      <GradientAvatar
        alt={activeOrganization.name}
        className="h-4 w-4 scale-100 rounded-lg text-xs transition-all group-hover:scale-0 group-hover:opacity-0"
        fallback={activeOrganization.id}
        src={undefined}
      />

      <span className="truncate text-foreground- text-sm">
        {activeOrganization.name}
      </span>
    </div>
  );
};

const ActiveOrganizationSkeleton = () => {
  return (
    <>
      <Skeleton className="h-4 w-4 rounded-lg" />
      <Skeleton className="h-4 w-24 rounded-lg" />
    </>
  );
};

export function ProjectSettingsSidebar({
  activeOrganization,
  isActiveOrganizationLoading,
  organizationSlug,
  projectSlug,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeOrganization: Organization | null;
  isActiveOrganizationLoading: boolean;
  organizationSlug: string;
  projectSlug: string;
}) {
  const pathname = usePathname();

  const data = {
    navMain: [
      {
        title: 'Project',
        items: [
          {
            title: 'General',
            url: `/${organizationSlug}/${projectSlug}/settings/general`,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/settings/general`
              )
          },
          {
            title: 'Payment Providers',
            url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/settings/payment-providers`
              )
          }
        ]
      }
    ]
  };

  return (
    <Sidebar
      className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] sticky flex border-r transition-all duration-75"
      collapsible="none"
      variant="inset"
      {...props}
    >
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full flex-col items-start justify-start">
          <Link
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            href={`/${organizationSlug}/~/settings/general`}
          >
            {isActiveOrganizationLoading || !activeOrganization ? (
              <ActiveOrganizationSkeleton />
            ) : (
              <ActiveOrganization activeOrganization={activeOrganization} />
            )}
          </Link>

          <div className="mt-2 w-full font-medium text-base text-foreground">
            Project Settings
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navMain} link={Link} tooltips="disabled" />
      </SidebarContent>
    </Sidebar>
  );
}
