import {
  collectLocalizableSlots,
  resolveBackgroundImage,
  resolveComponentPropValue,
  resolveText,
} from "@voidhash/mimic-schema";
import type {
  BackgroundImageSnapshot,
  ComponentPropValueSnapshot,
  RootNodeData,
} from "@voidhash/mimic-schema";
import type {
  ComponentSnapshotNode,
  RootSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import * as Option from "effect/Option";

import type { GetLocalizablePropInfos } from "../hooks/use-localizable-props";
import { readLocalizableComponentProp } from "../state/utils/localization";

/**
 * One translation-table row: a localizable slot resolved against the target
 * locale. `override` is `null` when the slot has no effective override and
 * falls back to `base`. Component-prop rows carry display strings for both
 * columns (string props hold their text, image props their url) plus the
 * manifest `propKind` deciding whether the cell edits as text or as an image.
 */
export type TranslationRow =
  | {
      readonly kind: "text";
      readonly key: string;
      readonly nodeId: string;
      readonly screenId: string;
      readonly label: string;
      readonly base: string;
      readonly override: string | null;
    }
  | {
      readonly kind: "image";
      readonly key: string;
      readonly nodeId: string;
      readonly screenId: string;
      readonly label: string;
      readonly base: BackgroundImageSnapshot;
      readonly override: BackgroundImageSnapshot | null;
    }
  | {
      readonly kind: "componentProp";
      readonly key: string;
      readonly nodeId: string;
      readonly propName: string;
      readonly screenId: string;
      readonly label: string;
      readonly propKind: "string" | "image";
      readonly base: string;
      readonly override: string | null;
    };

/** Rows of one screen, in tree order, headed by the screen's display name. */
export interface TranslationScreenGroup {
  readonly screenId: string;
  readonly screenName: string;
  readonly rows: readonly TranslationRow[];
}

export interface BuildTranslationRowsOptions {
  /** The target locale the override column resolves against. */
  readonly locale: string;
  readonly defaultLocale: string;
  readonly getLocalizableProps?: GetLocalizablePropInfos;
}

/** Whether a row carries an override for the target locale. */
export function rowIsTranslated(row: TranslationRow): boolean {
  return row.override !== null;
}

/** Display text of a literal component-prop value (localizable props are strings). */
function propValueText(value: ComponentPropValueSnapshot): string {
  switch (value.key) {
    case "string":
      return value.value;
    case "number":
      return String(value.value);
    case "boolean":
      return value.value ? "true" : "false";
    default:
      return "";
  }
}

interface NodeIndex {
  readonly nodeById: ReadonlyMap<string, SnapshotNode>;
  readonly screenNameById: ReadonlyMap<string, string>;
  readonly propKindByKey: ReadonlyMap<string, "string" | "image">;
}

function indexNodes(
  root: RootSnapshotNode,
  getLocalizableProps: GetLocalizablePropInfos | undefined,
): NodeIndex {
  const nodeById = new Map<string, SnapshotNode>();
  const screenNameById = new Map<string, string>();
  const propKindByKey = new Map<string, "string" | "image">();
  const visit = (node: SnapshotNode): void => {
    nodeById.set(node.id, node);
    if (node.type === "screen") {
      screenNameById.set(node.id, node.data.name);
    } else if (node.type === "component" && getLocalizableProps !== undefined) {
      for (const info of getLocalizableProps(node as ComponentSnapshotNode)) {
        propKindByKey.set(`${node.id}/${info.propName}`, info.kind);
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return { nodeById, propKindByKey, screenNameById };
}

/**
 * Builds the Translation-mode row model: every localizable slot of the
 * document (via `collectLocalizableSlots`, tree order) resolved against the
 * target locale and grouped by containing screen. Pure — takes the live root
 * snapshot, so rows follow the document; a slot whose node vanished simply
 * stops appearing.
 */
export function buildTranslationRows(
  root: RootSnapshotNode,
  options: BuildTranslationRowsOptions,
): TranslationScreenGroup[] {
  const { locale, defaultLocale, getLocalizableProps } = options;
  const index = indexNodes(root, getLocalizableProps);

  // The store snapshot IS the decoded document root `collectLocalizableSlots`
  // expects — the engine and web-core type the identical runtime shape
  // differently (one union-typed node vs a distributed union), hence the casts.
  const slots = collectLocalizableSlots(root as unknown as RootNodeData, {
    getLocalizableProps:
      getLocalizableProps === undefined
        ? undefined
        : (node) => getLocalizableProps(node as unknown as ComponentSnapshotNode),
  });

  const groups: TranslationScreenGroup[] = [];
  let current: { screenId: string; screenName: string; rows: TranslationRow[] } | null = null;

  for (const slot of slots) {
    const node = index.nodeById.get(slot.nodeId);
    if (node === undefined) {
      continue;
    }
    let row: TranslationRow;
    if (slot.kind === "text") {
      const data = (node as TextSnapshotNode).data;
      const resolved = resolveText(data, Option.fromNullishOr(locale), defaultLocale);
      row = {
        base: slot.baseValue,
        key: slot.nodeId,
        kind: "text",
        label: slot.label,
        nodeId: slot.nodeId,
        override: resolved === data.text ? null : resolved,
        screenId: slot.screenId,
      };
    } else if (slot.kind === "image") {
      const data = (node as ViewSnapshotNode).data;
      const resolved = resolveBackgroundImage(data, Option.fromNullishOr(locale), defaultLocale);
      row = {
        base: slot.baseValue,
        key: slot.nodeId,
        kind: "image",
        label: slot.label,
        nodeId: slot.nodeId,
        override: resolved === data.style.backgroundImage ? null : resolved,
        screenId: slot.screenId,
      };
    } else {
      const prop = readLocalizableComponentProp(node as ComponentSnapshotNode, slot.propName);
      if (prop === undefined || prop.value.type !== "literal") {
        continue;
      }
      const resolved = resolveComponentPropValue(prop, Option.fromNullishOr(locale), defaultLocale);
      const key = `${slot.nodeId}/${slot.propName}`;
      row = {
        base: propValueText(slot.baseValue),
        key,
        kind: "componentProp",
        label: slot.label,
        nodeId: slot.nodeId,
        override:
          resolved === prop.value || resolved.type !== "literal"
            ? null
            : propValueText(resolved.value),
        propKind: index.propKindByKey.get(key) ?? "string",
        propName: slot.propName,
        screenId: slot.screenId,
      };
    }
    if (current === null || current.screenId !== slot.screenId) {
      current = {
        rows: [],
        screenId: slot.screenId,
        screenName: index.screenNameById.get(slot.screenId) ?? "Document",
      };
      groups.push(current);
    }
    current.rows.push(row);
  }

  return groups;
}

export type TranslationKindFilter = "all" | "text" | "image" | "componentProp";

export interface TranslationRowFilter {
  readonly untranslatedOnly?: boolean;
  readonly kind?: TranslationKindFilter;
  /** `"all"` (or omitted) keeps every screen group. */
  readonly screenId?: string;
  /** Case-insensitive free text matched over label, base and override values. */
  readonly search?: string;
}

function rowSearchText(row: TranslationRow): string {
  const parts: string[] = [row.label];
  if (row.kind === "image") {
    parts.push(row.base.url);
    if (row.override !== null) {
      parts.push(row.override.url);
    }
  } else {
    parts.push(row.base);
    if (row.override !== null) {
      parts.push(row.override);
    }
  }
  return parts.join("\n").toLowerCase();
}

/**
 * Applies the Translation-mode filters to a built row model, dropping groups
 * that end up empty. Pure companion of {@link buildTranslationRows}.
 */
export function filterTranslationGroups(
  groups: readonly TranslationScreenGroup[],
  filter: TranslationRowFilter,
): TranslationScreenGroup[] {
  const search = filter.search?.trim().toLowerCase() ?? "";
  const result: TranslationScreenGroup[] = [];
  for (const group of groups) {
    if (
      filter.screenId !== undefined &&
      filter.screenId !== "all" &&
      group.screenId !== filter.screenId
    ) {
      continue;
    }
    const rows = group.rows.filter((row) => {
      if (filter.untranslatedOnly === true && rowIsTranslated(row)) {
        return false;
      }
      if (filter.kind !== undefined && filter.kind !== "all" && row.kind !== filter.kind) {
        return false;
      }
      if (search !== "" && !rowSearchText(row).includes(search)) {
        return false;
      }
      return true;
    });
    if (rows.length > 0) {
      result.push({ ...group, rows });
    }
  }
  return result;
}
