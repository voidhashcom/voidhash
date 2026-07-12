import { resolveText, RootNode, TextNode } from "@voidhash/mimic-schema";
import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import type { DesignerStoreState } from "../designer-store-state";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../testing/offline-document";
import {
  computeLocaleCoverage,
  type GetLocalizableProps,
  readLocalizationInfo,
  selectDefaultLocale,
  selectLocalizationInfo,
} from "./localization";
import { findTypedNode } from "./node-proxies";

/** Inserts a component node under the seeded screen with literal string props. */
function seedComponentWithProps(
  doc: OfflineDesignerDocument,
  specs: readonly {
    name: string;
    base: string;
    overrides?: readonly { locale: string; value: string }[];
  }[],
): string {
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const node = (
      screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
    ).insertLast({
      type: "component",
      componentSlug: "card",
      componentVersion: 1,
      contentHash: "hash",
      name: "card",
      previewState: "default",
    });
    nodeId = node.id;
    const proxy = node as unknown as { data: { props: { push: (value: unknown) => void } } };
    for (const spec of specs) {
      proxy.data.props.push({
        name: spec.name,
        value: { type: "literal", value: { key: "string", value: spec.base } },
        localizedValues: (spec.overrides ?? []).map((override) => ({
          locale: override.locale,
          value: { key: "string", value: override.value },
        })),
      });
    }
  });
  return nodeId;
}

function rootSnapshot(doc: OfflineDesignerDocument): RootSnapshotNode {
  const node = doc.root.children.first();
  if (!node) throw new Error("expected the seeded root node");
  return node.get() as unknown as RootSnapshotNode;
}

function stateFor(doc: OfflineDesignerDocument): Pick<DesignerStoreState, "mimic"> {
  return { mimic: { snapshot: [rootSnapshot(doc)] } } as unknown as Pick<
    DesignerStoreState,
    "mimic"
  >;
}

function addConfigLocale(doc: OfflineDesignerDocument, tag: string): void {
  const { rootId } = seededIds(doc);
  doc.transaction((root) => {
    const rootNode = findTypedNode(root, rootId, RootNode);
    rootNode?.data.localization.locales.push({ tag });
  });
}

function seedTextNode(doc: OfflineDesignerDocument, text: string): string {
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const node = (
      screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
    ).insertLast({ type: "text", text });
    nodeId = node.id;
  });
  return nodeId;
}

function setTranslation(
  doc: OfflineDesignerDocument,
  nodeId: string,
  locale: string,
  value: string,
): void {
  doc.transaction((root) => {
    const node = findTypedNode(root, nodeId, TextNode);
    node?.data.localized.push({ locale, overrides: { text: value } });
  });
}

describe("localization selectors", () => {
  test("a document without extra locales reports only the default", () => {
    const doc = createOfflineDesignerDocument();
    const info = readLocalizationInfo(rootSnapshot(doc));
    expect(info).toEqual({ defaultLocale: "en", locales: [] });
    expect(selectDefaultLocale(stateFor(doc))).toBe("en");
    expect(selectLocalizationInfo(stateFor(doc))).toEqual({ defaultLocale: "en", locales: [] });
  });

  test("enabled locales are unwrapped from the CRDT config entries", () => {
    const doc = createOfflineDesignerDocument();
    addConfigLocale(doc, "de");
    addConfigLocale(doc, "pt-BR");
    expect(selectLocalizationInfo(stateFor(doc))).toEqual({
      defaultLocale: "en",
      locales: ["de", "pt-BR"],
    });
  });
});

describe("resolveText over the document snapshot", () => {
  test("renders base for the default locale and the override for a translated locale", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    setTranslation(doc, nodeId, "de", "Hallo");
    const data = findTypedNode(doc.root, nodeId, TextNode)?.get()?.data;
    if (!data) throw new Error("expected text node data");

    expect(resolveText(data, null, "en")).toBe("Hello");
    expect(resolveText(data, "en", "en")).toBe("Hello");
    expect(resolveText(data, "de", "en")).toBe("Hallo");
    // Unknown locale with no override falls back to base.
    expect(resolveText(data, "fr", "en")).toBe("Hello");
  });
});

describe("computeLocaleCoverage", () => {
  test("counts translated text slots against the total", () => {
    const doc = createOfflineDesignerDocument();
    const a = seedTextNode(doc, "One");
    seedTextNode(doc, "Two");
    setTranslation(doc, a, "de", "Eins");

    expect(computeLocaleCoverage(rootSnapshot(doc), "de", "en")).toEqual({
      translated: 1,
      total: 2,
    });
    // Nothing to translate in the default locale.
    expect(computeLocaleCoverage(rootSnapshot(doc), "en", "en")).toEqual({
      translated: 0,
      total: 0,
    });
  });

  test("includes localizable component-prop slots only when a resolver is supplied", () => {
    const doc = createOfflineDesignerDocument();
    seedComponentWithProps(doc, [
      { name: "title", base: "Hello", overrides: [{ locale: "de", value: "Hallo" }] },
      { name: "subtitle", base: "World" },
    ]);
    const getLocalizableProps: GetLocalizableProps = () => [
      { propName: "title", label: "Title" },
      { propName: "subtitle", label: "Subtitle" },
    ];

    // Both props count toward the total; only the one with a `de` override counts
    // as translated.
    expect(computeLocaleCoverage(rootSnapshot(doc), "de", "en", getLocalizableProps)).toEqual({
      translated: 1,
      total: 2,
    });
    // Without a resolver, component-prop slots are excluded entirely.
    expect(computeLocaleCoverage(rootSnapshot(doc), "de", "en")).toEqual({
      translated: 0,
      total: 0,
    });
  });
});
