import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createPaywall,
  defineComponent,
  type PaywallBridge,
  type PaywallOutboundEnvelope,
  PaywallRenderer,
  Pressable,
  Slot,
  Text,
  usePaywallProducts,
  usePaywallVariables,
  View,
} from "../src/index";

const Card = defineComponent({
  id: "card",
  props: (p) => ({
    title: p.string().label("Title").default("Untitled"),
  }),
  render: ({ props }) => (
    <View style={{ paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }}>
      <Text>Card {props.title}</Text>
      <Slot />
    </View>
  ),
}).component;

const collectingBridge = (posted: PaywallOutboundEnvelope[]): PaywallBridge => ({
  post: (envelope) => {
    posted.push(envelope);
  },
  subscribe: () => () => {
    // no inbound channel in tests
  },
});

describe("DOM paywall rendering", () => {
  it("renders primitives with the RN flex reset and resolved styles", () => {
    const paywall = createPaywall({
      title: "Onboarding",
      render: (
        <View style={{ paddingLeft: 24, paddingRight: 24 }}>
          <Pressable>
            <Text>Hello World</Text>
          </Pressable>
        </View>
      ),
    });

    const html = renderToStaticMarkup(<PaywallRenderer paywall={paywall} />);
    expect(html).toContain("Hello World");
    expect(html).toContain('role="button"');
    expect(html).toContain("flex-direction:column");
    expect(html).toContain("padding-left:24px");
    expect(html).toContain("padding-right:24px");
  });

  it("fills component defaults and renders slotted children", () => {
    const paywall = createPaywall({
      title: "With component",
      render: (
        <Card>
          <Text>Slotted child</Text>
        </Card>
      ),
    });

    const html = renderToStaticMarkup(<PaywallRenderer paywall={paywall} />);
    expect(html).toContain("Card Untitled");
    expect(html).toContain("Slotted child");
  });

  it("overrides component defaults when provided", () => {
    const paywall = createPaywall({
      title: "Override",
      render: <Card title="Pro" />,
    });
    expect(renderToStaticMarkup(<PaywallRenderer paywall={paywall} />)).toContain("Card Pro");
  });

  it("exposes runtime products and variables through hooks", () => {
    const Body = () => {
      const products = usePaywallProducts();
      const variables = usePaywallVariables();
      return (
        <Text>
          {products.map((product) => product.displayName).join(",")}|{String(variables.accentColor)}
        </Text>
      );
    };
    const paywall = createPaywall({ title: "Hooks", render: () => <Body /> });

    const html = renderToStaticMarkup(
      <PaywallRenderer
        config={{
          products: [
            {
              id: "y",
              slug: "yearly",
              displayName: "Yearly",
              priceString: "$59.99",
            },
          ],
          variables: { accentColor: "#16a34a" },
        }}
        paywall={paywall}
      />,
    );
    expect(html).toContain("Yearly|#16a34a");
  });

  it("carries paywall metadata under __voidhash", () => {
    const paywall = createPaywall({
      title: "Onboarding",
      description: "Full-screen onboarding paywall.",
      products: ["yearly", "monthly"],
      variables: { accentColor: "#16a34a" },
      render: <View />,
    });
    expect(paywall.__voidhash).toEqual({
      kind: "paywall",
      title: "Onboarding",
      description: "Full-screen onboarding paywall.",
      products: ["yearly", "monthly"],
      variables: { accentColor: "#16a34a" },
    });
  });

  it("accepts an injected bridge (no envelopes from a static render)", () => {
    const posted: PaywallOutboundEnvelope[] = [];
    const paywall = createPaywall({ title: "Bridge", render: <View /> });
    renderToStaticMarkup(<PaywallRenderer bridge={collectingBridge(posted)} paywall={paywall} />);
    // Static SSR runs no effects, so `ready` is not announced here; the
    // mount-time behaviour is covered by the tree renderer tests.
    expect(posted).toEqual([]);
  });
});
