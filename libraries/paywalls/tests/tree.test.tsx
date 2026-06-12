// NOTE: requires the `react-reconciler` dependency to be installed.
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  defineComponent,
  Image,
  type PaywallProduct,
  Pressable,
  ScrollView,
  Slot,
  Text,
  usePaywallProducts,
  useSelectedProduct,
  View,
} from "../src/index";
import { renderToNodeTree } from "../src/tree";

const yearly: PaywallProduct = {
  id: "com.app.yearly",
  slug: "yearly",
  displayName: "Yearly",
  priceString: "$59.99",
};

const monthly: PaywallProduct = {
  id: "com.app.monthly",
  slug: "monthly",
  displayName: "Monthly",
  priceString: "$9.99",
};

describe("renderToNodeTree", () => {
  it("serializes primitives to §3 nodes with the style subset intact", async () => {
    const tree = await renderToNodeTree(
      <View style={{ flexDirection: "row", padding: 16 }}>
        <Text style={{ color: "#fff" }}>Yearly</Text>
        <Image
          resizeMode="cover"
          source="https://cdn.test/hero.png"
          style={{}}
        />
      </View>,
    );

    expect(tree).toEqual({
      treeVersion: 1,
      state: "default",
      root: {
        type: "view",
        style: { flexDirection: "row", padding: 16 },
        children: [
          { type: "text", style: { color: "#fff" }, text: "Yearly" },
          {
            type: "image",
            style: {},
            src: "https://cdn.test/hero.png",
            resizeMode: "cover",
          },
        ],
      },
    });
  });

  it("keeps paddingHorizontal/Vertical shorthands (allowed by §3.1)", async () => {
    const tree = await renderToNodeTree(
      <View style={[{ paddingHorizontal: 24 }, { marginVertical: 8 }]} />,
    );
    expect(tree.root).toEqual({
      type: "view",
      style: { paddingHorizontal: 24, marginVertical: 8 },
      children: [],
    });
  });

  it("renders components that use hooks and conditionals", async () => {
    const Body = () => {
      const products = usePaywallProducts();
      const { selectedProductId } = useSelectedProduct();
      const [note] = useState("from-state");
      return (
        <View>
          {products.map((product) => (
            <Text key={product.id}>
              {product.id === selectedProductId ? "*" : ""}
              {product.displayName}
            </Text>
          ))}
          {products.length === 0 ? <Text>Empty</Text> : null}
          <Text>{note}</Text>
        </View>
      );
    };

    const tree = await renderToNodeTree(<Body />, {
      config: {
        products: [yearly, monthly],
        defaultSelectedProductId: monthly.id,
      },
      state: "trial",
    });

    expect(tree.state).toBe("trial");
    expect(tree.root).toEqual({
      type: "view",
      style: {},
      children: [
        { type: "text", style: {}, text: "Yearly" },
        { type: "text", style: {}, text: "*Monthly" },
        { type: "text", style: {}, text: "from-state" },
      ],
    });
  });

  it("emits a slot marker for an empty Slot in a component preview", async () => {
    const definition = defineComponent({
      id: "card",
      props: (p) => ({ title: p.string().default("Untitled") }),
      render: ({ props }) => (
        <View>
          <Text>{props.title}</Text>
          <Slot />
        </View>
      ),
    });
    const Card = definition.component;

    const tree = await renderToNodeTree(<Card />);
    expect(tree.root).toEqual({
      type: "view",
      style: {},
      children: [
        { type: "text", style: {}, text: "Untitled" },
        { type: "slot" },
      ],
    });
  });

  it("renders consumer children in place of the slot marker", async () => {
    const definition = defineComponent({
      id: "card",
      render: () => (
        <View>
          <Slot />
        </View>
      ),
    });
    const Card = definition.component;

    const tree = await renderToNodeTree(
      <Card>
        <Text>child</Text>
      </Card>,
    );
    expect(tree.root).toEqual({
      type: "view",
      style: {},
      children: [{ type: "text", style: {}, text: "child" }],
    });
  });

  it("records the action name on pressables bound to declared actions", async () => {
    const definition = defineComponent({
      id: "selectable",
      actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
      render: ({ actions }) => (
        <View>
          <Pressable onPress={actions.onSelect}>
            <Text>direct</Text>
          </Pressable>
          <Pressable onPress={() => actions.onSelect({ productId: "x" })}>
            <Text>wrapped</Text>
          </Pressable>
        </View>
      ),
    });
    const Selectable = definition.component;

    const tree = await renderToNodeTree(<Selectable />);
    expect(tree.root).toMatchObject({
      type: "view",
      children: [
        { type: "pressable", action: "onSelect" },
        { type: "pressable" },
      ],
    });
    if (tree.root.type !== "view") {
      throw new Error("expected a view root");
    }
    expect(tree.root.children[1]).not.toHaveProperty("action");
  });

  it("serializes scroll views and preserves contentContainerStyle as a view", async () => {
    const tree = await renderToNodeTree(
      <ScrollView contentContainerStyle={{ gap: 8 }} horizontal>
        <Text>a</Text>
      </ScrollView>,
    );
    expect(tree.root).toEqual({
      type: "scroll",
      style: { flexDirection: "row" },
      children: [
        {
          type: "view",
          style: { gap: 8 },
          children: [{ type: "text", style: {}, text: "a" }],
        },
      ],
    });
  });

  it("produces a placeholder when the render throws", async () => {
    const Boom = (): never => {
      throw new Error("kaboom");
    };
    const tree = await renderToNodeTree(<Boom />);
    expect(tree.root).toEqual({
      type: "placeholder",
      reason: "render threw: kaboom",
    });
  });

  it("produces a placeholder when the render yields null", async () => {
    const Nothing = () => null;
    const tree = await renderToNodeTree(<Nothing />);
    expect(tree.root).toEqual({
      type: "placeholder",
      reason: "render returned null",
    });
  });

  it("replaces non-paywall elements with diagnostic placeholders", async () => {
    const tree = await renderToNodeTree(<div>raw</div>);
    expect(tree.root).toEqual({
      type: "placeholder",
      reason: 'unsupported element type "div"',
    });
  });

  it("wraps multi-node roots in an implicit view", async () => {
    const tree = await renderToNodeTree(
      <>
        <Text>a</Text>
        <Text>b</Text>
      </>,
    );
    expect(tree.root).toEqual({
      type: "view",
      style: {},
      children: [
        { type: "text", style: {}, text: "a" },
        { type: "text", style: {}, text: "b" },
      ],
    });
  });
});
