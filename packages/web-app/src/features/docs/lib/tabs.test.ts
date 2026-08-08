import { stringOr } from "@voidhash/lib/lang";
import type * as PageTree from "fumadocs-core/page-tree";
import { describe, expect, it } from "vitest";

import { getSource } from "./source";
import { DOCS_TABS, activeTabForPathname, tabIdForUrl, tabNodes } from "./tabs";

/**
 * A page-tree `name` is a `ReactNode`; the docs tree only ever carries plain
 * strings (meta titles), so anything else reads as the empty string rather than
 * as `[object Object]`.
 */
const nameOf = (name: unknown): string => stringOr(name, "");

const pageUrls = (nodes: PageTree.Node[]): string[] =>
  nodes.flatMap((node) => (node.type === "page" ? [node.url] : []));

const separatorNames = (nodes: PageTree.Node[]): string[] =>
  nodes.flatMap((node) => (node.type === "separator" ? [nameOf(node.name)] : []));

describe("docs tabs partition", () => {
  it("maps meta separators into section headings and splits tabs by folder", async () => {
    const source = await getSource();
    const tree = source.getPageTree() as PageTree.Root;

    // `"---Get started---"` / `"---Learn---"` become separator nodes.
    expect(separatorNames(tree.children)).toEqual(
      expect.arrayContaining(["Get started", "Learn"]),
    );

    // Documentation tab: leading pages + section separators, but NOT the
    // api/guides folders (those are their own tabs).
    const docNodes = tabNodes(tree, DOCS_TABS[0]);
    expect(pageUrls(docNodes)).toContain("/docs/introduction");
    expect(separatorNames(docNodes)).toEqual(expect.arrayContaining(["Get started", "Learn"]));
    expect(
      docNodes.some(
        (node) => node.type === "folder" && tabIdForUrl(node.index?.url) !== "documentation",
      ),
    ).toBe(false);

    // API tab: conceptual pages, plus the generated tag folders hoisted to the
    // top level (not buried inside a `reference` container).
    const apiNodes = tabNodes(tree, DOCS_TABS[2]);
    expect(pageUrls(apiNodes)).toContain("/docs/api/overview");
    const apiFolders = apiNodes.filter((node): node is PageTree.Folder => node.type === "folder");
    // The `reference` container itself is gone; its tag folders (e.g. Persons) surface directly.
    expect(apiFolders.some((folder) => nameOf(folder.name).toLowerCase() === "reference")).toBe(
      false,
    );
    expect(apiFolders.some((folder) => nameOf(folder.name) === "Persons")).toBe(true);

    // Guides tab: the guides folder has content.
    expect(tabNodes(tree, DOCS_TABS[1]).length).toBeGreaterThan(0);

    // Folder-level separators (react-native/meta.yaml) also become separator
    // nodes, so the slide-in submenu can render subgroups within a folder.
    const reactNative = docNodes.find(
      (node): node is PageTree.Folder =>
        node.type === "folder" && nameOf(node.name).includes("React Native"),
    );
    expect(reactNative).toBeDefined();
    expect(separatorNames(reactNative?.children ?? [])).toEqual(
      expect.arrayContaining(["Getting started", "Advanced"]),
    );
  });

  it("routes urls and pathnames to the correct tab", () => {
    expect(tabIdForUrl("/docs/introduction")).toBe("documentation");
    expect(tabIdForUrl("/docs/api/persons")).toBe("api");
    expect(tabIdForUrl("/docs/guides/payment-providers/apple-app-store/bundle-id")).toBe("guides");
    expect(tabIdForUrl(undefined)).toBe("documentation");

    expect(activeTabForPathname("/docs/api/overview").id).toBe("api");
    expect(activeTabForPathname("/docs/guides").id).toBe("guides");
    expect(activeTabForPathname("/docs/introduction").id).toBe("documentation");
  });
});
