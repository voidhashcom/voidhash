'use client';

import { Sidebar, SidebarContent, useSidebar } from '@voidhash/ui';
import {
  GalleryHorizontalEnd,
  GaugeIcon,
  Package2,
  Settings,
  SquareTerminal,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { NavMain } from './nav-main';

export function ProjectSidebar({
  collapsible = 'icon',
  organizationSlug,
  projectSlug,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationSlug: string;
  projectSlug: string;
}) {
  const pathname = usePathname();

  const isSettingsRoute = pathname.includes('/settings');
  const { setOpen } = useSidebar();
  React.useEffect(() => {
    if (isSettingsRoute) {
      setOpen(false);
    } else if (!isSettingsRoute) {
      setOpen(true);
    }
  }, [isSettingsRoute, setOpen]);

  const data = {
    navMain: [
      {
        title: 'Platform',
        items: [
          {
            title: 'Overview',
            url: `/${organizationSlug}/${projectSlug}`,
            icon: GaugeIcon,
            isActive: () => pathname === `/${organizationSlug}/${projectSlug}`
          },
          {
            title: 'Customers',
            url: `/${organizationSlug}/${projectSlug}/customers`,
            icon: Users,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/customers`
              )
          },
          {
            title: 'Products',
            url: `/${organizationSlug}/${projectSlug}/products`,
            icon: Package2,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/products`
              )
          },
          {
            title: 'Developers',
            url: `/${organizationSlug}/${projectSlug}/developers`,
            icon: SquareTerminal,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/developers`
              )
          },
          {
            title: 'Settings',
            url: `/${organizationSlug}/${projectSlug}/settings/general`,
            icon: Settings,
            isActive: () =>
              pathname.startsWith(
                `/${organizationSlug}/${projectSlug}/settings/general`
              )
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
        <NavMain defaultOpenNested={true} groups={data.navMain} link={Link} />
      </SidebarContent>
    </Sidebar>
  );
}
