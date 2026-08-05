"use client";

import { Sheet, SheetContent, SheetTitle, cn } from "@voidhash/ui";
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

import { STUDIO_PATH } from "@/lib/paths";

import { DOCS_TABS, activeTabForPathname, tabNodes } from "../../lib/tabs";
import { NavBar } from "../nav-bar";
import { DocsThemeToggle } from "../theme-toggle";

export interface DocsLayoutProps {
  tree: PageTree.Root;
  children: ReactNode;
}

/**
 * The public documentation shell: a hairline-ruled header over a fixed
 * navigation column, themed from the marketing palette rather than the app's
 * (see `features/docs/styles/globals.css` for the `.docs-shell` theme).
 */
export function DocsLayout({ tree, children }: DocsLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="docs-shell min-h-screen bg-background text-foreground [--docs-header-height:3.5rem] [--docs-sidebar-width:16.5rem]">
      <TreeContextProvider tree={tree}>
        <NavBar onOpenNav={() => setMobileNavOpen(true)} />

        <aside className="fixed inset-y-0 top-(--docs-header-height) left-0 z-30 hidden w-(--docs-sidebar-width) overflow-y-auto border-border border-r px-3 pt-6 pb-16 lg:block">
          <DocsNav />
        </aside>

        <Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
          <SheetContent
            className="w-[19rem] border-border bg-background p-0 lg:hidden"
            side="left"
          >
            <SheetTitle className="sr-only">Documentation navigation</SheetTitle>
            <div className="flex h-full flex-col overflow-y-auto px-3 pt-14 pb-6">
              <MobileTabs onNavigate={() => setMobileNavOpen(false)} />
              <DocsNav onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-8 flex items-center justify-between gap-3 px-3">
                <DocsThemeToggle className="flex" />
                <a
                  className="text-muted-foreground text-sm tracking-[-0.01em] transition-colors hover:text-foreground"
                  href={STUDIO_PATH}
                >
                  Dashboard
                </a>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex w-full pt-(--docs-header-height) lg:pl-(--docs-sidebar-width)">
          {children}
        </div>
      </TreeContextProvider>
    </div>
  );
}

/** The header's tab row, folded into the drawer where the header can't show it. */
function MobileTabs({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const active = activeTabForPathname(pathname);

  return (
    <div className="mb-5 flex flex-col gap-1 border-border border-b pb-5">
      {DOCS_TABS.map((tab) => (
        <FrameworkLink
          className={cn(
            "rounded-md px-3 py-1.5 text-[13.5px] tracking-[-0.01em] transition-colors",
            tab.id === active.id
              ? "bg-accent font-medium text-foreground"
              : "text-foreground/65 hover:text-foreground",
          )}
          href={tab.home}
          key={tab.id}
          onClick={onNavigate}
        >
          {tab.label}
        </FrameworkLink>
      ))}
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

function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
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
    <div className="relative">
      {/* Main menu — titled section groups; folders open the slide-in submenu */}
      <div
        className={cn(
          "flex flex-col gap-5 transition-all duration-150",
          showSubmenu
            ? "-translate-x-3 pointer-events-none opacity-0"
            : "translate-x-0 opacity-100",
        )}
      >
        {groups.map((group, groupIndex) => (
          <NavGroup
            group={group}
            key={group.title ?? `group-${groupIndex}`}
            onNavigate={onNavigate}
            onOpenSubmenu={() => setSubmenuOpen(true)}
          />
        ))}
      </div>

      {/* Sub menu — the opened folder's titled section groups */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col gap-5 transition-all duration-150",
          showSubmenu
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-10 opacity-0",
        )}
      >
        {activeParent ? (
          <div className="flex flex-col gap-5">
            <button
              className="flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-[13.5px] text-foreground tracking-[-0.01em] transition-colors hover:bg-accent"
              onClick={() => setSubmenuOpen(false)}
              type="button"
            >
              <ChevronLeft className="size-3.5 text-muted-foreground" />
              <span>{activeParent.title}</span>
            </button>
            {activeParent.subGroups?.map((group, groupIndex) => (
              <NavGroup
                group={group}
                key={group.title ?? `subgroup-${groupIndex}`}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NavGroup({
  group,
  onNavigate,
  onOpenSubmenu,
}: {
  group: DocsNavGroup;
  onNavigate?: () => void;
  onOpenSubmenu?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {group.title ? (
        <div className="px-3 pb-1 font-medium text-[12.5px] text-muted-foreground/70 tracking-[-0.005em]">
          {group.title}
        </div>
      ) : null}
      {group.items.map((item) => (
        <NavItem item={item} key={item.url} onNavigate={onNavigate} onOpenSubmenu={onOpenSubmenu} />
      ))}
    </div>
  );
}

function NavItem({
  item,
  onNavigate,
  onOpenSubmenu,
}: {
  item: DocsNavItem;
  onNavigate?: () => void;
  onOpenSubmenu?: () => void;
}) {
  const isFolder = !!item.subGroups?.length;

  return (
    <div className="relative flex items-center">
      <NavLink
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-[13.5px] tracking-[-0.01em] transition-colors",
          !isFolder && item.isActive
            ? "bg-accent font-medium text-foreground"
            : "text-foreground/65 hover:bg-accent/60 hover:text-foreground",
          isFolder && "pr-9",
        )}
        href={item.url}
        onClick={() => {
          if (isFolder) {
            onOpenSubmenu?.();
          }
          onNavigate?.();
        }}
      >
        <NodeIcon icon={item.icon} />
        <span className="truncate">{item.title}</span>
      </NavLink>
      {isFolder ? (
        <button
          aria-label={`Open ${item.title}`}
          className="absolute right-1 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          onClick={onOpenSubmenu}
          type="button"
        >
          <ChevronRight className="size-3.5" />
        </button>
      ) : null}
    </div>
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
        className="*:size-4 shrink-0 text-muted-foreground"
        // It is safe - static icon markup
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  return icon;
}

function NavLink(props: ComponentProps<typeof FrameworkLink>) {
  const href = props.href ?? "#";
  return <FrameworkLink {...props} href={href} />;
}
