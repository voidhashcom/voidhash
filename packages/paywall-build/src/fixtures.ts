/**
 * Shared source fixtures for the build tests: a realistic multi-file paywall
 * fork (entry + two components) plus assorted broken variants. Kept as plain
 * string maps so a test can drop one into a {@link MemoryFs}.
 */

/** A component with props, an action, and a `<Slot/>`. */
export const PRICING_OPTION_TSX = `import { defineComponent, View, Text, Pressable, Slot } from "@voidhash/paywalls";

export default defineComponent({
  title: "Pricing Option",
  props: (p) => ({
    label: p.string().default("Yearly"),
    price: p.string().default("$99"),
    highlighted: p.boolean().default(false),
  }),
  actions: (a) => ({
    onSelect: a.action(),
  }),
  render: ({ props, actions }) => (
    <Pressable onPress={actions.onSelect}>
      <View
        style={{
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          gap: 4,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
          borderBottomLeftRadius: 12,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{props.label}</Text>
        <Text style={{ fontSize: 14 }}>{props.price}</Text>
        <Slot />
      </View>
    </Pressable>
  ),
});
`;

/** A simple heading component: a single string prop, no actions, no slot. */
export const HEADING_TSX = `import { defineComponent, Text } from "@voidhash/paywalls";

export default defineComponent({
  title: "Heading",
  props: (p) => ({
    text: p.string().default("Unlock Pro"),
  }),
  render: ({ props }) => (
    <Text style={{ fontSize: 28, fontWeight: "700" }}>{props.text}</Text>
  ),
});
`;

/**
 * A component exercising a `ref` prop, `.editor("color").default(...)`, a
 * `.default(false)` boolean, an action WITH a payload, and a `<Slot/>` — the
 * shape the AI agent authors most, and the one a degraded runtime must resolve
 * statically. Reading its `props.product` also trips the product-hook-free
 * `hostData` path (`ref("product")` ⇒ `["products"]`).
 */
export const PRODUCT_CARD_TSX = `import { defineComponent, View, Text, Pressable, Slot } from "@voidhash/paywalls";

export default defineComponent({
  title: "Product Card",
  props: (p) => ({
    product: p.ref("product"),
    isSelected: p.boolean().default(false),
    accentColor: p.string().editor("color").default("#16a34a"),
  }),
  actions: (a) => ({
    onSelect: a.action({ product: a.string() }),
  }),
  render: ({ props, actions }) => (
    <Pressable onPress={() => actions.onSelect({ product: props.product.id })}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: props.accentColor }}>{props.product.displayName}</Text>
        <Slot />
      </View>
    </Pressable>
  ),
});
`;

/**
 * A slot-bearing component whose `Slot` import is ALIASED (`Slot as S`). The
 * runtime extractor sees the compiled alias rewritten back to `.Slot`, so it
 * reports `slot: true`; the static extractor must resolve the alias through the
 * import bindings to agree — a raw source-text scan would miss it.
 */
export const ALIASED_SLOT_TSX = `import { defineComponent, View, Text, Slot as S } from "@voidhash/paywalls";

export default defineComponent({
  title: "Framed",
  props: (p) => ({
    caption: p.string().default("Framed"),
  }),
  render: ({ props }) => (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12 }}>{props.caption}</Text>
      <S />
    </View>
  ),
});
`;

/** The entry paywall referencing both components (extensionless imports). */
export const PAYWALL_TSX = `import { definePaywall, Screen, View } from "@voidhash/paywalls";
import Heading from "./components/heading";
import PricingOption from "./components/pricing-option";

export default definePaywall({
  render: () => (
    <Screen>
      <View style={{ gap: 12 }}>
        <Heading text="Unlock Pro" />
        <PricingOption label="Yearly" price="$99" highlighted />
      </View>
    </Screen>
  ),
});
`;

/**
 * An entry referencing the components WITHOUT passing props — so it still parses
 * to a composition when the components are degraded (manifest-less), since the
 * placeholder manifest accepts prop-free, slot-bearing references.
 */
export const PAYWALL_PROPLESS_TSX = `import { definePaywall, Screen, View } from "@voidhash/paywalls";
import Heading from "./components/heading";
import PricingOption from "./components/pricing-option";

export default definePaywall({
  render: () => (
    <Screen>
      <View style={{ gap: 12 }}>
        <Heading />
        <PricingOption />
      </View>
    </Screen>
  ),
});
`;

/** A well-formed fork: entry + both components at their canonical paths. */
export function greenFork(): Record<string, string> {
  return {
    "/paywall.tsx": PAYWALL_TSX,
    "/components/heading.tsx": HEADING_TSX,
    "/components/pricing-option.tsx": PRICING_OPTION_TSX,
  };
}
