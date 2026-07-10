import { defineComponent, type PaywallProduct, Pressable, Text, View } from "@voidhash/paywalls";

const yearlyFixture: PaywallProduct = {
  currencyCode: "USD",
  displayName: "Yearly Pro",
  id: "com.example.app.yearly",
  period: "year",
  priceString: "$59.99",
  slug: "yearly",
  trialPeriod: "7d",
};

/**
 * A selectable product row: name and trial on the left, price on the right.
 * Purely presentational — the paywall passes the product, whether it is
 * selected, and an `onSelect` handler.
 */
export default defineComponent({
  id: "product-option",
  title: "Product Option",
  description: "A selectable product row showing name, trial and price.",
  props: (p) => ({
    product: p.ref("product").label("Product"),
    selected: p.boolean().default(false),
    accentColor: p.string().editor("color").default("#16a34a"),
  }),
  actions: (a) => ({
    onSelect: a.action({ productId: a.string() }),
  }),
  previews: {
    default: { props: { product: yearlyFixture } },
    selected: { props: { product: yearlyFixture, selected: true } },
  },
  render: ({ props, actions }) => (
    <Pressable
      onPress={() => actions.onSelect({ productId: props.product.id })}
      style={{
        alignItems: "center",
        backgroundColor: props.selected ? "rgba(255,255,255,0.10)" : "transparent",
        borderColor: props.selected ? props.accentColor : "rgba(255,255,255,0.15)",
        borderRadius: 16,
        borderWidth: 2,
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 16,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
          {props.product.displayName}
        </Text>
        {props.product.trialPeriod ? (
          <Text style={{ color: props.accentColor, fontSize: 12 }}>
            {props.product.trialPeriod} free trial
          </Text>
        ) : null}
      </View>
      <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
        {props.product.priceString}
      </Text>
    </Pressable>
  ),
});
