import {
  canonicalizeLocaleTag,
  ComponentNode,
  entryValue,
  RootNode,
  ScreenNode,
  ScrollViewNode,
  TextNode,
  ViewNode,
} from "@voidhash/mimic-schema";
import type {
  BackgroundImageSnapshot,
  LocalizedImageOverride,
  MaybeEntry,
} from "@voidhash/mimic-schema";
import type { Primitive } from "@voidhash/mimic-core";
import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../../designer-commander";
import {
  componentPropValueFromRaw,
  type ComponentPropValuePlain,
} from "../../utils/component-prop-values";
import { selectDocumentRoot } from "../../utils/document-root";
import { readLocalizationInfo } from "../../utils/localization";
import { findTypedNode, type DesignerDocumentRoot } from "../../utils/node-proxies";

/** A captured `localized` entry value, replayed verbatim on undo. */
interface CapturedLocalizedEntry {
  readonly locale: string;
  readonly overrides: { readonly text?: string };
}

/** A captured view/screen `localized` image entry value, replayed verbatim on undo. */
interface CapturedLocalizedImageEntry {
  readonly locale: string;
  readonly backgroundImage: BackgroundImageSnapshot | undefined;
}

/** A captured component-prop `localizedValues` entry, replayed verbatim on undo. */
interface CapturedLocalizedPropEntry {
  readonly locale: string;
  /** Raw stored value; re-narrowed through `componentPropValueFromRaw` on undo. */
  readonly raw: unknown;
}

/**
 * Bivariant structural view of a view/scrollView/screen node's `localized` array
 * proxy. ViewNode, ScrollViewNode and ScreenNode declare identical `localized`
 * schemas (whole-value `overrides.backgroundImage`); this shared shape lets one
 * write path serve all three without narrowing to a concrete node primitive
 * (mirrors the structural-proxy technique in `style-action-helpers`).
 */
interface LocalizedImageEntryProxy {
  get(): LocalizedImageOverride | undefined;
  remove(): void;
  value: { overrides: { set(value: { backgroundImage: BackgroundImageSnapshot }): void } };
}
interface LocalizedImageArrayProxy {
  filter(predicate: (entry: LocalizedImageEntryProxy) => boolean): LocalizedImageEntryProxy[];
  push(input: { locale: string; overrides: { backgroundImage: BackgroundImageSnapshot } }): unknown;
}

/**
 * Resolves the `localized` array proxy of a view, scrollView or screen node, or
 * `undefined` when the id is missing or not a view/scrollView/screen node.
 */
function localizedImageArray(
  root: DesignerDocumentRoot,
  nodeId: string,
): LocalizedImageArrayProxy | undefined {
  const found = root.findByIdAcrossTree(nodeId);
  if (found === undefined) {
    return undefined;
  }
  if (found.type === "view") {
    return found.as(ViewNode).data.localized;
  }
  if (found.type === "scrollView") {
    return found.as(ScrollViewNode).data.localized;
  }
  if (found.type === "screen") {
    return found.as(ScreenNode).data.localized;
  }
  return undefined;
}

/** Snapshot-derived plan of every node that carries entries for one locale. */
interface LocaleEntryPlan {
  readonly textNodeIds: readonly string[];
  readonly imageNodeIds: readonly string[];
  readonly propSlots: readonly { nodeId: string; propName: string }[];
}

/**
 * Everything one locale stored across the tree, captured before a cascade
 * removal so undo can replay it verbatim (values only; array positions are not
 * preserved, matching the mimic entry-restore discipline).
 */
interface LocaleEntriesCapture {
  readonly texts: readonly { nodeId: string; text: string | undefined }[];
  readonly images: readonly { nodeId: string; backgroundImage: BackgroundImageSnapshot | undefined }[];
  readonly props: readonly { nodeId: string; propName: string; raw: unknown }[];
}

/** Structural view of a snapshot node for the locale-entry tree walk. */
interface LocaleWalkNode {
  readonly type: string;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly children: readonly LocaleWalkNode[];
}

type LocaleTaggedEntry = MaybeEntry<{ locale: string } | undefined>;

function hasLocaleEntry(entries: unknown, locale: string): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => entryValue(entry as LocaleTaggedEntry)?.locale === locale)
  );
}

