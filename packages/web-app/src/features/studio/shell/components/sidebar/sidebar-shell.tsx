import { Link as TanstackLink } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@voidhash/ui";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { OrganizationSwitcher } from "./organization-switcher";

export function SidebarShell({
  groups,
  organizationSlug,
  children,
  tooltips = "enabled",
  ...props
}: {
  organizationSlug: string;
  groups: {
    title?: string;
    items: {
      title: string;
      url: string;
      icon?: LucideIcon;
      isActive?: () => boolean;
      items?: {
        title: string;
        url: string;
        icon?: LucideIcon;
        isActive?: () => boolean;
      }[];
    }[];
  }[];
  children?: React.ReactNode;
  tooltips?: "enabled" | "disabled";
} & React.ComponentProps<typeof Sidebar>) {
  const activeParent = groups
    .flatMap((group) => group.items)
    .find((item) => item.isActive?.() && item.items?.length);

  const [submenuOpen, setSubmenuOpen] = useState(!!activeParent);

  useEffect(() => {
    if (activeParent) {
      setSubmenuOpen(true);
    }
  }, [activeParent?.title]);

  const showSubmenu = submenuOpen && !!activeParent;

  return (
    <>
      <Sidebar
        className="h-screen transition-all duration-75"
        collapsible={"none"}
        variant="inset"
        {...props}
      >
        <SidebarContent className="gap-0">
          <div className="h-(--header-height)  px-1 py-2 w-full">
            <OrganizationSwitcher organizationSlug={organizationSlug} />
          </div>

          {groups.map((group, index) => (
            <SidebarGroup
              key={group.title ?? `sidebar-group-${index}`}
              className={index === 0 ? "pt-0" : undefined}
            >
              {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
              {/* Main Menu */}
              <div className="relative">
                <SidebarMenu
                  className={`transition-all duration-150 ${showSubmenu ? "opacity-0 pointer-events-none -translate-x-3" : "opacity-100 translate-x-0"}`}
                >
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          (!item.items?.length || item.items.length === 0) && item.isActive?.()
                        }
                        tooltip={tooltips === "enabled" ? item.title : undefined}
                      >
                        <TanstackLink
                          onClick={() => {
                            if (item.items?.length) {
                              setSubmenuOpen(true);
                            }
                          }}
                          params={{ ...(item as any).params } as any}
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
                  {children}
                </SidebarMenu>

                {/* Sub Menu */}
                <SidebarMenu
                  className={`absolute inset-0 transition-all duration-150 ${showSubmenu ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none translate-x-10"}`}
                >
                  {activeParent && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => setSubmenuOpen(false)}
                          tooltip={tooltips === "enabled" ? "Back" : undefined}
                          className="cursor-pointer relative"
                        >
                          <ChevronLeft />
                          <span className="text-center absolute left-[50%] transform -translate-x-[50%]">
                            {activeParent.title}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {activeParent.items?.map((subItem) => (
                        <SidebarMenuItem key={subItem.title}>
                          <SidebarMenuButton asChild isActive={subItem.isActive?.()}>
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
          ))}
        </SidebarContent>
      </Sidebar>
    </>
  );
}
