import { performUndo } from "@voidhash/mimic/zustand-commander";
import {
  ComponentNode,
  RootNode,
  ScrollViewNode,
  TextNode,
  ViewNode,
} from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import { createDesignerStore, type PaywallDesignerStoreType } from "../../designer-store";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { findTypedNode } from "../../utils/node-proxies";
import {
  addLocale,
  clearLocale,
  copyLocaleFrom,
  removeLocale,
  setDefaultLocale,
  updateComponentPropLocalizedValue,
  updateNodeLocalizedImage,
  updateNodeTranslation,
} from "./locale-actions";

// ---------------------------------------------------------------------------
// Harness (mirrors component-prop-actions.test.ts: dispatch runs the command's
// forward fn and records the undo entry the commander would push).
// ---------------------------------------------------------------------------

interface TestCommand<P, R> {
  fn: (ctx: unknown, params: P) => R;
  revert: (ctx: unknown, params: P, result: R) => void;
}

function makeStore(doc: OfflineDesignerDocument): {
  store: PaywallDesignerStoreType;
  dispatch: <P, R>(command: TestCommand<P, R>, params: P) => R;
  undoDepth: () => number;
} {
  const store = createDesignerStore(doc as unknown as Parameters<typeof createDesignerStore>[0]);
  const storeApi = store as unknown as {
    getState: () => { _commander: { undoStack: unknown[] } };
    setState: (updater: (state: unknown) => unknown) => void;
  };
  return {
    store,
    dispatch: (command, params) => {
      const ctx = { getState: () => store.getState() };
      const result = command.fn(ctx, params);
      storeApi.setState((state) => {
        const s = state as { _commander: { undoStack: unknown[]; redoStack: unknown[] } };
        return {
          ...s,
          _commander: {
            ...s._commander,
            undoStack: [...s._commander.undoStack, { command, params, result, timestamp: 0 }],
            redoStack: [],
          },
        };
      });
      return result;
    },
    undoDepth: () => storeApi.getState()._commander.undoStack.length,
  };
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

function pushLocalized(
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

function readLocalized(
  doc: OfflineDesignerDocument,
  nodeId: string,
): { locale: string; text: string | undefined }[] {
  const node = findTypedNode(doc.root, nodeId, TextNode);
  const entries = node?.data.localized.get() ?? [];
  return entries.flatMap((entry) =>
    entry.value === undefined
      ? []
      : [{ locale: entry.value.locale, text: entry.value.overrides?.text }],
  );
}

function readConfigLocales(doc: OfflineDesignerDocument): string[] {
  const { rootId } = seededIds(doc);
  const rootNode = findTypedNode(doc.root, rootId, RootNode);
  const config = rootNode?.data.localization.get();
  return (config?.locales ?? []).flatMap((entry) =>
    entry.value?.tag ? [entry.value.tag] : [],
  );
}

describe("addLocale", () => {
  test("canonicalizes the tag before storing it", () => {
    const doc = createOfflineDesignerDocument();
    const { dispatch } = makeStore(doc);
    const result = dispatch(addLocale, { tag: "pt-br" });
    expect(result.entryId).not.toBeNull();
    expect(readConfigLocales(doc)).toEqual(["pt-BR"]);
  });

  test("rejects the default locale and duplicates (no undo entry, no write)", () => {
    const doc = createOfflineDesignerDocument();
    const { dispatch, undoDepth } = makeStore(doc);
    // Default locale is "en".
    expect(dispatch(addLocale, { tag: "en" }).entryId).toBeNull();
    dispatch(addLocale, { tag: "de" });
    expect(dispatch(addLocale, { tag: "DE" }).entryId).toBeNull();
    expect(readConfigLocales(doc)).toEqual(["de"]);
    // en(rejected) + de(added) + DE(rejected) → all three recorded, but only
    // the middle one wrote. The rejected dispatches still record entries with a
    // null result whose revert is a no-op.
    expect(undoDepth()).toBe(3);
  });

  test("rejects a structurally invalid tag", () => {
    const doc = createOfflineDesignerDocument();
    const { dispatch } = makeStore(doc);
    expect(dispatch(addLocale, { tag: "!!not-a-locale!!" }).entryId).toBeNull();
    expect(readConfigLocales(doc)).toEqual([]);
  });

  test("undo removes the added locale entry", () => {
    const doc = createOfflineDesignerDocument();
    const { dispatch, store } = makeStore(doc);
    dispatch(addLocale, { tag: "fr" });
    expect(readConfigLocales(doc)).toEqual(["fr"]);
    expect(performUndo(store as never)).toBe(true);
    expect(readConfigLocales(doc)).toEqual([]);
  });
});

describe("updateNodeTranslation", () => {
  test("inserts a new override entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "Hallo" });
    expect(readLocalized(doc, nodeId)).toEqual([{ locale: "de", text: "Hallo" }]);
  });

  test("updates the existing override entry in place", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    pushLocalized(doc, nodeId, "de", "Hallo");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "Servus" });
    expect(readLocalized(doc, nodeId)).toEqual([{ locale: "de", text: "Servus" }]);
  });

  test("clearing to empty removes the whole entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    pushLocalized(doc, nodeId, "de", "Hallo");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "" });
    expect(readLocalized(doc, nodeId)).toEqual([]);
  });

  test("compacts duplicate entries for the locale (first updated, rest removed)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    pushLocalized(doc, nodeId, "de", "A");
    pushLocalized(doc, nodeId, "de", "B");
    pushLocalized(doc, nodeId, "fr", "Bonjour");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "C" });
    expect(readLocalized(doc, nodeId)).toEqual([
      { locale: "de", text: "C" },
      { locale: "fr", text: "Bonjour" },
    ]);
  });

  test("undo restores the previous entries exactly (including compacted duplicates)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    pushLocalized(doc, nodeId, "de", "A");
    pushLocalized(doc, nodeId, "de", "B");
    const { dispatch, store } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "C" });
    expect(readLocalized(doc, nodeId)).toEqual([{ locale: "de", text: "C" }]);
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalized(doc, nodeId)).toEqual([
      { locale: "de", text: "A" },
      { locale: "de", text: "B" },
    ]);
  });

  test("undo of an insert removes the added entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedTextNode(doc, "Hello");
    const { dispatch, store } = makeStore(doc);
    dispatch(updateNodeTranslation, { id: nodeId, locale: "de", text: "Hallo" });
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalized(doc, nodeId)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateNodeLocalizedImage (view/scrollView/screen background image overrides)
// ---------------------------------------------------------------------------

const image = (url: string) => ({ url, resizeMode: "cover" as const });

function seedViewNode(doc: OfflineDesignerDocument): string {
  const { screenId } = seededIds(doc);
  let nodeId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    const node = (
      screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
    ).insertLast({ type: "view" });
    nodeId = node.id;
  });
  return nodeId;
}