/**
 * Walks the committed snapshot and lists every node holding a `localized`
 * (text/view/scrollView/screen) or component-prop `localizedValues` entry for `locale`.
 * The plan only enumerates node ids/prop names; values are re-read through the
 * live proxies inside the mutating transaction, so a concurrent edit between
 * planning and writing cannot be captured stale, and a concurrently deleted
 * node simply resolves to `undefined` and is skipped.
 */
function planLocaleEntries(root: RootSnapshotNode, locale: string): LocaleEntryPlan {
  const textNodeIds: string[] = [];
  const imageNodeIds: string[] = [];
  const propSlots: { nodeId: string; propName: string }[] = [];
  const visit = (node: LocaleWalkNode): void => {
    if (
      node.type === "text" ||
      node.type === "view" ||
      node.type === "scrollView" ||
      node.type === "screen"
    ) {
      if (hasLocaleEntry(node.data["localized"], locale)) {
        (node.type === "text" ? textNodeIds : imageNodeIds).push(node.id);
      }
    } else if (node.type === "component") {
      const props = node.data["props"];
      for (const propEntry of Array.isArray(props) ? props : []) {
        const prop = entryValue(
          propEntry as MaybeEntry<{ name: string; localizedValues?: unknown } | undefined>,
        );
        if (prop !== undefined && hasLocaleEntry(prop.localizedValues, locale)) {
          propSlots.push({ nodeId: node.id, propName: prop.name });
        }
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root as unknown as LocaleWalkNode);
  return { textNodeIds, imageNodeIds, propSlots };
}

function planIsEmpty(plan: LocaleEntryPlan): boolean {
  return (
    plan.textNodeIds.length === 0 && plan.imageNodeIds.length === 0 && plan.propSlots.length === 0
  );
}

/**
 * Removes every node-level entry for `locale` named by `plan`, capturing each
 * removed value first. Must run inside the mutating transaction.
 */
function captureAndRemoveLocaleEntries(
  docRoot: DesignerDocumentRoot,
  locale: string,
  plan: LocaleEntryPlan,
): LocaleEntriesCapture {
  const texts: { nodeId: string; text: string | undefined }[] = [];
  for (const nodeId of plan.textNodeIds) {
    const node = findTypedNode(docRoot, nodeId, TextNode);
    if (node === undefined) {
      continue;
    }
    for (const entry of node.data.localized.filter(
      (candidate) => candidate.get()?.locale === locale,
    )) {
      const snapshot = entry.get();
      if (snapshot !== undefined) {
        texts.push({ nodeId, text: snapshot.overrides?.text });
      }
      entry.remove();
    }
  }

  const images: { nodeId: string; backgroundImage: BackgroundImageSnapshot | undefined }[] = [];
  for (const nodeId of plan.imageNodeIds) {
    const localized = localizedImageArray(docRoot, nodeId);
    if (localized === undefined) {
      continue;
    }
    for (const entry of localized.filter((candidate) => candidate.get()?.locale === locale)) {
      const snapshot = entry.get();
      if (snapshot !== undefined) {
        images.push({ nodeId, backgroundImage: snapshot.overrides?.backgroundImage });
      }
      entry.remove();
    }
  }

  const props: { nodeId: string; propName: string; raw: unknown }[] = [];
  for (const slot of plan.propSlots) {
    const node = findTypedNode(docRoot, slot.nodeId, ComponentNode);
    const prop = node?.data.props.find((entry) => entry.get()?.name === slot.propName);
    if (prop === undefined) {
      continue;
    }
    for (const entry of prop.value.localizedValues.filter(
      (candidate) => candidate.get()?.locale === locale,
    )) {
      const snapshot = entry.get();
      if (snapshot !== undefined) {
        props.push({ nodeId: slot.nodeId, propName: slot.propName, raw: snapshot.value });
      }
      entry.remove();
    }
  }

  return { texts, images, props };
}

/**
 * Replays a {@link LocaleEntriesCapture} back onto the tree for `locale`.
 * Nodes deleted since the capture are skipped.
 */
function restoreLocaleEntries(
  docRoot: DesignerDocumentRoot,
  locale: string,
  capture: LocaleEntriesCapture,
): void {
  for (const item of capture.texts) {
    findTypedNode(docRoot, item.nodeId, TextNode)?.data.localized.push({
      locale,
      overrides: { text: item.text },
    });
  }
  for (const item of capture.images) {
    if (item.backgroundImage === undefined) {
      continue;
    }
    localizedImageArray(docRoot, item.nodeId)?.push({
      locale,
      overrides: { backgroundImage: item.backgroundImage },
    });
  }
  for (const item of capture.props) {
    const value = componentPropValueFromRaw(item.raw);
    if (value === undefined) {
      continue;
    }
    const node = findTypedNode(docRoot, item.nodeId, ComponentNode);
    const prop = node?.data.props.find((entry) => entry.get()?.name === item.propName);
    prop?.value.localizedValues.push({ locale, value });
  }
}

/**
 * Enables an additional locale on the document.
 *
 * Undoable. The tag is canonicalized via `Intl.getCanonicalLocales`; the write
 * is rejected (no-op, `entryId: null`) when the tag is structurally invalid,
 * already enabled, or equal to the default locale (whose content IS the base
 * props — it is never listed). Undo removes the pushed config entry.
 */
export const addLocale = commander.undoableAction<{ tag: string }, { entryId: string | null }>(
  (ctx, params) => {
    const state = ctx.getState();
    const root = selectDocumentRoot(state);
    const info = readLocalizationInfo(root);
    const canonical = canonicalizeLocaleTag(params.tag);
    if (
      canonical === null ||
      canonical === info.defaultLocale ||
      info.locales.includes(canonical)
    ) {
      return { entryId: null };
    }
    const rootId = root.id;
    const { mimic } = state;
    const entryId = mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      if (rootNode === undefined) {
        return null;
      }
      return rootNode.data.localization.locales.push({ tag: canonical }).id;
    });
    return { entryId };
  },
  (ctx, params, result) => {
    if (result.entryId === null) {
      return;
    }
    const state = ctx.getState();
    const rootId = selectDocumentRoot(state).id;
    state.mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      rootNode?.data.localization.locales.remove(result.entryId as string);
    });
  },
);

