import { describe, expect, expectTypeOf, it } from "vitest";

import {
  defineComponent,
  extractComponentManifest,
  Image,
  type PaywallProduct,
  type PaywallStyle,
  Pressable,
  Slot,
  Text,
  View,
} from "../src/index";
import {
  countSlotNodes,
  PAYWALL_STYLE_KEY_LIST,
  PAYWALL_STYLE_KEYS,
  parseComponentManifest,
  parsePreviewTree,
} from "../src/schema";
import { renderToNodeTree } from "../src/tree";

const yearly: PaywallProduct = {
  id: "com.app.yearly",
  slug: "yearly",
  displayName: "Yearly",
  priceString: "$59.99",
};

const fullComponent = defineComponent({
  title: "Product Option",
  props: (p) => ({
    product: p.ref("product").label("Product"),
    selected: p.boolean().default(false),
    accentColor: p.string().editor("color").default("#16a34a"),
    badge: p.component().optional(),
    features: p.array(p.string()).optional(),
    plan: p.select(["monthly", "yearly"]).optional(),
  }),
  actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
  previews: { default: { data: { products: [yearly] } } },
  render: ({ props, actions }) => (
    <Pressable onPress={() => actions.onSelect({ productId: props.product.id })}>
      <Text>{props.product.displayName}</Text>
      <Image resizeMode="cover" source="https://cdn.test/hero.png" style={{}} />
      <Slot />
    </Pressable>
  ),
});