function pushLocalizedImage(
  doc: OfflineDesignerDocument,
  nodeId: string,
  locale: string,
  url: string,
): void {
  doc.transaction((root) => {
    const node = findTypedNode(root, nodeId, ViewNode);
    node?.data.localized.push({ locale, overrides: { backgroundImage: image(url) } });
  });
}

function readLocalizedImages(
  doc: OfflineDesignerDocument,
  nodeId: string,
): { locale: string; url: string | undefined }[] {
  const node = findTypedNode(doc.root, nodeId, ViewNode);
  const entries = node?.data.localized.get() ?? [];
  return entries.flatMap((entry) =>
    entry.value === undefined
      ? []
      : [{ locale: entry.value.locale, url: entry.value.overrides?.backgroundImage?.url }],
  );
}

describe("updateNodeLocalizedImage", () => {
  test("inserts a new override entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://de"),
    });
    expect(readLocalizedImages(doc, nodeId)).toEqual([{ locale: "de", url: "https://de" }]);
  });

  test("updates the existing override entry in place", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    pushLocalizedImage(doc, nodeId, "de", "https://de");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://de2"),
    });
    expect(readLocalizedImages(doc, nodeId)).toEqual([{ locale: "de", url: "https://de2" }]);
  });

  test("clearing to null removes the whole entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    pushLocalizedImage(doc, nodeId, "de", "https://de");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, { id: nodeId, locale: "de", backgroundImage: null });
    expect(readLocalizedImages(doc, nodeId)).toEqual([]);
  });

  test("compacts duplicate entries for the locale (first updated, rest removed)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    pushLocalizedImage(doc, nodeId, "de", "https://a");
    pushLocalizedImage(doc, nodeId, "de", "https://b");
    pushLocalizedImage(doc, nodeId, "fr", "https://fr");
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://c"),
    });
    expect(readLocalizedImages(doc, nodeId)).toEqual([
      { locale: "de", url: "https://c" },
      { locale: "fr", url: "https://fr" },
    ]);
  });

  test("undo restores the previous entries exactly (including compacted duplicates)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    pushLocalizedImage(doc, nodeId, "de", "https://a");
    pushLocalizedImage(doc, nodeId, "de", "https://b");
    const { dispatch, store } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://c"),
    });
    expect(readLocalizedImages(doc, nodeId)).toEqual([{ locale: "de", url: "https://c" }]);
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalizedImages(doc, nodeId)).toEqual([
      { locale: "de", url: "https://a" },
      { locale: "de", url: "https://b" },
    ]);
  });

  test("undo of an insert removes the added entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedViewNode(doc);
    const { dispatch, store } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://de"),
    });
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalizedImages(doc, nodeId)).toEqual([]);
  });

  test("writes and reads a scrollView node's localized image, like a view", () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    let nodeId = "";
    doc.transaction((root) => {
      const screen = root.findByIdAcrossTree(screenId);
      if (!screen) throw new Error("expected the seeded screen node");
      nodeId = (
        screen.children as unknown as { insertLast: (value: unknown) => { id: string } }
      ).insertLast({ type: "scrollView" }).id;
    });
    const { dispatch } = makeStore(doc);
    dispatch(updateNodeLocalizedImage, {
      id: nodeId,
      locale: "de",
      backgroundImage: image("https://de"),
    });
    const entries = findTypedNode(doc.root, nodeId, ScrollViewNode)?.data.localized.get() ?? [];
    expect(
      entries.flatMap((entry) =>
        entry.value === undefined
          ? []
          : [{ locale: entry.value.locale, url: entry.value.overrides?.backgroundImage?.url }],
      ),
    ).toEqual([{ locale: "de", url: "https://de" }]);
  });
});

