import { Link as TanstackLink, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Skeleton,
} from "@voidhash/ui";
import { ChevronsUpDown, Grid2X2, Settings } from "lucide-react";

export function OrganizationLayoutSkeleton({ organizationSlug }: { organizationSlug: string }) {
  const pathname = useLocation({ select: (location) => location.pathname });

  const overviewActive = pathname === `/studio/${organizationSlug}`;
  const settingsActive = pathname.startsWith(`/studio/${organizationSlug}/~/settings`);

  return (
    <div className="flex flex-col [--header-height:calc(theme(spacing.12))]">
      <SidebarProvider className="flex flex-col">
        <NavBarSkeleton />
        <div className="flex flex-1 pt-[var(--header-height)] min-h-0">
          <Sidebar className="transition-all duration-75" collapsible="icon" variant="inset">
            <SidebarContent className="gap-0">
              <div className="h-(--header-height) px-1 py-2 w-full">
                <SwitcherSkeleton />
              </div>

              <SidebarGroup className="pt-0">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={overviewActive} tooltip="Overview">
                      <TanstackLink params={{ organizationSlug }} to="/studio/$organizationSlug">
                        <Grid2X2 />
                        <span>Overview</span>
                      </TanstackLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={settingsActive} tooltip="Settings">
                      <TanstackLink
                        params={{ organizationSlug }}
                        to="/studio/$organizationSlug/~/settings"
                      >
                        <Settings />
                        <span>Settings</span>
                      </TanstackLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>

              <SidebarGroup className="px-2 border-t border-border/60 mt-4">
                <div className="mb-1 pl-2 flex items-center justify-between">
                  <span className="font-medium text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
                    Projects
                  </span>
                  <Skeleton className="size-7 rounded-md" />
                </div>
                {Array.from({ length: 4 }).map((_, index) => (
                  <SidebarMenuItem key={index}>
                    <div className="flex h-9 w-full items-center gap-3 rounded-md p-2">
                      <Skeleton className="size-5 shrink-0 rounded" />
                      <Skeleton className="h-3.5 flex-1 max-w-32" />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="transition-all duration-75 mt-0!" />
        </div>
      </SidebarProvider>
    </div>
  );
}

function NavBarSkeleton() {
  return (
    <div className="fixed z-50 flex h-[var(--header-height)] w-[calc(100vw-var(--sidebar-width))] left-[var(--sidebar-width)] flex-col justify-between bg-sidebar transition-all duration-75">
      <div className="flex items-center justify-between pr-4 h-full">
        <div className="flex items-center gap-7" />
        <div className="flex items-center justify-center gap-6">
          <Skeleton className="size-6 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SwitcherSkeleton() {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 flex-1 h-9 pl-1 pr-2 rounded-l-2xl">
        <Skeleton className="size-6 rounded-lg shrink-0" />
        <Skeleton className="h-3.5 flex-1 max-w-32" />
      </div>
      <div className="flex items-center justify-center size-9 px-1">
        <ChevronsUpDown className="size-4 text-sidebar-foreground/40" />
      </div>
    </div>
  );
}
