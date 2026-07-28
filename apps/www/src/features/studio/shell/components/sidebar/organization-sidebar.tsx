"use client";

import type * as React from "react";

import { Link as TanstackLink, useLocation } from "@tanstack/react-router";
import {
  Button,
  GradientAvatar,
  Sidebar,
  SidebarGroup,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@voidhash/ui";
import { Grid2X2, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";
import { organizationSettingsNavItems } from "@/features/studio/enterprise/organization-nav-slot";
import { useRuntimeCapabilities } from "@/features/studio/enterprise/runtime-capabilities";
import { CreateProjectModal } from "@/features/studio/projects/create-project-modal";

import { SidebarShell } from "./sidebar-shell";

export function OrganizationSidebar({
  organizationSlug,
  collapsible = "icon",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationSlug: string;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  const { user } = useAuth();
  const { data: capabilities } = useRuntimeCapabilities();
  const [createOpen, setCreateOpen] = useState(false);

  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug,
  );
  const projects = activeOrganization
    ? user.projects.filter((project) => project.organizationId === activeOrganization.id)
    : [];

  const data = {
    navMain: [
      {
        items: [
          {
            icon: Grid2X2,
            isActive: () => pathname === `/studio/${organizationSlug}`,
            title: "Overview",
            url: `/studio/${organizationSlug}`,
          },
          {
            icon: Settings,
            isActive: () => pathname.startsWith(`/studio/${organizationSlug}/~/settings`),
            title: "Settings",
            url: `/studio/${organizationSlug}/~/settings`,
            items: [
              {
                isActive: () => pathname === `/studio/${organizationSlug}/~/settings`,
                title: "General",
                url: `/studio/${organizationSlug}/~/settings`,
              },
              ...organizationSettingsNavItems({ capabilities, organizationSlug, pathname }),
            ],
          },
        ],
      },
    ],
  };

  return (
    <SidebarShell
      className="transition-all duration-75"
      collapsible={collapsible}
      organizationSlug={organizationSlug}
      groups={data.navMain}
      {...props}
    >
      {activeOrganization && (
        <SidebarGroup className="px-0 border-t border-border/60 mt-4">
          <div className="mb-1 pl-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <span className="font-medium text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
              Projects
            </span>
            <CreateProjectModal
              onClose={() => setCreateOpen(false)}
              open={createOpen}
              organizationId={activeOrganization.id}
              organizationSlug={organizationSlug}
              trigger={
                <Button
                  aria-label="New project"
                  onClick={() => setCreateOpen(true)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Plus className="size-3.5" />
                </Button>
              }
            />
          </div>

          {projects.length === 0 ? (
            <SidebarMenuItem>
              <div className="py-1.5 text-sidebar-foreground/60 text-xs">No projects yet.</div>
            </SidebarMenuItem>
          ) : (
            projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(`/studio/${organizationSlug}/${project.slug}`)}
                  tooltip={project.name}
                >
                  <TanstackLink
                    params={{ organizationSlug, projectSlug: project.slug }}
                    to="/studio/$organizationSlug/$projectSlug"
                  >
                    <GradientAvatar
                      alt={project.name}
                      className="size-5 shrink-0 rounded text-[10px]"
                      fallback={project.id}
                      src={project.logo ?? undefined}
                    />
                    <span className="truncate">{project.name}</span>
                  </TanstackLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarGroup>
      )}
    </SidebarShell>
  );
}
