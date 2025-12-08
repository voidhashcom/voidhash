'use client';

import { Link, useLocation } from '@tanstack/react-router';
import { Sidebar, SidebarContent } from '@voidhash/ui';
import { Grid2X2, Settings } from 'lucide-react';
import type * as React from 'react';
import { NavMain } from './nav-main';

export function OrganizationSidebar({
  organizationSlug,
  collapsible = 'icon',
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationSlug: string;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname
  });

  const data = {
    navMain: [
      {
        title: 'Team',
        items: [
          {
            title: 'Projects',
            url: `/${organizationSlug}`,
            icon: Grid2X2,
            isActive: () => pathname === `/${organizationSlug}`
          },
          {
            title: 'Settings',
            url: `/${organizationSlug}/~/settings/general`,
            icon: Settings,
            isActive: () =>
              pathname.startsWith(`/${organizationSlug}/~/settings/general`)
          }
        ]
      }
    ]
  };

  return (
    <Sidebar
      className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] border-r transition-all duration-75"
      collapsible={collapsible}
      variant="inset"
      {...props}
    >
      <SidebarContent>
        <NavMain groups={data.navMain} link={Link} />
      </SidebarContent>
    </Sidebar>
  );
}
