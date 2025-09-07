'use client';

import { Sidebar, SidebarContent } from '@voidhash/ui';
import { Grid2X2, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import { NavMain } from './nav-main';

export function OrganizationSidebar({
  organizationSlug,
  collapsible = 'icon',
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationSlug: string;
}) {
  const pathname = usePathname();

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
