import {
  entryValue,
  resolveBackgroundImage,
  resolveComponentPropValue,
  resolveText,
} from "@voidhash/mimic-schema";
import type {
  BackgroundImageSnapshot,
  LocalizableComponentProp,
  LocalizableImageData,
  LocalizablePropDescriptor,
  MaybeEntry,
} from "@voidhash/mimic-schema";
import type {
  ComponentSnapshotNode,
  RootSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import * as Option from "effect/Option";

import type { DesignerStoreState } from "../designer-store-state";
import { selectDocumentRoot } from "./document-root";

/**
 * Maps a component instance node to the subset of its props that can carry
 * localized overrides (literal-bound string/image props marked `.localizable()`
 * in the manifest). The designer supplies this from its synchronous, store-backed
 * component-manifest lookup; mimic-schema itself is manifest-agnostic.
 */
export type GetLocalizableProps = (
  node: ComponentSnapshotNode,
) => readonly LocalizablePropDescriptor[];

/**
 * The document's localization config, flattened from the CRDT-entry-wrapped
 * snapshot. `defaultLocale` is the implicit base locale; `locales` is the
 * ADDITIONAL enabled locales (the default is never listed).
 */
export interface LocalizationInfo {
  readonly defaultLocale: string;
  /** Additional enabled locale tags, in document order (default excluded). */
  readonly locales: readonly string[];
}

/** Per-locale translation coverage over the document's localizable slots. */
export interface LocaleCoverage {
  readonly translated: number;
  readonly total: number;
}

/**
 * Reads the localization config off a document root snapshot, unwrapping the
 * `locales` entries and dropping empty/blank tags.
 */
export function readLocalizationInfo(root: RootSnapshotNode): LocalizationInfo {
  const config = root.data.localization;
  const locales: string[] = [];
  for (const entry of config.locales) {
    const value = entryValue<{ tag: string } | undefined>(entry);
    if (value !== undefined && value.tag.length > 0) {
      locales.push(value.tag);
    }
  }
  return { defaultLocale: config.defaultLocale, locales };
}

/** Store selector: the document's localization config. */
export function selectLocalizationInfo(state: Pick<DesignerStoreState, "mimic">): LocalizationInfo {
  return readLocalizationInfo(selectDocumentRoot(state));
}

/** Store selector: the document's default locale tag. */
export function selectDefaultLocale(state: Pick<DesignerStoreState, "mimic">): string {
  return selectDocumentRoot(state).data.localization.defaultLocale;
}

/**
 * The effective background image to render for a view/screen node in a locale,
 * or `null` when the node's base image should be used unchanged. Returns `null`
 * for the default (nullish) locale and whenever no localized override actually
 * applies — so the caller substitutes the value ONLY when a real per-locale
 * override exists, leaving state-override-resolved styles untouched otherwise.
 */
export function localizedBackgroundImage(
  data: LocalizableImageData,
  activeLocale: string | null,
  defaultLocale: string,
): BackgroundImageSnapshot | null {
  if (activeLocale === null || activeLocale === defaultLocale) {
    return null;
  }
  const resolved = resolveBackgroundImage(data, Option.fromNullishOr(activeLocale), defaultLocale);
  return resolved === data.style.backgroundImage ? null : resolved;
}

/**
 * Reads a component snapshot node's prop entry by name (unwrapping the CRDT
 * envelope) as a {@link LocalizableComponentProp} — its base binding plus any
 * `localizedValues` — ready to feed `resolveComponentPropValue`. Returns
 * `undefined` when the node has no prop with that name.
 */
export function readLocalizableComponentProp(
  node: ComponentSnapshotNode,
  propName: string,
): LocalizableComponentProp | undefined {
  const props = node.data.props as readonly unknown[];
  for (const entry of props) {
    const value = entryValue(
      entry as MaybeEntry<(LocalizableComponentProp & { name: string }) | undefined>,
    );
    if (value !== undefined && value.name === propName) {
      return value;
    }
  }
  return undefined;
}

/**
 * Computes per-locale coverage over the document's localizable slots for a
 * target locale. Text and view/scrollView/screen background-image slots are always counted;
 * component-prop slots are included only when `getLocalizableProps` is supplied
 * (it enumerates a component node's literal-bound localizable string/image props
 * from the resolved manifest — mimic-schema itself is manifest-agnostic).
 * `translated` counts slots whose resolved value for `locale` differs from the
 * base value. Returns `{ translated: 0, total: 0 }` for the default locale.
 */
export function computeLocaleCoverage(
  root: RootSnapshotNode,
  locale: string,
  defaultLocale: string,
  getLocalizableProps?: GetLocalizableProps,
): LocaleCoverage {
  if (locale === defaultLocale) {
    return { translated: 0, total: 0 };
  }
  let translated = 0;
  let total = 0;
  const visit = (node: SnapshotNode): void => {
    if (node.type === "text") {
      total += 1;
      const data = (node as TextSnapshotNode).data;
      if (resolveText(data, Option.fromNullishOr(locale), defaultLocale) !== data.text) {
        translated += 1;
      }
    } else if (node.type === "view" || node.type === "scrollView" || node.type === "screen") {
      const data = (node as ViewSnapshotNode).data;
      if (data.style.backgroundImage.url.length > 0) {
        total += 1;
        if (
          resolveBackgroundImage(data, Option.fromNullishOr(locale), defaultLocale) !==
          data.style.backgroundImage
        ) {
          translated += 1;
        }
      }
    } else if (node.type === "component" && getLocalizableProps !== undefined) {
      const componentNode = node as ComponentSnapshotNode;
      for (const descriptor of getLocalizableProps(componentNode)) {
        const prop = readLocalizableComponentProp(componentNode, descriptor.propName);
        if (prop === undefined || prop.value.type !== "literal") {
          continue;
        }
        total += 1;
        if (
          resolveComponentPropValue(prop, Option.fromNullishOr(locale), defaultLocale) !==
          prop.value
        ) {
          translated += 1;
        }
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return { translated, total };
}
