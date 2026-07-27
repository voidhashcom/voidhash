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
  useDimensions,
  usePaywallProducts,
  usePaywallVariables,
  usePlatform,
  useSafeAreaInsets,
  View,
} from "../src/index";

const Card = defineComponent({
  props: (p) => ({
    title: p.string().label("Title").default("Untitled"),
  }),
  render: ({ props }) => (
    <View
      style={{
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
      }}
    >
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

  it("exposes explicitly configured platform, safe area, screen and window metrics", () => {
    const Body = () => (
      <Text>
        {JSON.stringify({
          platform: usePlatform(),
          safeAreaInsets: useSafeAreaInsets(),
          screen: useDimensions("screen"),
          window: useDimensions("window"),
        })}
      </Text>
    );
    const paywall = createPaywall({
      title: "Environment hooks",
      render: () => <Body />,
    });
    const html = renderToStaticMarkup(
      <PaywallRenderer
        config={{
          products: [],
          variables: {},
          platform: "ios",
          safeAreaInsets: { top: 59, right: 0, bottom: 34, left: 0 },
          dimensions: {
            screen: { width: 393, height: 852, x: 0, y: 0 },
            window: { width: 390, height: 760, x: 1, y: 59 },
          },
        }}
        paywall={paywall}
      />,
    );

    expect(html).toContain("&quot;platform&quot;:&quot;ios&quot;");
    expect(html).toContain("&quot;top&quot;:59");
    expect(html).toContain("&quot;width&quot;:393");
    expect(html).toContain("&quot;width&quot;:390");
    expect(html).toContain("&quot;y&quot;:59");
  });

  it("uses stable web and zero environment fallbacks during SSR", () => {
    const Body = () => (
      <Text>
        {usePlatform()}|{JSON.stringify(useSafeAreaInsets())}|
        {JSON.stringify(useDimensions("screen"))}|{JSON.stringify(useDimensions("window"))}
      </Text>
    );
    const paywall = createPaywall({
      title: "SSR environment",
      render: () => <Body />,
    });
    const html = renderToStaticMarkup(<PaywallRenderer paywall={paywall} />);

    expect(html).toContain("web|");
    expect(html).toContain(
      "{&quot;top&quot;:0,&quot;right&quot;:0,&quot;bottom&quot;:0,&quot;left&quot;:0}",
    );
    expect(html.match(/&quot;width&quot;:0/g)).toHaveLength(2);
  });

  it("rejects an invalid dimension target with a descriptive error", () => {
    const Body = () => <Text>{useDimensions("viewport" as "window").width}</Text>;
    const paywall = createPaywall({
      title: "Invalid dimensions",
      render: () => <Body />,
    });

    expect(() => renderToStaticMarkup(<PaywallRenderer paywall={paywall} />)).toThrow(
      'useDimensions expected "screen" or "window", received "viewport".',
    );
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
