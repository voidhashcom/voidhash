import { createElement } from "react";
import { describe, expect, test } from "vitest";

import {
  defineComponent,
  extractComponentManifest,
  Pressable,
  Slot,
  Text,
  View,
} from "../src/index";
import { renderComponentToTree } from "../src/sandbox";
import { parseComponentManifest } from "../src/schema/validate";
import { renderToNodeTree } from "../src/tree-renderer/render-to-node-tree";
import { COMPONENT_MANIFEST_VERSION } from "../src/schema/component-manifest";

describe("PROBE 4: callable defineComponent", () => {
  const def = defineComponent({
    title: "Row",
    props: (p) => ({ label: p.string().default("hi") }),
    actions: (a) => ({ onSelect: a.action({ id: a.string() }) }),
    previews: { default: {} },
    render: ({ props }) => (
      <Pressable>
        <Text>{props.label}</Text>
        <Slot />
      </Pressable>
    ),
  });

  test("Object.assign preserves all metadata fields", () => {
    expect(typeof def).toBe("function");
    expect(def.__voidhash.kind).toBe("component");
    expect(def.title).toBe("Row");
    expect(typeof def.render).toBe("function");
    expect(typeof def.component).toBe("function");
    expect(Object.keys(def.props)).toEqual(["label"]);
    expect(Object.keys(def.actions)).toEqual(["onSelect"]);
    expect(def.previews.default).toBeDefined();
  });

  test(".component and the callable definition are the same function", () => {
    expect(def.component).toBe(def as unknown);
  });

  test("rendering via the callable definition directly matches rendering via .component", async () => {
    const Callable = def as unknown as (p: Record<string, unknown>) => unknown;
    const Component = def.component as unknown as (p: Record<string, unknown>) => unknown;

    const viaCallable = await renderToNodeTree(
      createElement(Callable as never, { label: "X" }),
      { config: { products: [], variables: {} }, state: "s" },
    );
    const viaComponent = await renderToNodeTree(
      createElement(Component as never, { label: "X" }),
      { config: { products: [], variables: {} }, state: "s" },
    );
    expect(viaCallable).toEqual(viaComponent);
  });

  test("renderComponentToTree (uses .component) still renders", async () => {
    const tree = await renderComponentToTree(def, { state: "default" });
    expect(tree.state).toBe("default");
    expect(tree.root).toBeDefined();
    // Not a placeholder (single slot, valid render).
    expect((tree.root as { type?: string }).type).not.toBe("placeholder");
  });

  test("extractComponentManifest is v2 (no id) and re-validates", () => {
    const m = extractComponentManifest(def);
    expect(m.manifestVersion).toBe(COMPONENT_MANIFEST_VERSION);
    expect((m as unknown as Record<string, unknown>)["id"]).toBeUndefined();
    const parsed = parseComponentManifest(m);
    expect(parsed.ok).toBe(true);
  });
});

describe("PROBE 5: manifest v2 validator", () => {
  const validV2 = {
    manifestVersion: 2,
    props: {},
    actions: {},
    slot: false,
    previewStates: ["default"],
    hostData: [],
  };

  test("accepts a legit v2 manifest", () => {
    expect(parseComponentManifest(validV2).ok).toBe(true);
  });

  test("rejects a v1 manifest", () => {
    const v1 = { ...validV2, manifestVersion: 1 };
    const r = parseComponentManifest(v1);
    expect(r.ok).toBe(false);
  });

  test("rejects an id-bearing v2 manifest", () => {
    const withId = { ...validV2, id: "some-slug" };
    const r = parseComponentManifest(withId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("id"))).toBe(true);
    }
  });

  test("rejects a v1 id-bearing manifest (both signals)", () => {
    const legacy = { ...validV2, manifestVersion: 1, id: "legacy" };
    expect(parseComponentManifest(legacy).ok).toBe(false);
  });
});