/**
 * Removes a locale from the document, CASCADE: one transaction removes the
 * config entry AND every node-level entry for that locale — text/view/scrollView/screen
 * `localized` entries and component-prop `localizedValues` entries — across the
 * whole tree. No-op (`removed: false`) when the tag is not an enabled
 * additional locale. Undo re-enables the locale and replays every removed
 * entry exactly, as one undo step.
 */
export const removeLocale = commander.undoableAction<
  { tag: string },
  { removed: boolean; capture: LocaleEntriesCapture | null }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const root = selectDocumentRoot(state);
    const rootId = root.id;
    const plan = planLocaleEntries(root, params.tag);
    const { mimic } = state;
    return mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      if (rootNode === undefined) {
        return { removed: false, capture: null };
      }
      const entry = rootNode.data.localization.locales.find(
        (candidate) => candidate.get()?.tag === params.tag,
      );
      if (entry === undefined) {
        return { removed: false, capture: null };
      }
      entry.remove();
      return { removed: true, capture: captureAndRemoveLocaleEntries(docRoot, params.tag, plan) };
    });
  },
  (ctx, params, result) => {
    if (!result.removed) {
      return;
    }
    const state = ctx.getState();
    const rootId = selectDocumentRoot(state).id;
    state.mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      rootNode?.data.localization.locales.push({ tag: params.tag });
      if (result.capture !== null) {
        restoreLocaleEntries(docRoot, params.tag, result.capture);
      }
    });
  },
);

/**
 * Makes an enabled additional locale the document's default. Metadata-only
 * swap: sets `localization.defaultLocale`, removes the tag from the additional
 * list and adds the previous default to it — NO node content moves, so all base
 * props are simply relabeled as the new default's content and the former
 * default keeps no overrides of its own. No-op (`previousDefault: null`) when
 * the tag is already the default or not enabled. Undo swaps back.
 */
export const setDefaultLocale = commander.undoableAction<
  { tag: string },
  { previousDefault: string | null }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const root = selectDocumentRoot(state);
    const info = readLocalizationInfo(root);
    if (params.tag === info.defaultLocale || !info.locales.includes(params.tag)) {
      return { previousDefault: null };
    }
    const rootId = root.id;
    const previousDefault = state.mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      if (rootNode === undefined) {
        return null;
      }
      swapDefaultLocale(rootNode, info.defaultLocale, params.tag);
      return info.defaultLocale;
    });
    return { previousDefault };
  },
  (ctx, params, result) => {
    if (result.previousDefault === null) {
      return;
    }
    const previousDefault = result.previousDefault;
    const state = ctx.getState();
    const rootId = selectDocumentRoot(state).id;
    state.mimic.document.transaction((docRoot) => {
      const rootNode = findTypedNode(docRoot, rootId, RootNode);
      if (rootNode !== undefined) {
        swapDefaultLocale(rootNode, params.tag, previousDefault);
      }
    });
  },
);

