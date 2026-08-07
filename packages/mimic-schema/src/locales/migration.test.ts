import { validate, type TreeValue } from "@voidhash/mimic-core";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  PaywallDesignerDocument,
  type PaywallDesignerDocumentInput,
} from "../document.ts";
import type { RootNodeData } from "../nodes/root-node.ts";
import type { ScreenNodeData } from "../nodes/screen-node.ts";
import type { TextNodeData } from "../nodes/text-node.ts";
import type { ComponentNodeData } from "../nodes/component-node.ts";
import { resolveComponentPropValue, resolveText } from "./resolve.ts";

/** An unlocalized document: a screen with a text node and a literal-prop component. */
const unlocalizedInput: PaywallDesignerDocumentInput = [
  {
    type: "root",
    name: "Paywall",
    children: [
      {
        type: "screen",
        children: [
          { type: "text", name: "Headline", text: "Hello" },
          {
            type: "component",
            componentSlug: "cta",
            componentVersion: 1,
            contentHash: "hash",
            props: [
              { name: "title", value: { type: "literal", value: { key: "string", value: "Buy" } } },
            ],
          },
        ],
      },
    ],
  },
];

// Decoded `children` is a merged snapshot type (not a discriminated union), so
// concrete variants are narrowed structurally by their `type` tag.
function isNodeOfType<T extends { readonly type: string }>(
  node: { readonly type: string },
  type: T["type"],
): node is T {
  return node.type === type;
}

function narrowNode<T extends { readonly type: string }>(
  node: { readonly type: string } | undefined,
  type: T["type"],
): T {
  if (node === undefined || !isNodeOfType<T>(node, type)) {
    return Effect.runSync(Effect.die(new Error(`expected a ${type} node, got ${node?.type}`)));
  }
  return node;
}

/** Encodes the document input, keeping the tree value type the fixtures mutate. */
function encodeTree(input: PaywallDesignerDocumentInput): TreeValue {
  const value = PaywallDesignerDocument.encode(input);
  if (value.kind !== "tree") {
    return Effect.runSync(Effect.die(new Error(`expected a tree value, got ${value.kind}`)));
  }
  return value;
}

function decodeRoot(value: TreeValue): RootNodeData {
  return PaywallDesignerDocument.decode(validate(PaywallDesignerDocument.schema, value))![0]!;
}

/** Removes every field this feature added, simulating a pre-change stored value. */
function stripLocalizationFields(tree: TreeValue): void {
  for (const node of tree.nodes) {
    if (node.value.kind !== "object") {
      continue;
    }
    const fields = node.value.fields;
    Reflect.deleteProperty(fields, "localization");
    Reflect.deleteProperty(fields, "localized");
    const props = fields["props"];
    if (props?.kind === "array") {
      for (const item of props.items) {
        if (item.value.kind === "object") {
          Reflect.deleteProperty(item.value.fields, "localizedValues");
        }
      }
    }
  }
}

describe("localization defaults", () => {
  test("root materializes an empty localization config", () => {
    const root = decodeRoot(encodeTree(unlocalizedInput));
    expect(root.data.localization).toEqual({ defaultLocale: "en", locales: [] });
  });

  test("nodes materialize empty localized arrays and resolvers return base values", () => {
    const root = decodeRoot(encodeTree(unlocalizedInput));
    const screen = narrowNode<ScreenNodeData>(root.children[0], "screen");
    const textNode = narrowNode<TextNodeData>(screen.children[0], "text");
    const component = narrowNode<ComponentNodeData>(screen.children[1], "component");

    expect(textNode.data.localized).toEqual([]);
    expect(resolveText(textNode.data, "de", "en")).toBe("Hello");

    const titleProp = component.data.props.find((entry) => entry.value?.name === "title")!.value!;
    expect(resolveComponentPropValue(titleProp, "de", "en").value).toEqual({
      key: "string",
      value: "Buy",
    });
  });
});

describe("back-compat with pre-change documents", () => {
  test("a value missing the new fields validates and re-materializes defaults", () => {
    const stored = encodeTree(unlocalizedInput);
    stripLocalizationFields(stored);

    // Decoding through validate (the app's load path) must succeed and fill the
    // additive fields back in with their defaults.
    const root = decodeRoot(stored);
    expect(root.data.localization).toEqual({ defaultLocale: "en", locales: [] });

    const screen = narrowNode<ScreenNodeData>(root.children[0], "screen");
    const textNode = narrowNode<TextNodeData>(screen.children[0], "text");
    expect(textNode.data.localized).toEqual([]);
    expect(textNode.data.text).toBe("Hello");

    const component = narrowNode<ComponentNodeData>(screen.children[1], "component");
    const titleProp = component.data.props.find((entry) => entry.value?.name === "title")!.value!;
    expect(titleProp.value.type).toBe("literal");
    expect(resolveComponentPropValue(titleProp, "de", "en").value).toEqual({
      key: "string",
      value: "Buy",
    });
  });
});