// ---------------------------------------------------------------------------
// updateComponentPropLocalizedValue (component prop localizedValues overrides)
// ---------------------------------------------------------------------------

function seedComponentNode(doc: OfflineDesignerDocument, propName: string, base: string): string {
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
    proxy.data.props.push({
      name: propName,
      value: { type: "literal", value: { key: "string", value: base } },
    });
  });
  return nodeId;
}

function pushLocalizedPropValue(
  doc: OfflineDesignerDocument,
  nodeId: string,
  propName: string,
  locale: string,
  value: string,
): void {
  doc.transaction((root) => {
    const node = findTypedNode(root, nodeId, ComponentNode);
    const prop = node?.data.props.find((entry) => entry.get()?.name === propName);
    prop?.value.localizedValues.push({ locale, value: { key: "string", value } });
  });
}

function readLocalizedPropValues(
  doc: OfflineDesignerDocument,
  nodeId: string,
  propName: string,
): { locale: string; value: string | undefined }[] {
  const node = findTypedNode(doc.root, nodeId, ComponentNode);
  const props = node?.data.props.get() ?? [];
  const prop = props.find((entry) => entry.value?.name === propName)?.value;
  const localizedValues = prop?.localizedValues ?? [];
  return localizedValues.flatMap((entry) => {
    if (entry.value === undefined) {
      return [];
    }
    const stored = entry.value.value;
    return [{ locale: entry.value.locale, value: stored.key === "string" ? stored.value : undefined }];
  });
}

