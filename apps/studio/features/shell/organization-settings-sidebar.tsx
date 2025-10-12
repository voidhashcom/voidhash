'use client';
import { Result } from '@effect-atom/atom-react';
import {
  GradientAvatar,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton
} from '@voidhash/ui';
import { useUser } from 'atom/user';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type * as React from 'react';
import { NavMain } from './nav-main';

const SidebarProjects = ({
  organizationSlug
}: {
  organizationSlug: string;
}) => {
  return useUser().pipe(
    Result.matchWithWaiting({
      onWaiting: () => <SidebarProjectsSkeleton />,
      onError: () => <SidebarProjectsSkeleton />,
      onDefect: () => <SidebarProjectsSkeleton />,
      onSuccess: ({ value: user }) => {
        const organization = user.organizations.find(
          (o) => o.slug === organizationSlug
        );
        const projects = organization
          ? user.projects.filter((p) => p.organizationId === organization?.id)
          : [];

        return (
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton asChild isActive={false} tooltip={null}>
                  <Link
                    href={`/${organizationSlug}/${project.slug}/settings/general`}
                  >
                    <div className="flex items-center gap-2">
                      <GradientAvatar
                        alt={project.name}
                        className="h-6 w-6 rounded-lg text-xs"
                        fallback={project.id}
                        src={undefined}
                      />
                      <span className="truncate text-foreground- text-sm">
                        {project.name}
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        );
      }
    })
  );
};

const SidebarProjectsSkeleton = () => {
  return (
    <SidebarMenu>
      {Array.from({ length: 3 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
        <SidebarMenuItem key={index}>
          <SidebarMenuButton asChild isActive={false} tooltip={null}>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
};

export function OrganizationSettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { organizationSlug } = useParams();
  const data = {
    navMain: [
      {
        title: 'Team',
        items: [
          {
            title: 'General',
            url: `/${organizationSlug}/~/settings/general`,
            isActive: () =>
              pathname.startsWith(`/${organizationSlug}/~/settings/general`)
          }
          // TODO: Add members settings and billing
          // {
          // 	title: "Members",
          // 	url: `/~/${organizationSlug}/settings/members`,
          // 	isActive: () =>
          // 		routerState.location.pathname.startsWith(
          // 			`/~/${organizationSlug}/settings/members`
          // 		),
          // },
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
        <div className="flex w-full items-center justify-between">
          <div className="font-medium text-base text-foreground">
            Team Settings
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navMain} link={Link} tooltips="disabled" />
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarProjects
            organizationSlug={
              typeof organizationSlug === 'string' ? organizationSlug : ''
            }
          />
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
