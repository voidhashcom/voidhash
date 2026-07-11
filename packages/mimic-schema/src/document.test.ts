import { parseSchema, serializeSchema, validate } from "@voidhash/mimic-core";
import { describe, expect, test } from "vite-plus/test";
import { expectTypeOf } from "vitest";

import { createInitialPaywallDocumentInput, PaywallDesignerDocument } from "./document.ts";
import type {
  CodeComponentNodeData,
  ComponentNodeData,
  LibraryNodeData,
  ScreenNodeData,
  ViewNodeData,
} from "./nodes/index.ts";

describe("PaywallDesignerDocument", () => {
  test("encodes the initial document input", () => {
    const value = PaywallDesignerDocument.encode(createInitialPaywallDocumentInput());
    expect(value.kind).toBe("tree");

    const validated = validate(PaywallDesignerDocument.schema, value);
    expect(validated).toBeDefined();

    const roots = PaywallDesignerDocument.decode(validated);
    expect(roots).toHaveLength(1);
    const root = roots![0]!;
    expect(root.type).toBe("root");
    expect(root.parentId).toBeNull();
    expect(root.data.name).toBe("Paywall");
    expect(root.children).toHaveLength(1);
    // `root.children` is a merged `screen | library` snapshot type (not a
    // discriminated union), so cast to the concrete variant to read `data`.
    const screen = root.children[0]! as ScreenNodeData;
    expect(screen.type).toBe("screen");
    expect(screen.data.name).toBe("Screen");
    expect(screen.data.style.width).toBe(375);
    expect(screen.children).toEqual([]);
  });

  test("default-fills componentSource on catalog component nodes (additive migration)", () => {
    // A component node authored before the local/catalog discriminator existed
    // omits `componentSource`/`componentPath`; they must default-fill so old
    // stored documents reconcile onto the new schema without a data migration.
    const value = PaywallDesignerDocument.encode([
      {
        type: "root",
        name: "Paywall",
        children: [
          {
            type: "screen",
            children: [
              { type: "component", componentSlug: "hero", componentVersion: 3, contentHash: "abc" },
            ],
          },
        ],
      },
    ]);

    const validated = validate(PaywallDesignerDocument.schema, value);
    const roots = PaywallDesignerDocument.decode(validated);
    const screen = roots![0]!.children[0]! as ScreenNodeData;
    expect(screen.type).toBe("screen");
    const component = screen.children[0]! as ComponentNodeData;
    expect(component.type).toBe("component");
    expect(component.data.componentSource).toBe("catalog");
    expect(component.data.componentPath).toBe("");
    expect(component.data.contentHash).toBe("abc");
  });

  test("accepts a library node holding code-component definitions", () => {
    const value = PaywallDesignerDocument.encode([
      {
        type: "root",
        name: "Paywall",
        children: [
          { type: "screen" },
          {
            type: "library",
            children: [
              { type: "codeComponent", path: "components/product-option.tsx", source: "" },
            ],
          },
        ],
      },
    ]);

    const roots = PaywallDesignerDocument.decode(validate(PaywallDesignerDocument.schema, value));
    const library = roots![0]!.children.find((child) => child.type === "library") as
      | LibraryNodeData
      | undefined;
    expect(library).toBeDefined();
    const definition = library!.children[0]! as CodeComponentNodeData;
    expect(definition.type).toBe("codeComponent");
    expect(definition.data.path).toBe("components/product-option.tsx");
    expect(definition.data.source).toBe("");
  });

  test("document schema round-trips through serializeSchema/parseSchema", () => {
    const serialized = serializeSchema(PaywallDesignerDocument.schema);
    expect(serialized["kind"]).toBe("tree");

    expect(serializeSchema(parseSchema(serialized))).toEqual(serialized);

    // The provisioning path stores the schema as JSON text — prove the
    // serialized form survives a JSON round-trip and still parses.
    const jsonRoundTripped: unknown = JSON.parse(JSON.stringify(serialized));
    expect(serializeSchema(parseSchema(jsonRoundTripped))).toEqual(serialized);
  });

  test("pins snapshot value shapes at the type level", () => {
    type ViewStyle = ViewNodeData["data"]["style"];

    expectTypeOf<ViewStyle["width"]>().toEqualTypeOf<number | "auto">();
    expectTypeOf<ViewStyle["height"]>().toEqualTypeOf<number | "auto">();
    expectTypeOf<ViewStyle["minWidth"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ViewStyle["flex"]>().toEqualTypeOf<number | undefined>();

    // `node.data` is non-optional on every tree-node snapshot.
    expectTypeOf<undefined extends ViewNodeData["data"] ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<
      undefined extends ComponentNodeData["data"] ? true : false
    >().toEqualTypeOf<false>();

    expectTypeOf<ComponentNodeData["data"]["componentPath"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentNodeData["data"]["componentSlug"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentNodeData["data"]["componentVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<ComponentNodeData["data"]["contentHash"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentNodeData["data"]["name"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentNodeData["data"]["previewState"]>().toEqualTypeOf<string>();
  });
});
