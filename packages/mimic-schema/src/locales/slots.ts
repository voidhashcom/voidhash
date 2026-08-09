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
    walk(root, null, slots, options);
  }
  return slots;
}

/** Structural check that a decoded document node matches the walk's view of it. */
function isSnapshotNode(value: unknown): value is SnapshotNode {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    "id" in value &&
    "data" in value &&
    "children" in value
  );
}

function isTextSlotData(data: Record<string, unknown>): data is Record<string, unknown> &
  TextSlotData {
  return typeof data["name"] === "string" && typeof data["text"] === "string";
}

function isImageSlotData(data: Record<string, unknown>): data is Record<string, unknown> &
  ImageSlotData {
  const style = data["style"];
  return (
    typeof data["name"] === "string" &&
    style !== null &&
    typeof style === "object" &&
    "backgroundImage" in style
  );
}

/** Narrows a walked snapshot node to the component-node shape callers expect. */
function isComponentNode(node: SnapshotNode): node is SnapshotNode & ComponentNodeData {
  return node.type === "component";
}

function screenIdFor(node: SnapshotNode, inheritedScreenId: string | null): string | null {
  if (node.type === "screen") {
    return node.id;
  }
  return inheritedScreenId;
}

function walk(
  node: SnapshotNode,
  screenId: string | null,
  slots: LocalizableSlot[],
  options: CollectLocalizableSlotsOptions,
): void {
  const currentScreenId = screenIdFor(node, screenId);
  const groupId = currentScreenId ?? node.id;

  switch (node.type) {
    case "text": {
      if (isTextSlotData(node.data)) {
        slots.push({
          kind: "text",
          nodeId: node.id,
          label: node.data.name,
          baseValue: node.data.text,
          screenId: groupId,
        });
      }
      break;
    }
    case "view":
    case "scrollView":
    case "screen": {
      if (isImageSlotData(node.data)) {
        const image = node.data.style.backgroundImage;
        if (image.url.length > 0) {
          slots.push({
            kind: "image",
            nodeId: node.id,
            label: node.data.name,
            baseValue: image,
            screenId: groupId,
          });
        }
      }
      break;
    }
    case "component": {
      if (isComponentNode(node)) {
        const descriptors = options.getLocalizableProps?.(node) ?? [];
        for (const descriptor of descriptors) {
          const prop = findProp(node, descriptor.propName);
          if (prop === undefined || prop.value.type !== "literal") {
            continue;
          }
          slots.push({
            kind: "componentProp",
            nodeId: node.id,
            propName: descriptor.propName,
            label: descriptor.label,
            baseValue: prop.value.value,
            screenId: groupId,
          });
        }
      }
      break;
    }
  }

  for (const child of node.children) {
    walk(child, currentScreenId, slots, options);
  }
}

/** Narrows a decoded prop entry value to one carrying a `name`. */
function isNamedComponentProp(value: unknown): value is NamedComponentProp {
  return value !== null && typeof value === "object" && "name" in value && "value" in value;
}

/** Finds a component node's prop by name, unwrapping the CRDT entry envelope. */
function findProp(node: SnapshotNode, name: string): LocalizableComponentProp | undefined {
  const props = node.data["props"];
  if (!Array.isArray(props)) {
    return undefined;
  }
  for (const entry of props) {
    const value = entryValue<unknown>(entry);
    if (isNamedComponentProp(value) && value.name === name) {
      return value;
    }
  }
  return undefined;
}
