import type { Link as TanstackLink } from "@tanstack/react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@voidhash/ui";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function NavMain({
  link: Link,
  groups,
  tooltips = "enabled",
  defaultOpenNested = false,
}: {
  link: typeof TanstackLink;
  defaultOpenNested?: boolean;
  groups: {
    title: string;
    items: {
      title: string;
      url: string;
      icon?: LucideIcon;
      isActive?: () => boolean;
      items?: {
        title: string;
        url: string;
        isActive?: () => boolean;
      }[];
    }[];
  }[];
  tooltips?: "enabled" | "disabled";
}) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <Collapsible
                asChild
                defaultOpen={defaultOpenNested}
                key={item.title}
                open={item.isActive?.() ? true : undefined}
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      (!item.items?.length || item.items.length === 0) &&
                      item.isActive?.()
                    }
                    tooltip={tooltips === "enabled" ? item.title : null}
                  >
                    <Link
                      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                      params={{ ...(item as any).params } as any}
                      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                      to={item.url as any}
                    >
                      {item.icon && (
                        <item.icon className="text-muted-foreground" />
                      )}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="data-[state=open]:rotate-90">
                          <ChevronRight />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={subItem.isActive?.()}
                              >
                                <Link to={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