describe("updateComponentPropLocalizedValue", () => {
  test("inserts a new localized value", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    const { dispatch } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: { key: "string", value: "Hallo" },
    });
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([
      { locale: "de", value: "Hallo" },
    ]);
  });

  test("updates the existing localized value in place", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "Hallo");
    const { dispatch } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: { key: "string", value: "Servus" },
    });
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([
      { locale: "de", value: "Servus" },
    ]);
  });

  test("clearing to null removes the localized value", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "Hallo");
    const { dispatch } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: null,
    });
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([]);
  });

  test("compacts duplicate entries for the locale (first updated, rest removed)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "A");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "B");
    pushLocalizedPropValue(doc, nodeId, "title", "fr", "Bonjour");
    const { dispatch } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: { key: "string", value: "C" },
    });
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([
      { locale: "de", value: "C" },
      { locale: "fr", value: "Bonjour" },
    ]);
  });

  test("undo restores the previous entries exactly (including compacted duplicates)", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "A");
    pushLocalizedPropValue(doc, nodeId, "title", "de", "B");
    const { dispatch, store } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: { key: "string", value: "C" },
    });
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([{ locale: "de", value: "C" }]);
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([
      { locale: "de", value: "A" },
      { locale: "de", value: "B" },
    ]);
  });

  test("undo of an insert removes the added entry", () => {
    const doc = createOfflineDesignerDocument();
    const nodeId = seedComponentNode(doc, "title", "Hello");
    const { dispatch, store } = makeStore(doc);
    dispatch(updateComponentPropLocalizedValue, {
      nodeId,
      propName: "title",
      locale: "de",
      value: { key: "string", value: "Hallo" },
    });
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalizedPropValues(doc, nodeId, "title")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cascade + config actions (removeLocale, setDefaultLocale, copyLocaleFrom,
// clearLocale)
// ---------------------------------------------------------------------------

function pushConfigLocale(doc: OfflineDesignerDocument, tag: string): void {
  const { rootId } = seededIds(doc);
  doc.transaction((root) => {
    const rootNode = findTypedNode(root, rootId, RootNode);
    rootNode?.data.localization.locales.push({ tag });
  });
}

function readDefaultLocale(doc: OfflineDesignerDocument): string | undefined {
  const { rootId } = seededIds(doc);
  const rootNode = findTypedNode(doc.root, rootId, RootNode);
  return rootNode?.data.localization.get()?.defaultLocale;
}

/** Seeds a document with one text/view/component node all carrying `de` entries. */
function seedGermanContent(doc: OfflineDesignerDocument): {
  textId: string;
  viewId: string;
  componentId: string;
} {
  const textId = seedTextNode(doc, "Hello");
  pushLocalized(doc, textId, "de", "Hallo");
  pushLocalized(doc, textId, "fr", "Bonjour");
  const viewId = seedViewNode(doc);
  pushLocalizedImage(doc, viewId, "de", "https://de");
  const componentId = seedComponentNode(doc, "title", "Hello");
  pushLocalizedPropValue(doc, componentId, "title", "de", "Hallo");
  return { componentId, textId, viewId };
}

describe("removeLocale (cascade)", () => {
  test("removes the config entry AND every node-level entry for the locale", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    pushConfigLocale(doc, "fr");
    const { textId, viewId, componentId } = seedGermanContent(doc);
    const { dispatch, undoDepth } = makeStore(doc);

    const result = dispatch(removeLocale, { tag: "de" });
    expect(result.removed).toBe(true);
    expect(readConfigLocales(doc)).toEqual(["fr"]);
    expect(readLocalized(doc, textId)).toEqual([{ locale: "fr", text: "Bonjour" }]);
    expect(readLocalizedImages(doc, viewId)).toEqual([]);
    expect(readLocalizedPropValues(doc, componentId, "title")).toEqual([]);
    expect(undoDepth()).toBe(1);
  });

  test("single undo restores the config entry and every removed entry exactly", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { textId, viewId, componentId } = seedGermanContent(doc);
    const { dispatch, store } = makeStore(doc);

    dispatch(removeLocale, { tag: "de" });
    expect(performUndo(store as never)).toBe(true);
    expect(readConfigLocales(doc)).toEqual(["de"]);
    expect(readLocalized(doc, textId)).toEqual([
      { locale: "fr", text: "Bonjour" },
      { locale: "de", text: "Hallo" },
    ]);
    expect(readLocalizedImages(doc, viewId)).toEqual([{ locale: "de", url: "https://de" }]);
    expect(readLocalizedPropValues(doc, componentId, "title")).toEqual([
      { locale: "de", value: "Hallo" },
    ]);
    expect(performUndo(store as never)).toBe(false);
  });

  test("no-ops for a locale that is not enabled (entries untouched)", () => {
    const doc = createOfflineDesignerDocument();
    const { textId } = seedGermanContent(doc);
    const { dispatch } = makeStore(doc);
    const result = dispatch(removeLocale, { tag: "de" });
    expect(result.removed).toBe(false);
    expect(readLocalized(doc, textId)).toEqual([
      { locale: "de", text: "Hallo" },
      { locale: "fr", text: "Bonjour" },
    ]);
  });
});

describe("setDefaultLocale", () => {
  test("swaps the default with the additional list entry (metadata only)", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const textId = seedTextNode(doc, "Hello");
    pushLocalized(doc, textId, "de", "Hallo");
    const { dispatch } = makeStore(doc);

    const result = dispatch(setDefaultLocale, { tag: "de" });
    expect(result.previousDefault).toBe("en");
    expect(readDefaultLocale(doc)).toBe("de");
    expect(readConfigLocales(doc)).toEqual(["en"]);
    // Node content is untouched — the swap is config metadata only.
    expect(readLocalized(doc, textId)).toEqual([{ locale: "de", text: "Hallo" }]);
  });

  test("rejects the current default and tags that are not enabled", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { dispatch } = makeStore(doc);
    expect(dispatch(setDefaultLocale, { tag: "en" }).previousDefault).toBeNull();
    expect(dispatch(setDefaultLocale, { tag: "fr" }).previousDefault).toBeNull();
    expect(readDefaultLocale(doc)).toBe("en");
    expect(readConfigLocales(doc)).toEqual(["de"]);
  });

  test("undo swaps back", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { dispatch, store } = makeStore(doc);
    dispatch(setDefaultLocale, { tag: "de" });
    expect(performUndo(store as never)).toBe(true);
    expect(readDefaultLocale(doc)).toBe("en");
    expect(readConfigLocales(doc)).toEqual(["de"]);
  });
});

