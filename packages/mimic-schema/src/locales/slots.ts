import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { entryValue } from "./entry.ts";
import type { ComponentNodeData } from "../nodes/component-node.ts";
import type { RootNodeData } from "../nodes/root-node.ts";
import type {
  BackgroundImageSnapshot,
  CollectLocalizableSlotsOptions,
  LocalizableComponentProp,
  LocalizableSlot,
} from "./types.ts";

/** Structural view of a decoded tree node used for the order-preserving walk. */
interface SnapshotNode {
  readonly type: string;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly children: readonly SnapshotNode[];
}

/** Minimal decoded text-node data the walk reads. */
interface TextSlotData {
  readonly name: string;
  readonly text: string;
}

/** Minimal decoded view/scrollView/screen data the walk reads. */
interface ImageSlotData {
  readonly name: string;
  readonly style: { readonly backgroundImage: BackgroundImageSnapshot };
}

/** A decoded component-prop entry carrying the name the walk matches on. */
type NamedComponentProp = LocalizableComponentProp & { readonly name: string };

/**
 * Walks a decoded document root and collects every localizable slot in tree
 * order, grouped naturally by containing screen. Includes: every text node; every
 * view/scrollView/screen node whose base `style.backgroundImage.url` is non-empty; and the
 * literal-bound component props reported by `options.getLocalizableProps`.
 * Variable-reference-bound props are excluded. Pass the decoded root node
 * (`PaywallDesignerDocument.decode(...)[0]`).
 */
export function collectLocalizableSlots(
  root: RootNodeData,
  options: CollectLocalizableSlotsOptions = {},
): LocalizableSlot[] {
  const slots: LocalizableSlot[] = [];
  if (isSnapshotNode(root)) {
    walk(root, Option.none(), slots, options);
  }
  return slots;
}

/** Structural check that a decoded document node matches the walk's view of it. */
function isSnapshotNode(value: unknown): value is SnapshotNode {
  return (
    value !== null &&
    P.isObject(value) &&
    "type" in value &&
    "id" in value &&
    "data" in value &&
    "children" in value
  );
}

function isTextSlotData(
  data: Record<string, unknown>,
): data is Record<string, unknown> & TextSlotData {
  return P.isString(data["name"]) && P.isString(data["text"]);
}

function isImageSlotData(
  data: Record<string, unknown>,
): data is Record<string, unknown> & ImageSlotData {
  const style = data["style"];
  return (
    P.isString(data["name"]) && style !== null && P.isObject(style) && "backgroundImage" in style
  );
}

/** Narrows a walked snapshot node to the component-node shape callers expect. */
function isComponentNode(node: SnapshotNode): node is SnapshotNode & ComponentNodeData {
  return node.type === "component";
}

function screenIdFor(
  node: SnapshotNode,
  inheritedScreenId: Option.Option<string>,
): Option.Option<string> {
  if (node.type === "screen") {
    return Option.some(node.id);
  }
  return inheritedScreenId;
}

function walk(
  node: SnapshotNode,
  screenId: Option.Option<string>,
  slots: LocalizableSlot[],
  options: CollectLocalizableSlotsOptions,
): void {
  const currentScreenId = screenIdFor(node, screenId);
  const groupId = Option.getOrElse(currentScreenId, () => node.id);

  Match.value(node.type).pipe(
    Match.when("text", () => {
      if (isTextSlotData(node.data)) {
        slots.push({
          kind: "text",
          nodeId: node.id,
          label: node.data.name,
          baseValue: node.data.text,
          screenId: groupId,
        });
      }
    }),
    Match.when("view", () => collectImageSlot(node, groupId, slots)),
    Match.when("scrollView", () => collectImageSlot(node, groupId, slots)),
    Match.when("screen", () => collectImageSlot(node, groupId, slots)),
    Match.when("component", () => {
      if (isComponentNode(node)) {
        const descriptors = options.getLocalizableProps?.(node) ?? [];
        Arr.forEach(descriptors, (descriptor) => {
          const prop = findProp(node, descriptor.propName);
          if (Option.isNone(prop) || prop.value.value.type !== "literal") return;
          slots.push({
            kind: "componentProp",
            nodeId: node.id,
            propName: descriptor.propName,
            label: descriptor.label,
            baseValue: prop.value.value.value,
            screenId: groupId,
          });
        });
      }
    }),
    Match.orElse(() => undefined),
  );

  Arr.forEach(node.children, (child) => {
    walk(child, currentScreenId, slots, options);
  });
}

const collectImageSlot = (node: SnapshotNode, groupId: string, slots: LocalizableSlot[]): void => {
  if (isImageSlotData(node.data)) {
    const image = node.data.style.backgroundImage;
    if (Str.isNonEmpty(image.url)) {
      slots.push({
        kind: "image",
        nodeId: node.id,
        label: node.data.name,
        baseValue: image,
        screenId: groupId,
      });
    }
  }
};

/** Narrows a decoded prop entry value to one carrying a `name`. */
function isNamedComponentProp(value: unknown): value is NamedComponentProp {
  return value !== null && P.isObject(value) && "name" in value && "value" in value;
}

/** Finds a component node's prop by name, unwrapping the CRDT entry envelope. */
function findProp(node: SnapshotNode, name: string): Option.Option<LocalizableComponentProp> {
  const props = node.data["props"];
  if (!Array.isArray(props)) {
    return Option.none();
  }
  return Arr.findFirst(props, (entry) => {
    const value = entryValue<unknown>(entry);
    return isNamedComponentProp(value) && value.name === name;
  }).pipe(Option.map(entryValue<unknown>), Option.filter(isNamedComponentProp));
}
