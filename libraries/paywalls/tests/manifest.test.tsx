import { describe, expect, it } from "vitest";

import {
  defineComponent,
  extractComponentManifest,
  type PaywallProduct,
  Pressable,
  Slot,
  Text,
  usePaywallProducts,
  View,
} from "../src/index";

const yearly: PaywallProduct = {
  id: "com.app.yearly",
  slug: "yearly",
  displayName: "Yearly",
  priceString: "$59.99",
};

describe("extractComponentManifest", () => {
  it("emits the contract §2 manifest for a full-surface component", () => {
    const definition = defineComponent({
      id: "product-option",
      title: "Product Option",
      description: "A selectable product row.",
      props: (p) => ({
        product: p.ref("product").label("Product"),
        selected: p.boolean().default(false),
        accentColor: p.string().editor("color").default("#16a34a"),
        badge: p.component().optional(),
        features: p.array(p.string()).optional(),
        plan: p.select(["monthly", "yearly"]).optional(),
      }),
      actions: (a) => ({
        onSelect: a.action({ productId: a.string() }),
      }),
      previews: {
        default: { data: { products: [yearly] } },
        trial: { props: { selected: true } },
      },
      render: ({ props, actions }) => (
        <Pressable
          onPress={() => actions.onSelect({ productId: props.product.id })}
        >
          <Text>{props.product.displayName}</Text>
          <Slot />
        </Pressable>
      ),
    });

    expect(extractComponentManifest(definition)).toEqual({
      manifestVersion: 1,
      id: "product-option",
      title: "Product Option",
      description: "A selectable product row.",
      props: {
        product: {
          kind: "ref",
          refType: "product",
          label: "Product",
          optional: false,
        },
        selected: { kind: "boolean", default: false, optional: true },
        accentColor: {
          kind: "string",
          editor: "color",
          default: "#16a34a",
          optional: true,
        },
        badge: { kind: "component", optional: true },
        features: { kind: "array", item: { kind: "string" }, optional: true },
        plan: {
          kind: "select",
          options: ["monthly", "yearly"],
          optional: true,
        },
      },
      actions: {
        onSelect: { payload: { productId: { kind: "string" } } },
      },
      slot: true,
      previewStates: ["default", "trial"],
      hostData: ["products"],
    });
  });

  it("reports slot: false and empty hostData for a plain component", () => {
    const definition = defineComponent({
      id: "title-block",
      props: (p) => ({ title: p.string() }),
      render: ({ props }) => (
        <View>
          <Text>{props.title}</Text>
        </View>
      ),
    });

    const manifest = extractComponentManifest(definition);
    expect(manifest.slot).toBe(false);
    expect(manifest.hostData).toEqual([]);
    expect(manifest.actions).toEqual({});
    expect(manifest.previewStates).toEqual(["default"]);
    expect(manifest.title).toBeUndefined();
  });

  it("reports hostData products when a prop is ref('product')", () => {
    const definition = defineComponent({
      id: "with-ref",
      props: (p) => ({ product: p.ref("product") }),
      render: ({ props }) => <Text>{props.product.displayName}</Text>,
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("reports hostData products when a preview declares product data", () => {
    const definition = defineComponent({
      id: "with-preview-products",
      previews: { default: { data: { products: [yearly] } } },
      render: () => <View />,
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("reports hostData products when the template reads products via a runtime hook", () => {
    const definition = defineComponent({
      id: "with-products-hook",
      render: () => {
        const products = usePaywallProducts();
        return <Text>{products.length}</Text>;
      },
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("emits payload-less actions as empty payload objects", () => {
    const definition = defineComponent({
      id: "with-bare-action",
      actions: (a) => ({ onDismiss: a.action() }),
      render: ({ actions }) => <Pressable onPress={actions.onDismiss} />,
    });
    expect(extractComponentManifest(definition).actions).toEqual({
      onDismiss: { payload: {} },
    });
  });

  it("omits non-serializable defaults from the manifest", () => {
    const definition = defineComponent({
      id: "with-node-default",
      props: (p) => ({ badge: p.component().default(<Text>hi</Text>) }),
      render: ({ props }) => <View>{props.badge}</View>,
    });
    expect(extractComponentManifest(definition).props.badge).toEqual({
      kind: "component",
      optional: true,
    });
  });

  it("emits the contract §2 per-kind table for every builder combination", () => {
    const definition = defineComponent({
      id: "per-kind",
      props: (p) => ({
        headline: p.string().editor("color").default("#16a34a"),
        count: p.number().default(3),
        highlighted: p.boolean().default(false),
        plan: p.select(["monthly", "yearly"]).default("monthly"),
        hero: p.image().default("https://cdn.test/hero.png"),
        product: p.ref("product"),
        badge: p.component(),
        features: p.array(p.string()).default(["a", "b"]),
      }),
      render: () => <View />,
    });

    const manifest = extractComponentManifest(definition);
    // Round-trip through JSON: the manifest artifact is what the server
    // validates, so defaults must survive serialization losslessly.
    expect(JSON.parse(JSON.stringify(manifest.props))).toEqual({
      headline: {
        kind: "string",
        editor: "color",
        default: "#16a34a",
        optional: true,
      },
      count: { kind: "number", default: 3, optional: true },
      highlighted: { kind: "boolean", default: false, optional: true },
      plan: {
        kind: "select",
        options: ["monthly", "yearly"],
        default: "monthly",
        optional: true,
      },
      hero: {
        kind: "image",
        default: "https://cdn.test/hero.png",
        optional: true,
      },
      product: { kind: "ref", refType: "product", optional: false },
      badge: { kind: "component", optional: false },
      features: {
        kind: "array",
        item: { kind: "string" },
        default: ["a", "b"],
        optional: true,
      },
    });
  });

  it("rejects p.select([]) with an error naming the component and prop", () => {
    const definition = defineComponent({
      id: "broken-select",
      props: (p) => ({ plan: p.select([]) }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      'Component "broken-select": prop "plan" declares p.select([])',
    );
  });

  it("rejects p.array(p.select([])) items the same way", () => {
    const definition = defineComponent({
      id: "broken-array-select",
      props: (p) => ({ plans: p.array(p.select([])) }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      'Component "broken-array-select": prop "plans" declares p.select([])',
    );
  });

  it("keeps explicit optional() and default() both consumer-optional", () => {
    const definition = defineComponent({
      id: "optionality",
      props: (p) => ({
        required: p.string(),
        optional: p.string().optional(),
        defaulted: p.number().default(3),
      }),
      render: () => <View />,
    });
    const manifest = extractComponentManifest(definition);
    expect(manifest.props.required?.optional).toBe(false);
    expect(manifest.props.optional?.optional).toBe(true);
    expect(manifest.props.defaulted).toEqual({
      kind: "number",
      default: 3,
      optional: true,
    });
  });
});
