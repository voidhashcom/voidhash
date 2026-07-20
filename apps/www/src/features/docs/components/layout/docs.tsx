"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Logo,
} from "@voidhash/ui";
import { Link as FrameworkLink, usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import { TreeContextProvider, useTreeContext } from "fumadocs-ui/contexts/tree";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { activeTabForPathname, tabNodes } from "../../lib/tabs";
import { NavBar } from "../nav-bar";
import { DocsThemeToggle } from "../theme-toggle";

export interface DocsLayoutProps {
  tree: PageTree.Root;
  children: ReactNode;
}

export function DocsLayout({ tree, children }: DocsLayoutProps) {
  return (
    <div className="flex flex-col [--header-height:calc(theme(spacing.12))]">
      <SidebarProvider className="flex flex-col">
        <TreeContextProvider tree={tree}>
          <NavBar />

          <div className="flex min-h-0 flex-1 pt-[var(--header-height)]">
            <DocsSidebar />

            <SidebarInset className="mt-0! transition-all duration-75">
              <div className="flex w-full">{children}</div>
            </SidebarInset>
          </div>
        </TreeContextProvider>
      </SidebarProvider>
    </div>
  );
}

interface DocsNavItem {
  title: string;
  url: string;
  icon?: ReactElement;
  isActive: boolean;
  /** Section groups rendered in the slide-in submenu when this item is a folder. */
  subGroups?: DocsNavGroup[];
}

/** A titled section; `title` is undefined for the leading, unlabeled group. */
interface DocsNavGroup {
  title?: string;
  items: DocsNavItem[];
}

const nodeName = (name: ReactNode): string => (typeof name === "string" ? name : String(name));

/**
 * Maps the active tab's slice of the fumadocs page tree onto the sidebar shape:
 * `"---Section---"` separators become titled {@link DocsNavGroup} headings, pages
 * become plain items, and folders become parent items whose descendants render
 * as their own titled groups in the slide-in submenu.
 */
function useDocsNav(): { groups: DocsNavGroup[]; items: DocsNavItem[] } {
  const { root } = useTreeContext();
  const pathname = usePathname();

  return useMemo(() => {
    function pageItem(node: PageTree.Item): DocsNavItem {
      return {
        icon: node.icon as ReactElement,
        isActive: pathname === node.url,
        title: nodeName(node.name),
        url: node.url,
      };
    }

    /**
     * Groups a folder's descendants for the slide-in submenu. Separators start a
     * new titled section; nested folders become a section titled by the folder
     * name (empty wrappers are skipped), so structure survives one level of
     * flattening instead of collapsing to a single flat list.
     */
    function folderGroups(folder: PageTree.Folder): DocsNavGroup[] {
      const groups: DocsNavGroup[] = [];
      let current: DocsNavGroup = { items: [] };
      const flush = () => {
        if (current.items.length > 0) {
          groups.push(current);
        }
        current = { items: [] };
      };
      const startSection = (title: string) => {
        flush();
        current = { title, items: [] };
      };
      const walk = (node: PageTree.Folder) => {
        if (node.index) {
          current.items.push(pageItem(node.index));
        }
        for (const child of node.children) {
          if (child.type === "separator") {
            startSection(nodeName(child.name));
          } else if (child.type === "page") {
            current.items.push(pageItem(child));
          } else if (child.type === "folder") {
            startSection(nodeName(child.name));
            walk(child);
            flush();
          }
        }
      };

      walk(folder);
      flush();
      return groups;
    }

    const tab = activeTabForPathname(pathname);
    const nodes = tabNodes(root, tab);

    const groups: DocsNavGroup[] = [];
    let current: DocsNavGroup = { items: [] };
    const flush = () => {
      if (current.items.length > 0) {
        groups.push(current);
      }
    };

    for (const node of nodes) {
      if (node.type === "separator") {
        flush();
        current = { title: nodeName(node.name), items: [] };
      } else if (node.type === "page") {
        current.items.push(pageItem(node));
      } else if (node.type === "folder") {
        const subGroups = folderGroups(node);
        const subItems = subGroups.flatMap((group) => group.items);
        if (subItems.length === 0) {
          continue;
        }
        current.items.push({
          icon: node.icon as ReactElement,
          isActive: subItems.some((item) => item.isActive),
          subGroups,
          title: nodeName(node.name),
          url: node.index?.url ?? subItems[0].url,
        });
      }
    }
    flush();

    return { groups, items: groups.flatMap((group) => group.items) };
  }, [root, pathname]);
}

function DocsSidebar() {
  const { groups, items } = useDocsNav();

  const activeParent = items.find((item) => item.isActive && item.subGroups?.length);
  const [submenuOpen, setSubmenuOpen] = useState(!!activeParent);

  useEffect(() => {
    if (activeParent) {
      setSubmenuOpen(true);
    }
  }, [activeParent?.title]);

  const showSubmenu = submenuOpen && !!activeParent;

  return (
    <Sidebar className="transition-all duration-75" collapsible="offcanvas" variant="inset">
      <SidebarContent className="gap-0">
        <div className="flex h-[var(--header-height)] w-full shrink-0 items-center px-3 py-2">
          <a className="flex items-center gap-2" href="https://voidhash.com">
            <Logo className="h-5" color="mono" variant="default" />
            <span className="rounded-md bg-muted p-1 px-2 font-semibold text-foreground text-xs uppercase">
              Docs
            </span>
          </a>
        </div>

        <SidebarGroup className="pt-0">
          <div className="relative">
            {/* Main Menu — titled section groups; folders open the slide-in submenu */}
            <div
              className={`flex flex-col gap-4 transition-all duration-150 ${showSubmenu ? "-translate-x-3 pointer-events-none opacity-0" : "translate-x-0 opacity-100"}`}
            >
              {groups.map((group, groupIndex) => (
                <div key={group.title ?? `group-${groupIndex}`}>
                  {group.title ? <SidebarGroupLabel>{group.title}</SidebarGroupLabel> : null}
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={!item.subGroups?.length && item.isActive}
                        >
                          <SidebarLink
                            href={item.url}
                            onClick={() => {
                              if (item.subGroups?.length) {
                                setSubmenuOpen(true);
                              }
                            }}
                          >
                            <NodeIcon icon={item.icon} />
                            <span>{item.title}</span>
                          </SidebarLink>
                        </SidebarMenuButton>
                        {item.subGroups?.length ? (
                          <SidebarMenuAction onClick={() => setSubmenuOpen(true)}>
                            <ChevronRight />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        ) : null}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              ))}
            </div>

            {/* Sub Menu — the opened folder's titled section groups */}
            <div
              className={`absolute inset-0 flex flex-col gap-4 transition-all duration-150 ${showSubmenu ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-10 opacity-0"}`}
            >
              {activeParent && (
                <>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="relative cursor-pointer"
                        onClick={() => setSubmenuOpen(false)}
                      >
                        <ChevronLeft />
                        <span className="-translate-x-[50%] absolute left-[50%] transform text-center">
                          {activeParent.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                  {activeParent.subGroups?.map((group, groupIndex) => (
                    <div key={group.title ?? `subgroup-${groupIndex}`}>
                      {group.title ? <SidebarGroupLabel>{group.title}</SidebarGroupLabel> : null}
                      <SidebarMenu>
                        {group.items.map((subItem) => (
                          <SidebarMenuItem key={subItem.url}>
                            <SidebarMenuButton asChild isActive={subItem.isActive}>
                              <SidebarLink href={subItem.url}>
                                <NodeIcon icon={subItem.icon} />
                                <span>{subItem.title}</span>
                              </SidebarLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </SidebarGroup>

        <DocsThemeToggle className="mt-auto mb-2 ml-4 block md:hidden" />
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * Tree icons come from the loader as raw lucide-static SVG markup (strings)
 * so they survive server-loader serialization; render them via innerHTML.
 */
function NodeIcon({ icon }: { icon?: ReactElement }) {
  if (!icon) {
    return null;
  }

  if (typeof icon === "string") {
    return (
      <span
        className="*:size-4 text-muted-foreground"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: It is safe - static icon markup
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  return icon;
}

function SidebarLink(props: ComponentProps<typeof FrameworkLink>) {
  const href = props.href ?? "#";
  return <FrameworkLink {...props} href={href} />;
}