/** Promotes `to` from the additional list to default, demoting `from` into the list. */
function swapDefaultLocale(
  rootNode: Primitive.TypedNodeProxy<typeof RootNode>,
  from: string,
  to: string,
): void {
  const localization = rootNode.data.localization;
  for (const entry of localization.locales.filter((candidate) => candidate.get()?.tag === to)) {
    entry.remove();
  }
  localization.defaultLocale.set(to);
  localization.locales.push({ tag: from });
}

/** The slots `copyLocaleFrom` filled, so undo can remove exactly those target entries. */
interface CopiedLocaleSlots {
  readonly textNodeIds: readonly string[];
  readonly imageNodeIds: readonly string[];
  readonly propSlots: readonly { nodeId: string; propName: string }[];
}

/**
 * Copies translations from `source` to `target`: for every slot where SOURCE
 * has an override and TARGET does not, the source value is copied (text, image,
 * component prop). Slots where the target already has an override are left
 * untouched. One undo entry; undo removes exactly the copied target entries.
 */
export const copyLocaleFrom = commander.undoableAction<
  { source: string; target: string },
  { copied: CopiedLocaleSlots | null }
>(
  (ctx, params) => {
    if (params.source === params.target) {
      return { copied: null };
    }
    const state = ctx.getState();
    const root = selectDocumentRoot(state);
    const plan = planLocaleEntries(root, params.source);
    if (planIsEmpty(plan)) {
      return { copied: null };
    }
    const { mimic } = state;
    const copied = mimic.document.transaction((docRoot) => {
      const textNodeIds: string[] = [];
      for (const nodeId of plan.textNodeIds) {
        const node = findTypedNode(docRoot, nodeId, TextNode);
        if (node === undefined || node.data.localized.filter(hasLocale(params.target)).length > 0) {
          continue;
        }
        const text = node.data.localized
          .filter(hasLocale(params.source))[0]
          ?.get()?.overrides?.text;
        if (text === undefined) {
          continue;
        }
        node.data.localized.push({ locale: params.target, overrides: { text } });
        textNodeIds.push(nodeId);
      }

      const imageNodeIds: string[] = [];
      for (const nodeId of plan.imageNodeIds) {
        const localized = localizedImageArray(docRoot, nodeId);
        if (localized === undefined || localized.filter(hasLocale(params.target)).length > 0) {
          continue;
        }
        const backgroundImage = localized.filter(hasLocale(params.source))[0]?.get()?.overrides
          ?.backgroundImage;
        if (backgroundImage === undefined) {
          continue;
        }
        localized.push({ locale: params.target, overrides: { backgroundImage } });
        imageNodeIds.push(nodeId);
      }

      const propSlots: { nodeId: string; propName: string }[] = [];
      for (const slot of plan.propSlots) {
        const node = findTypedNode(docRoot, slot.nodeId, ComponentNode);
        const prop = node?.data.props.find((entry) => entry.get()?.name === slot.propName);
        if (
          prop === undefined ||
          prop.value.localizedValues.filter(hasLocale(params.target)).length > 0
        ) {
          continue;
        }
        const raw = prop.value.localizedValues.filter(hasLocale(params.source))[0]?.get()?.value;
        const value = componentPropValueFromRaw(raw);
        if (value === undefined) {
          continue;
        }
        prop.value.localizedValues.push({ locale: params.target, value });
        propSlots.push(slot);
      }

      return { textNodeIds, imageNodeIds, propSlots };
    });
    return { copied };
  },
  (ctx, params, result) => {
    if (result.copied === null) {
      return;
    }
    const copied = result.copied;
    const state = ctx.getState();
    state.mimic.document.transaction((docRoot) => {
      // The copied slots had NO target entry before the copy, so removing every
      // target-locale entry at exactly those slots restores the prior state.
      captureAndRemoveLocaleEntries(docRoot, params.target, copied);
    });
  },
);

/** Predicate over `localized`/`localizedValues` entry proxies matching one locale. */
function hasLocale(locale: string) {
  return (entry: { get(): { locale: string } | undefined }): boolean =>
    entry.get()?.locale === locale;
}

