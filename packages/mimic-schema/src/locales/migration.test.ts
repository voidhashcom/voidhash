import {
  validate,
  type ArrayValue,
  type ObjectValue,
  type TreeValue,
} from "@voidhash/mimic-core";
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

function decodeRoot(value: TreeValue): RootNodeData {
  return PaywallDesignerDocument.decode(validate(PaywallDesignerDocument.schema, value))![0]!;
}

/** Removes every field this feature added, simulating a pre-change stored value. */
function stripLocalizationFields(tree: TreeValue): void {
  for (const node of tree.nodes) {
    const fields = (node.value as ObjectValue).fields as Record<string, unknown>;
    delete fields["localization"];
    delete fields["localized"];
    const props = fields["props"] as ArrayValue | undefined;
    if (props?.kind === "array") {
      for (const item of props.items) {
        if (item.value.kind === "object") {
          delete (item.value.fields as Record<string, unknown>)["localizedValues"];
        }
      }
    }
  }
}

describe("localization defaults", () => {
  test("root materializes an empty localization config", () => {
    const root = decodeRoot(PaywallDesignerDocument.encode(unlocalizedInput) as TreeValue);
    expect(root.data.localization).toEqual({ defaultLocale: "en", locales: [] });
  });

  test("nodes materialize empty localized arrays and resolvers return base values", () => {
    const root = decodeRoot(PaywallDesignerDocument.encode(unlocalizedInput) as TreeValue);
    const screen = root.children[0]! as ScreenNodeData;
    const textNode = screen.children[0]! as TextNodeData;
    const component = screen.children[1]! as ComponentNodeData;

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
    const stored = PaywallDesignerDocument.encode(unlocalizedInput) as TreeValue;
    stripLocalizationFields(stored);

    // Decoding through validate (the app's load path) must succeed and fill the
    // additive fields back in with their defaults.
    const root = decodeRoot(stored);
    expect(root.data.localization).toEqual({ defaultLocale: "en", locales: [] });

    const screen = root.children[0]! as ScreenNodeData;
    const textNode = screen.children[0]! as TextNodeData;
    expect(textNode.data.localized).toEqual([]);
    expect(textNode.data.text).toBe("Hello");

    const component = screen.children[1]! as ComponentNodeData;
    const titleProp = component.data.props.find((entry) => entry.value?.name === "title")!.value!;
    expect(titleProp.value.type).toBe("literal");
    expect(resolveComponentPropValue(titleProp, "de", "en").value).toEqual({
      key: "string",
      value: "Buy",
    });
  });
});
