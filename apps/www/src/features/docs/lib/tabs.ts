import type * as PageTree from "fumadocs-core/page-tree";
import { Book, BookOpen, Code, type LucideIcon } from "lucide-react";

import { DOCS_PATH } from "@/lib/paths";

export type DocsTabId = "documentation" | "guides" | "api";

export interface DocsTab {
  id: DocsTabId;
  label: string;
  icon: LucideIcon;
  /** URL prefix that identifies pages belonging to this tab. */
  prefix: string;
  /** Landing page URL the header tab links to. */
  home: string;
}

/**
 * The three top-level documentation surfaces, rendered as tabs in the docs
 * header. Tabs are a code-level partition of the single fumadocs page tree
 * (see {@link tabNodes}) rather than fumadocs "root folders", because the docs
 * sidebar is fully custom.
 */
export const DOCS_TABS: DocsTab[] = [
  {
    id: "documentation",
    label: "Documentation",
    icon: Book,
    prefix: DOCS_PATH,
    home: `${DOCS_PATH}/introduction`,
  },
  {
    id: "guides",
    label: "Guides",
    icon: BookOpen,
    prefix: `${DOCS_PATH}/guides`,
    home: `${DOCS_PATH}/guides`,
  },
  {
    id: "api",
    label: "API Reference",
    icon: Code,
    prefix: `${DOCS_PATH}/api`,
    home: `${DOCS_PATH}/api/overview`,
  },
];

/** Resolves a folder's first descendant page URL (folders may lack an index). */
function firstPageUrl(folder: PageTree.Folder): string | undefined {
  if (folder.index) {
    return folder.index.url;
  }
  for (const child of folder.children) {
    if (child.type === "page") {
      return child.url;
    }
    if (child.type === "folder") {
      const url = firstPageUrl(child);
      if (url) {
        return url;
      }
    }
  }
  return undefined;
}

/** The representative URL for a node (undefined for separators). */
function nodeUrl(node: PageTree.Node): string | undefined {
  if (node.type === "page") {
    return node.url;
  }
  if (node.type === "folder") {
    return firstPageUrl(node);
  }
  return undefined;
}

/** Which tab a URL belongs to. Separators (no URL) fall to "documentation". */
export function tabIdForUrl(url: string | undefined): DocsTabId {
  if (url?.startsWith(`${DOCS_PATH}/guides`)) {
    return "guides";
  }
  if (url?.startsWith(`${DOCS_PATH}/api`)) {
    return "api";
  }
  return "documentation";
}

/** The active tab for the current pathname (guides/api checked before the docs root). */
export function activeTabForPathname(pathname: string): DocsTab {
  const guides = DOCS_TABS[1];
  const api = DOCS_TABS[2];
  if (pathname.startsWith(guides.prefix)) {
    return guides;
  }
  if (pathname.startsWith(api.prefix)) {
    return api;
  }
  return DOCS_TABS[0];
}

/**
 * The top-level tree nodes rendered in the sidebar for a given tab. The
 * "documentation" tab shows every root node that isn't part of the guides/api
 * folders (keeping separators for section headings); the guides/api tabs show
 * the contents of their owning folder directly.
 */
export function tabNodes(
  root: { children: PageTree.Node[] },
  tab: DocsTab,
): PageTree.Node[] {
  if (tab.id === "documentation") {
    return root.children.filter((node) => tabIdForUrl(nodeUrl(node)) === "documentation");
  }

  const folder = root.children.find(
    (node): node is PageTree.Folder =>
      node.type === "folder" && tabIdForUrl(nodeUrl(node)) === tab.id,
  );
  if (!folder) {
    return [];
  }
  const children = folder.index ? [folder.index, ...folder.children] : folder.children;

  if (tab.id === "api") {
    // The OpenAPI generator nests every tag under a `reference/` container.
    // Surface those tag folders directly under the "Reference" section so each
    // tag is its own expandable group rather than one deep slide-in.
    return children.flatMap((node) =>
      node.type === "folder" && firstPageUrl(node)?.startsWith(`${DOCS_PATH}/api/reference/`)
        ? node.children
        : [node],
    );
  }

  return children;
}