/**
 * Removes every node-level entry for a locale while KEEPING its config entry —
 * the locale stays enabled, fully untranslated. No-op (`capture: null`) when
 * the locale has no entries anywhere. One undo entry; undo replays every
 * removed entry exactly.
 */
export const clearLocale = commander.undoableAction<
  { tag: string },
  { capture: LocaleEntriesCapture | null }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const root = selectDocumentRoot(state);
    const plan = planLocaleEntries(root, params.tag);
    if (planIsEmpty(plan)) {
      return { capture: null };
    }
    const capture = state.mimic.document.transaction((docRoot) =>
      captureAndRemoveLocaleEntries(docRoot, params.tag, plan),
    );
    return { capture };
  },
  (ctx, params, result) => {
    if (result.capture === null) {
      return;
    }
    const capture = result.capture;
    const state = ctx.getState();
    state.mimic.document.transaction((docRoot) => {
      restoreLocaleEntries(docRoot, params.tag, capture);
    });
  },
);

/**
 * Inserts, updates, or clears a text node's translation for a locale.
 *
 * Undoable, text nodes only. Insert-or-update semantics on the node's
 * `localized` array: the FIRST entry matching `locale` is updated in place;
 * absent it is appended; any duplicate entries for that locale are compacted
 * away (removed). `text: ""` clears the override — since `text` is the only
 * override field on text nodes, the whole entry is removed and the node falls
 * back to its base text. Undo restores exactly the entries that existed for the
 * locale before the write (their values; array position is not preserved,
 * matching the mimic entry-restore discipline).
 */
export const updateNodeTranslation = commander.undoableAction<
  { id: string; locale: string; text: string },
  { previous: readonly CapturedLocalizedEntry[] | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    return mimic.document.transaction((docRoot) => {
      const node = findTypedNode(docRoot, params.id, TextNode);
      if (node === undefined) {
        return { previous: null };
      }
      const matches = node.data.localized.filter(
        (entry) => entry.get()?.locale === params.locale,
      );
      const previous: CapturedLocalizedEntry[] = matches.flatMap((entry) => {
        const snapshot = entry.get();
        return snapshot === undefined
          ? []
          : [{ locale: snapshot.locale, overrides: { text: snapshot.overrides?.text } }];
      });

      if (params.text === "") {
        // Clearing removes the whole entry (text is the only override field).
        for (const entry of matches) {
          entry.remove();
        }
        return { previous };
      }

      const [first, ...rest] = matches;
      if (first === undefined) {
        node.data.localized.push({ locale: params.locale, overrides: { text: params.text } });
      } else {
        first.value.overrides.text.set(params.text);
        for (const duplicate of rest) {
          duplicate.remove();
        }
      }
      return { previous };
    });
  },
  (ctx, params, result) => {
    if (result.previous === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((docRoot) => {
      const node = findTypedNode(docRoot, params.id, TextNode);
      if (node === undefined) {
        return;
      }
      // Drop whatever this write left for the locale, then replay the captured
      // entries verbatim — one uniform reversal for insert/update/clear/compact.
      for (const entry of node.data.localized.filter(
        (candidate) => candidate.get()?.locale === params.locale,
      )) {
        entry.remove();
      }
      for (const entry of result.previous ?? []) {
        node.data.localized.push({
          locale: entry.locale,
          overrides: { text: entry.overrides.text },
        });
      }
    });
  },
);

/**
 * Inserts, updates, or clears a view/scrollView/screen node's localized
 * background image for a locale.
 *
 * Undoable, view/scrollView/screen nodes only. Same insert-or-update + duplicate-compaction
 * discipline as {@link updateNodeTranslation}, on the node's `localized` array.
 * `backgroundImage` (url + resizeMode) is a whole value: the entry's `overrides`
 * container is set outright (structured overrides write the whole container).
 * `backgroundImage: null` clears the override — since `backgroundImage` is the
 * only override field on these nodes, the whole entry is removed and the node
 * falls back to its base `style.backgroundImage`. Undo restores exactly the
 * entries that existed for the locale before the write.
 */
