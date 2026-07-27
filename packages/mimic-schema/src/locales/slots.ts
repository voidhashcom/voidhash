import { entryValue } from "./entry.ts";
import type { ComponentNodeData } from "../nodes/component-node.ts";
import type { RootNodeData } from "../nodes/root-node.ts";
import type {
  BackgroundImageSnapshot,
  CollectLocalizableSlotsOptions,
  LocalizableComponentProp,
  LocalizableSlot,
  MaybeEntry,
} from "./types.ts";

/** Structural view of a decoded tree node used for the order-preserving walk. */
interface SnapshotNode {
  readonly type: string;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly children: readonly SnapshotNode[];
}

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
  walk(root as unknown as SnapshotNode, null, slots, options);
  return slots;
}

function walk(
  node: SnapshotNode,
  screenId: string | null,
  slots: LocalizableSlot[],
  options: CollectLocalizableSlotsOptions,
): void {
  const currentScreenId = node.type === "screen" ? node.id : screenId;
  const groupId = currentScreenId ?? node.id;

  switch (node.type) {
    case "text": {
      const data = node.data as { name: string; text: string };
      slots.push({
        kind: "text",
        nodeId: node.id,
        label: data.name,
        baseValue: data.text,
        screenId: groupId,
      });
      break;
    }
    case "view":
    case "scrollView":
    case "screen": {
      const data = node.data as {
        name: string;
        style: { backgroundImage: BackgroundImageSnapshot };
      };
      const image = data.style.backgroundImage;
      if (image.url.length > 0) {
        slots.push({
          kind: "image",
          nodeId: node.id,
          label: data.name,
          baseValue: image,
          screenId: groupId,
        });
      }
      break;
    }
    case "component": {
      const componentNode = node as unknown as ComponentNodeData;
      const descriptors = options.getLocalizableProps?.(componentNode) ?? [];
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
      break;
    }
  }

  for (const child of node.children) {
    walk(child, currentScreenId, slots, options);
  }
}

/** Finds a component node's prop by name, unwrapping the CRDT entry envelope. */
function findProp(node: SnapshotNode, name: string): LocalizableComponentProp | undefined {
  const props = node.data["props"] as readonly unknown[] | undefined;
  if (props === undefined) {
    return undefined;
  }
  for (const entry of props) {
    const value = entryValue(
      entry as MaybeEntry<(LocalizableComponentProp & { name: string }) | undefined>,
    );
    if (value !== undefined && value.name === name) {
      return value;
    }
  }
  return undefined;
}
