import { Link as TanstackLink, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Skeleton,
} from "@voidhash/ui";
import {
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  GaugeIcon,
  Gift,
  Logs,
  type LucideIcon,
  Package2,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type MenuItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive: () => boolean;
  items?: SubMenuItem[];
};

type SubMenuItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive: () => boolean;
};

export function ProjectLayoutSkeleton({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const base = `/studio/${organizationSlug}/${projectSlug}`;

  const items: MenuItem[] = [
    {
      icon: GaugeIcon,
      isActive: () => pathname === `${base}/overview`,
      title: "Overview",
      url: `${base}/overview`,
    },
    {
      icon: ChartNoAxesColumnIncreasing,
      isActive: () => pathname.startsWith(`${base}/analytics`),
      title: "Analytics",
      url: `${base}/analytics/revenue`,
      items: [
        {
          isActive: () => pathname === `${base}/analytics/revenue`,
          title: "Revenue",
          url: `${base}/analytics/revenue`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/analytics/subscribers`),
          title: "Subscribers",
          url: `${base}/analytics/subscribers`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/analytics/trials`),
          title: "Trials",
          url: `${base}/analytics/trials`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/analytics/churn`),
          title: "Churn",
          url: `${base}/analytics/churn`,
        },
      ],
    },
    {
      icon: Users,
      isActive: () => pathname.startsWith(`${base}/persons`),
      title: "People",
      url: `${base}/persons`,
    },
    {
      icon: Package2,
      isActive: () =>
        pathname.startsWith(`${base}/products`) || pathname.startsWith(`${base}/settings/perks`),
      title: "Products",
      url: `${base}/products`,
      items: [
        {
          icon: Package2,
          isActive: () => pathname.startsWith(`${base}/products`),
          title: "Products",
          url: `${base}/products`,
        },
        {
          icon: Gift,
          isActive: () => pathname.startsWith(`${base}/settings/perks`),
          title: "Perks",
          url: `${base}/settings/perks`,
        },
      ],
    },
    {
      icon: Logs,
      isActive: () => pathname.startsWith(`${base}/activity`),
      title: "Activity",
      url: `${base}/activity/events`,
      items: [
        {
          isActive: () => pathname.startsWith(`${base}/activity/events`),
          title: "Analytics events",
          url: `${base}/activity/events`,
        },
      ],
    },
    {
      icon: Settings,
      isActive: () => pathname.startsWith(`${base}/settings`),
      title: "Settings",
      url: `${base}/settings`,
      items: [
        {
          isActive: () => pathname === `${base}/settings`,
          title: "General",
          url: `${base}/settings`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/settings/api-keys`),
          title: "API Keys",
          url: `${base}/settings/api-keys`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/settings/webhooks`),
          title: "Webhooks",
          url: `${base}/settings/webhooks`,
        },
        {
          isActive: () => pathname.startsWith(`${base}/settings/payment-providers`),
          title: "Payment Providers",
          url: `${base}/settings/payment-providers`,
        },
      ],
    },
  ];

  const activeParent = items.find((item) => item.isActive() && item.items?.length);
  const [submenuOpen, setSubmenuOpen] = useState(!!activeParent);

  useEffect(() => {
    if (activeParent) {
      setSubmenuOpen(true);
    }
  }, [activeParent]);

  const showSubmenu = submenuOpen && !!activeParent;

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
                <div className="relative">
                  <SidebarMenu
                    className={`transition-all duration-150 ${showSubmenu ? "opacity-0 pointer-events-none -translate-x-3" : "opacity-100 translate-x-0"}`}
                  >
                    {items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={
                            (!item.items?.length || item.items.length === 0) && item.isActive()
                          }
                          tooltip={item.title}
                        >
                          <TanstackLink
                            onClick={() => {
                              if (item.items?.length) {
                                setSubmenuOpen(true);
                              }
                            }}
                            to={item.url as any}
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </TanstackLink>
                        </SidebarMenuButton>
                        {item.items?.length && (
                          <SidebarMenuAction onClick={() => setSubmenuOpen(true)}>
                            <ChevronRight />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>

                  <SidebarMenu
                    className={`absolute inset-0 transition-all duration-150 ${showSubmenu ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none translate-x-10"}`}
                  >
                    {activeParent && (
                      <>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            className="cursor-pointer relative"
                            onClick={() => setSubmenuOpen(false)}
                            tooltip="Back"
                          >
                            <ChevronLeft />
                            <span className="text-center absolute left-[50%] transform -translate-x-[50%]">
                              {activeParent.title}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {activeParent.items?.map((subItem) => (
                          <SidebarMenuItem key={subItem.title}>
                            <SidebarMenuButton asChild isActive={subItem.isActive()}>
                              <TanstackLink to={subItem.url as any}>
                                {subItem.icon && <subItem.icon />}
                                <span>{subItem.title}</span>
                              </TanstackLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </>
                    )}
                  </SidebarMenu>
                </div>
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
        <div className="flex items-center">
          <div className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-l-2xl">
            <Skeleton className="size-6 rounded-lg shrink-0" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex items-center justify-center size-9 px-1">
            <ChevronsUpDown className="size-4 text-sidebar-foreground/40" />
          </div>
        </div>
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