export const updateNodeLocalizedImage = commander.undoableAction<
  { id: string; locale: string; backgroundImage: BackgroundImageSnapshot | null },
  { previous: readonly CapturedLocalizedImageEntry[] | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    return mimic.document.transaction((docRoot) => {
      const localized = localizedImageArray(docRoot, params.id);
      if (localized === undefined) {
        return { previous: null };
      }
      const matches = localized.filter((entry) => entry.get()?.locale === params.locale);
      const previous: CapturedLocalizedImageEntry[] = matches.flatMap((entry) => {
        const snapshot = entry.get();
        return snapshot === undefined
          ? []
          : [{ locale: snapshot.locale, backgroundImage: snapshot.overrides?.backgroundImage }];
      });

      if (params.backgroundImage === null) {
        // Clearing removes the whole entry (backgroundImage is the only field).
        for (const entry of matches) {
          entry.remove();
        }
        return { previous };
      }

      const [first, ...rest] = matches;
      if (first === undefined) {
        localized.push({
          locale: params.locale,
          overrides: { backgroundImage: params.backgroundImage },
        });
      } else {
        first.value.overrides.set({ backgroundImage: params.backgroundImage });
        for (const duplicate of rest) {
          duplicate.remove();
        }
      }
      return { previous };
    });
  },
  (ctx, params, result) => {
    if (result.previous === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((docRoot) => {
      const localized = localizedImageArray(docRoot, params.id);
      if (localized === undefined) {
        return;
      }
      // Drop whatever this write left for the locale, then replay the captured
      // entries verbatim — one uniform reversal for insert/update/clear/compact.
      for (const entry of localized.filter(
        (candidate) => candidate.get()?.locale === params.locale,
      )) {
        entry.remove();
      }
      for (const entry of result.previous ?? []) {
        if (entry.backgroundImage === undefined) {
          continue;
        }
        localized.push({
          locale: entry.locale,
          overrides: { backgroundImage: entry.backgroundImage },
        });
      }
    });
  },
);

/**
 * Inserts, updates, or clears a component prop's localized literal value for a
 * locale.
 *
 * Undoable. Locates the prop by `name` on the component node's `props` array,
 * then applies the same insert-or-update + duplicate-compaction discipline as
 * {@link updateNodeTranslation} to that prop entry's `localizedValues`. `value`
 * is a whole component-prop-value snapshot; `value: null` removes the locale's
 * override (the prop falls back to its base literal). Undo restores exactly the
 * `localizedValues` entries that existed for the locale before the write, re-
 * narrowing each captured raw value through `componentPropValueFromRaw`.
 */
export const updateComponentPropLocalizedValue = commander.undoableAction<
  { nodeId: string; propName: string; locale: string; value: ComponentPropValuePlain | null },
  { previous: readonly CapturedLocalizedPropEntry[] | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    return mimic.document.transaction((docRoot) => {
      const node = findTypedNode(docRoot, params.nodeId, ComponentNode);
      if (node === undefined) {
        return { previous: null };
      }
      const prop = node.data.props.find((entry) => entry.get()?.name === params.propName);
      if (prop === undefined) {
        return { previous: null };
      }
      const localizedValues = prop.value.localizedValues;
      const matches = localizedValues.filter((entry) => entry.get()?.locale === params.locale);
      const previous: CapturedLocalizedPropEntry[] = matches.flatMap((entry) => {
        const snapshot = entry.get();
        return snapshot === undefined ? [] : [{ locale: snapshot.locale, raw: snapshot.value }];
      });

      if (params.value === null) {
        for (const entry of matches) {
          entry.remove();
        }
        return { previous };
      }

      const [first, ...rest] = matches;
      if (first === undefined) {
        localizedValues.push({ locale: params.locale, value: params.value });
      } else {
        first.value.value.set(params.value);
        for (const duplicate of rest) {
          duplicate.remove();
        }
      }
      return { previous };
    });
  },
  (ctx, params, result) => {
    if (result.previous === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((docRoot) => {
      const node = findTypedNode(docRoot, params.nodeId, ComponentNode);
      if (node === undefined) {
        return;
      }
      const prop = node.data.props.find((entry) => entry.get()?.name === params.propName);
      if (prop === undefined) {
        return;
      }
      const localizedValues = prop.value.localizedValues;
      for (const entry of localizedValues.filter(
        (candidate) => candidate.get()?.locale === params.locale,
      )) {
        entry.remove();
      }
      for (const entry of result.previous ?? []) {
        const value = componentPropValueFromRaw(entry.raw);
        if (value === undefined) {
          continue;
        }
        localizedValues.push({ locale: entry.locale, value });
      }
    });
  },
);
