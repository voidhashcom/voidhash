import {
  createPaywall,
  Pressable,
  Text,
  usePaywallActions,
  usePaywallProducts,
  usePaywallVariables,
  useSelectedProduct,
  View,
} from "@voidhash/paywalls";

import productOption from "../components/product-option";

const ProductOption = productOption.component;

const DEFAULT_ACCENT_COLOR = "#16a34a";

/** Reads the `accentColor` paywall variable, falling back to the default green. */
const resolveAccentColor = (value: unknown): string => {
  if (typeof value === "string") return value;
  return DEFAULT_ACCENT_COLOR;
};

export default createPaywall({
  title: "Onboarding",
  description: "Full-screen onboarding paywall.",
  products: ["yearly", "monthly"],
  variables: { accentColor: "#16a34a" },
  render: () => {
    const products = usePaywallProducts();
    const variables = usePaywallVariables();
    const actions = usePaywallActions();
    const { selectedProductId, selectProduct } = useSelectedProduct();
    const accentColor = resolveAccentColor(variables.accentColor);

    return (
      <View
        style={{
          backgroundColor: "#0b0b0f",
          flex: 1,
          gap: 16,
          justifyContent: "flex-end",
          padding: 24,
        }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "800" }}>Unlock everything</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
          Unlimited projects, every pro feature, and priority support.
        </Text>
        <View style={{ gap: 12 }}>
          {products.map((product) => (
            <ProductOption
              accentColor={accentColor}
              key={product.id}
              onSelect={({ productId }) => selectProduct(productId)}
              product={product}
              selected={product.id === selectedProductId}
            />
          ))}
        </View>
        <Pressable
          onPress={() => actions.purchase()}
          style={{
            alignItems: "center",
            backgroundColor: accentColor,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>Continue</Text>
        </Pressable>
        <Pressable onPress={() => actions.close()} style={{ alignItems: "center", padding: 8 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Not now</Text>
        </Pressable>
      </View>
    );
  },
});
