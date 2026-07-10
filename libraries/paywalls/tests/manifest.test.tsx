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
        <Pressable onPress={() => actions.onSelect({ productId: props.product.id })}>
          <Text>{props.product.displayName}</Text>
          <Slot />
        </Pressable>
      ),
    });

    expect(extractComponentManifest(definition)).toEqual({
      manifestVersion: 2,
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
      props: (p) => ({ product: p.ref("product") }),
      render: ({ props }) => <Text>{props.product.displayName}</Text>,
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("reports hostData products when a preview declares product data", () => {
    const definition = defineComponent({
      previews: { default: { data: { products: [yearly] } } },
      render: () => <View />,
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("reports hostData products when the template reads products via a runtime hook", () => {
    const definition = defineComponent({
      render: () => {
        const products = usePaywallProducts();
        return <Text>{products.length}</Text>;
      },
    });
    expect(extractComponentManifest(definition).hostData).toEqual(["products"]);
  });

  it("emits payload-less actions as empty payload objects", () => {
    const definition = defineComponent({
      actions: (a) => ({ onDismiss: a.action() }),
      render: ({ actions }) => <Pressable onPress={actions.onDismiss} />,
    });
    expect(extractComponentManifest(definition).actions).toEqual({
      onDismiss: { payload: {} },
    });
  });

  it("omits non-serializable defaults from the manifest", () => {
    const definition = defineComponent({
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
      title: "broken-select",
      props: (p) => ({ plan: p.select([]) }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      'Component "broken-select": prop "plan" declares p.select([])',
    );
  });

  it("rejects p.array(p.select([])) items the same way", () => {
    const definition = defineComponent({
      title: "broken-array-select",
      props: (p) => ({ plans: p.array(p.select([])) }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      'Component "broken-array-select": prop "plans" declares p.select([])',
    );
  });

  it('rejects a prop named "id" (reserved for node identity)', () => {
    const definition = defineComponent({
      props: (p) => ({ id: p.string() }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      /"id" is reserved for node identity/,
    );
  });

  it('rejects an action named "id" (reserved for node identity)', () => {
    const definition = defineComponent({
      props: (p) => ({ title: p.string() }),
      actions: (a) => ({ id: a.action({}) }),
      render: () => <View />,
    });
    expect(() => extractComponentManifest(definition)).toThrow(
      /"id" is reserved for node identity/,
    );
  });

  it("keeps explicit optional() and default() both consumer-optional", () => {
    const definition = defineComponent({
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

  it("emits localizable: true for string/image props marked .localizable()", () => {
    const definition = defineComponent({
      props: (p) => ({
        title: p.string().label("Title").localizable(),
        hero: p.image().localizable(),
        subtitle: p.string(),
      }),
      render: () => <View />,
    });

    const manifest = extractComponentManifest(definition);
    expect(manifest.props.title).toEqual({
      kind: "string",
      label: "Title",
      localizable: true,
      optional: false,
    });
    expect(manifest.props.hero).toEqual({
      kind: "image",
      localizable: true,
      optional: false,
    });
    // Props without .localizable() carry no `localizable` key at all.
    expect(manifest.props.subtitle).toEqual({ kind: "string", optional: false });
    expect("localizable" in manifest.props.subtitle!).toBe(false);
  });

  it("is order-independent: .localizable() before or after other chains", () => {
    const definition = defineComponent({
      props: (p) => ({
        before: p.string().localizable().default("hi").label("Before"),
        after: p.string().label("After").default("hi").localizable(),
      }),
      render: () => <View />,
    });

    const manifest = extractComponentManifest(definition);
    const expected = {
      kind: "string",
      localizable: true,
      default: "hi",
      optional: true,
    };
    expect(manifest.props.before).toEqual({ ...expected, label: "Before" });
    expect(manifest.props.after).toEqual({ ...expected, label: "After" });
  });
});