describe("copyLocaleFrom", () => {
  test("copies text/image/prop overrides only where the target has none", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    pushConfigLocale(doc, "fr");
    // Text A: de only → fr gets the copy. Text B: fr present → untouched.
    const textA = seedTextNode(doc, "Hello");
    pushLocalized(doc, textA, "de", "Hallo");
    const textB = seedTextNode(doc, "World");
    pushLocalized(doc, textB, "de", "Welt");
    pushLocalized(doc, textB, "fr", "Monde");
    const viewId = seedViewNode(doc);
    pushLocalizedImage(doc, viewId, "de", "https://de");
    const componentId = seedComponentNode(doc, "title", "Hello");
    pushLocalizedPropValue(doc, componentId, "title", "de", "Hallo");
    const { dispatch } = makeStore(doc);

    dispatch(copyLocaleFrom, { source: "de", target: "fr" });
    expect(readLocalized(doc, textA)).toEqual([
      { locale: "de", text: "Hallo" },
      { locale: "fr", text: "Hallo" },
    ]);
    expect(readLocalized(doc, textB)).toEqual([
      { locale: "de", text: "Welt" },
      { locale: "fr", text: "Monde" },
    ]);
    expect(readLocalizedImages(doc, viewId)).toEqual([
      { locale: "de", url: "https://de" },
      { locale: "fr", url: "https://de" },
    ]);
    expect(readLocalizedPropValues(doc, componentId, "title")).toEqual([
      { locale: "de", value: "Hallo" },
      { locale: "fr", value: "Hallo" },
    ]);
  });

  test("undo removes exactly the copied entries", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    pushConfigLocale(doc, "fr");
    const textA = seedTextNode(doc, "Hello");
    pushLocalized(doc, textA, "de", "Hallo");
    const textB = seedTextNode(doc, "World");
    pushLocalized(doc, textB, "de", "Welt");
    pushLocalized(doc, textB, "fr", "Monde");
    const { dispatch, store } = makeStore(doc);

    dispatch(copyLocaleFrom, { source: "de", target: "fr" });
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalized(doc, textA)).toEqual([{ locale: "de", text: "Hallo" }]);
    expect(readLocalized(doc, textB)).toEqual([
      { locale: "de", text: "Welt" },
      { locale: "fr", text: "Monde" },
    ]);
  });

  test("no-ops when the source has no overrides or source equals target", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { dispatch } = makeStore(doc);
    expect(dispatch(copyLocaleFrom, { source: "de", target: "fr" }).copied).toBeNull();
    expect(dispatch(copyLocaleFrom, { source: "de", target: "de" }).copied).toBeNull();
  });
});

describe("clearLocale", () => {
  test("removes every node-level entry but KEEPS the config entry", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { textId, viewId, componentId } = seedGermanContent(doc);
    const { dispatch } = makeStore(doc);

    dispatch(clearLocale, { tag: "de" });
    expect(readConfigLocales(doc)).toEqual(["de"]);
    expect(readLocalized(doc, textId)).toEqual([{ locale: "fr", text: "Bonjour" }]);
    expect(readLocalizedImages(doc, viewId)).toEqual([]);
    expect(readLocalizedPropValues(doc, componentId, "title")).toEqual([]);
  });

  test("undo restores every removed entry", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { textId, viewId, componentId } = seedGermanContent(doc);
    const { dispatch, store } = makeStore(doc);

    dispatch(clearLocale, { tag: "de" });
    expect(performUndo(store as never)).toBe(true);
    expect(readLocalized(doc, textId)).toEqual([
      { locale: "fr", text: "Bonjour" },
      { locale: "de", text: "Hallo" },
    ]);
    expect(readLocalizedImages(doc, viewId)).toEqual([{ locale: "de", url: "https://de" }]);
    expect(readLocalizedPropValues(doc, componentId, "title")).toEqual([
      { locale: "de", value: "Hallo" },
    ]);
  });

  test("no-ops when the locale has no entries anywhere", () => {
    const doc = createOfflineDesignerDocument();
    pushConfigLocale(doc, "de");
    const { dispatch } = makeStore(doc);
    expect(dispatch(clearLocale, { tag: "de" }).capture).toBeNull();
  });
});