describe("parsePreviewTree", () => {
  it("accepts a golden tree rendered by renderToNodeTree", async () => {
    const tree = await renderToNodeTree(
      <View style={{ flexDirection: "row", padding: 16 }}>
        <Text style={{ color: "#fff" }}>Yearly</Text>
        <Image resizeMode="cover" source="https://cdn.test/hero.png" style={{}} />
      </View>,
    );
    const result = parsePreviewTree(tree);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(tree);
    }
  });

  it("accepts every §3 node type in one hand-built fixture", () => {
    const tree = {
      treeVersion: 1,
      state: "default",
      root: {
        type: "view",
        style: {},
        children: [
          { type: "text", style: { color: "#fff" }, text: "Yearly" },
          { type: "image", style: {}, src: "https://x", resizeMode: "contain" },
          { type: "pressable", style: {}, action: "onSelect", children: [] },
          { type: "scroll", style: {}, children: [] },
          { type: "slot" },
          { type: "placeholder", reason: "render returned null" },
        ],
      },
    };
    expect(parsePreviewTree(tree).ok).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const result = parsePreviewTree({
      treeVersion: 1,
      state: "default",
      root: { type: "canvas", style: {}, children: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("not a known node type"))).toBe(true);
    }
  });

  it("rejects an unknown key on a node", () => {
    const result = parsePreviewTree({
      treeVersion: 1,
      state: "default",
      root: { type: "text", style: {}, text: "hi", onClick: "nope" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown key "onClick"'))).toBe(true);
    }
  });

  it("rejects an out-of-vocabulary style key", () => {
    const result = parsePreviewTree({
      treeVersion: 1,
      state: "default",
      root: { type: "view", style: { transform: "scale(2)" }, children: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown key "transform"'))).toBe(true);
    }
  });

  it("rejects a bad resizeMode and a wrong treeVersion and a malformed state", () => {
    expect(
      parsePreviewTree({
        treeVersion: 1,
        state: "default",
        root: { type: "image", style: {}, src: "x", resizeMode: "fill" },
      }).ok,
    ).toBe(false);
    expect(parsePreviewTree({ treeVersion: 2, state: "default", root: { type: "slot" } }).ok).toBe(
      false,
    );
    expect(
      parsePreviewTree({ treeVersion: 1, state: "bad state!", root: { type: "slot" } }).ok,
    ).toBe(false);
  });

  it("accepts the structured background style keys", () => {
    const result = parsePreviewTree({
      treeVersion: 1,
      state: "default",
      root: {
        type: "view",
        style: {
          backgroundType: "gradient",
          backgroundGradient: {
            kind: "radial",
            startX: 0,
            startY: 0,
            endX: 1,
            endY: 1,
            stops: [
              { color: "rgba(255, 0, 0, 1)", position: 0 },
              { color: "rgba(0, 0, 255, 1)", position: 1 },
            ],
          },
          backgroundImage: { url: "https://cdn.test/bg.png", resizeMode: "contain" },
        },
        children: [],
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed backgroundType, gradient, and image", () => {
    expect(
      parsePreviewTree({
        treeVersion: 1,
        state: "default",
        root: { type: "view", style: { backgroundType: "swirl" }, children: [] },
      }).ok,
    ).toBe(false);
    expect(
      parsePreviewTree({
        treeVersion: 1,
        state: "default",
        root: {
          type: "view",
          style: { backgroundGradient: { kind: "conic", startX: 0, startY: 0, endX: 1, endY: 1, stops: [] } },
          children: [],
        },
      }).ok,
    ).toBe(false);
    expect(
      parsePreviewTree({
        treeVersion: 1,
        state: "default",
        root: {
          type: "view",
          style: { backgroundImage: { url: "x", resizeMode: "fill" } },
          children: [],
        },
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-finite gradient coordinate and a non-string stop color", () => {
    const bad = parsePreviewTree({
      treeVersion: 1,
      state: "default",
      root: {
        type: "view",
        style: {
          backgroundGradient: {
            kind: "linear",
            startX: Number.NaN,
            startY: 0,
            endX: 1,
            endY: 1,
            stops: [{ color: 123, position: 0 }],
          },
        },
        children: [],
      },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.some((e) => e.includes("startX must be a finite number"))).toBe(true);
      expect(bad.errors.some((e) => e.includes("color must be a string"))).toBe(true);
    }
  });
});

describe("countSlotNodes", () => {
  it("counts the single slot marker in a rendered component tree", async () => {
    const Card = fullComponent.component;
    const tree = await renderToNodeTree(<Card product={yearly} />);
    expect(countSlotNodes(tree.root)).toBe(1);
  });

  it("returns 0 for a slotless tree and counts nested slots", () => {
    expect(countSlotNodes({ type: "text", style: {}, text: "x" })).toBe(0);
    expect(
      countSlotNodes({
        type: "view",
        style: {},
        children: [{ type: "scroll", style: {}, children: [{ type: "slot" }] }, { type: "slot" }],
      }),
    ).toBe(2);
  });
});

describe("parseComponentManifest", () => {
  it("accepts a golden manifest extracted from a full-surface component", () => {
    const manifest = extractComponentManifest(fullComponent);
    const result = parseComponentManifest(manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(manifest);
    }
  });

  it("rejects an unknown top-level key", () => {
    const result = parseComponentManifest({
      manifestVersion: 2,
      props: {},
      extra: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown key "extra"'))).toBe(true);
    }
  });

  it("rejects a v1 (id-bearing) manifest — id is no longer a manifest field", () => {
    // Manifest v2 dropped `id` (identity is the component's file path). A legacy
    // v1 manifest fails on BOTH the version check and the unknown `id` key.
    const result = parseComponentManifest({
      manifestVersion: 1,
      id: "product-option",
      props: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("manifestVersion must be 2"))).toBe(true);
      expect(result.errors.some((e) => e.includes('unknown key "id"'))).toBe(true);
    }
  });

  it("rejects an unknown prop kind and empty select options", () => {
    expect(
      parseComponentManifest({
        manifestVersion: 2,
        props: { a: { kind: "date", optional: false } },
      }).ok,
    ).toBe(false);
    expect(
      parseComponentManifest({
        manifestVersion: 2,
        props: { a: { kind: "select", options: [], optional: false } },
      }).ok,
    ).toBe(false);
  });

  it("rejects editor on a non-string prop", () => {
    const result = parseComponentManifest({
      manifestVersion: 2,
      props: { a: { kind: "number", editor: "color", optional: false } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown key "editor"'))).toBe(true);
    }
  });

  it("rejects an array item that is itself an array", () => {
    const result = parseComponentManifest({
      manifestVersion: 2,
      props: { a: { kind: "array", item: { kind: "array" }, optional: false } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('must not be "array"'))).toBe(true);
    }
  });

  it("rejects a bad action payload kind, non-boolean slot, empty previewStates, bad hostData", () => {
    expect(
      parseComponentManifest({
        manifestVersion: 2,
        props: {},
        actions: { onSelect: { payload: { id: { kind: "object" } } } },
      }).ok,
    ).toBe(false);
    expect(parseComponentManifest({ manifestVersion: 2, props: {}, slot: "yes" }).ok).toBe(false);
    expect(parseComponentManifest({ manifestVersion: 2, props: {}, previewStates: [] }).ok).toBe(
      false,
    );
    expect(parseComponentManifest({ manifestVersion: 2, props: {}, hostData: ["secrets"] }).ok).toBe(
      false,
    );
  });

  it("rejects a wrong manifestVersion and a bad refType", () => {
    // v1 and v3 are both wrong; only v2 is accepted.
    expect(parseComponentManifest({ manifestVersion: 1, props: {} }).ok).toBe(false);
    expect(parseComponentManifest({ manifestVersion: 3, props: {} }).ok).toBe(false);
    expect(
      parseComponentManifest({
        manifestVersion: 2,
        props: { a: { kind: "ref", refType: "user", optional: false } },
      }).ok,
    ).toBe(false);
  });
});

describe("PAYWALL_STYLE_KEYS", () => {
  it("matches the PaywallStyle type keys exactly at runtime", () => {
    expect(PAYWALL_STYLE_KEYS.size).toBe(PAYWALL_STYLE_KEY_LIST.length);
    for (const key of PAYWALL_STYLE_KEY_LIST) {
      expect(PAYWALL_STYLE_KEYS.has(key)).toBe(true);
    }
  });

  it("the source list is exhaustive over PaywallStyle at the type level", () => {
    type Listed = (typeof PAYWALL_STYLE_KEY_LIST)[number];
    expectTypeOf<Exclude<keyof PaywallStyle, Listed>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<Listed, keyof PaywallStyle>>().toEqualTypeOf<never>();
  });
});
