"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@voidhash/ui";
import { Link as FrameworkLink, usePathname } from "fumadocs-core/framework";
import type { PageTree } from "fumadocs-core/server";
import { TreeContextProvider, useTreeContext } from "fumadocs-ui/contexts/tree";
import { ChevronRight } from "lucide-react";
import { CirclePlay } from "lucide-static";
import {
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  useMemo,
} from "react";

import { NavBar } from "../nav-bar";
import { DocsThemeToggle } from "../theme-toggle";

export interface DocsLayoutProps {
  tree: PageTree.Root;
  children: ReactNode;
}

export function DocsLayout({ tree, children }: DocsLayoutProps) {
  return (
    <SidebarProvider
      className="flex flex-col [--header-height:calc(theme(spacing.14))]"
      defaultOpen={true}
    >
      <TreeContextProvider tree={tree}>
        <NavBar />

        <div className="flex flex-1">
          <DocsSidebar />

          <SidebarInset className="top-[var(--header-height)] flex-1 transition-all duration-75">
            <div className="flex w-full">{children}</div>
          </SidebarInset>
        </div>
      </TreeContextProvider>
    </SidebarProvider>
  );
}

function DocsSidebar() {
  const { root } = useTreeContext();
  const pathname = usePathname();

  const groups = useMemo(() => {
    function transformNode(node: PageTree.Node): {
      icon?: ReactElement;
      title: string;
      url: string;
      isActive?: () => boolean;
      items?: {
        title: string;
        url: string;
        isActive?: () => boolean;
      }[];
    } | null {
      if (node.type === "page") {
        return {
          icon: node.icon as ReactElement,
          isActive: () => pathname === node.url,
          title: typeof node.name === "string" ? node.name : String(node.name),
          url: node.url,
        };
      }

      if (node.type === "folder") {
        const items = node.children
          .map(transformNode)
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (node.index) {
          return {
            icon: node.icon as ReactElement,
            isActive: () => pathname === node.index?.url || items.some((item) => item.isActive?.()),
            items: items.length > 0 ? items : undefined,
            title: typeof node.name === "string" ? node.name : String(node.name),
            url: node.index.url,
          };
        }

        if (items.length > 0) {
          return {
            icon: node.icon as ReactElement,
            isActive: () => items.some((item) => item.isActive?.()),
            items,
            title: typeof node.name === "string" ? node.name : String(node.name),
            url: "#",
          };
        }
      }

      return null;
    }

    const itemsWithDefaultGroup: PageTree.Node[] = [
      {
        $id: "get-started",
        children: root.children.filter((item) => item.type === "page"),
        icon: CirclePlay as unknown as ReactElement,
        index: {
          $id: "index.mdx",
          $ref: {
            file: "index.mdx",
          },
          name: "Index",
          type: "page",
          url: "/design",
        },
        name: "Get Started",
        type: "folder",
      },
      ...root.children.filter((item) => item.type === "folder"),
    ];

    return itemsWithDefaultGroup
      .map(transformNode)
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [root, pathname]);

  return (
    <Sidebar className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] fixed min-w-64 border-r bg-background transition-all duration-75">
      <SidebarContent className="gap-0">
        <NavMain groups={groups} link={SidebarLink} />
        <DocsThemeToggle className="mt-2 ml-5 block md:hidden" />
      </SidebarContent>
    </Sidebar>
  );
}

function SidebarLink(props: ComponentProps<"a">) {
  const href = props.href ?? "#";
  return <FrameworkLink {...props} href={href} />;
}

export function NavMain({
  link: Link,
  groups,
}: {
  link: ComponentType<ComponentProps<"a">> | "a";
  defaultOpenNested?: boolean;
  groups: {
    title: string;
    icon?: ReactElement;
    items?: {
      title: string;
      url: string;
      icon?: ReactElement;
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
        <Collapsible
          className="group/collapsible"
          defaultOpen
          key={group.title}
          title={group.title}
        >
          <SidebarGroup className="p-0">
            <SidebarGroupLabel
              asChild
              className="group/label -mt-px rounded-none border-border border-y px-6 py-5 text-sidebar-foreground text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <CollapsibleTrigger className="cursor-pointer">
                <div
                  className="*:-ml-0.5 *:mr-2 *:size-4 *:text-muted-foreground"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: It is safe - static icon markup
                  dangerouslySetInnerHTML={{
                    __html: group.icon as unknown as string,
                  }}
                />
                {group.title}
                <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="pt-1">
              <SidebarGroupContent className="p-2 pb-[9px]">
                <SidebarMenu>
                  {group.items?.map((item) => (
                    <SidebarMenuItem
                      className="px-1 font-normal text-muted-foreground"
                      key={item.title}
                    >
                      <SidebarMenuButton asChild isActive={item.isActive?.()}>
                        <Link
                          className="px-3 font-normal data-[active=true]:bg-muted data-[active=true]:font-normal data-[active=true]:text-foreground"
                          href={item.url}
                        >
                          {item.title}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      ))}
    </>
  );
}
