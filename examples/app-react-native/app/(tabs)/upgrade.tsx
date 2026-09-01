import type { Product } from "@voidhash/react-native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Option from "effect/Option";

import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { EVENTS, ONBOARDING_LOCATION, PRO_PERK, PRO_PRODUCT_SLUGS } from "../../lib/nimbus";
import { useTheme } from "../../lib/theme";
import { voidhash } from "../../lib/voidhash";

const PRO_BENEFITS = [
  "Unlimited notes",
  "Markdown export",
  "Everything syncs across your devices",
];

export default function UpgradeScreen() {
  const theme = useTheme();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: products, error: productsError, isLoading } = voidhash.useProducts();
  const { hasAccess: isPro, refetch: refetchAccess } = voidhash.useHasPerk(PRO_PERK);
  const { purchase } = voidhash.usePurchase();

  useEffect(() => {
    voidhash.client.capture(EVENTS.paywallViewed, {
      location: ONBOARDING_LOCATION,
      presentation: "app_owned",
    });
  }, []);

  // Product slugs come from the project's schema, so the display order is the
  // app's decision. Anything the store returned that Nimbus doesn't know about
  // still shows up, after the three it does.
  const knownOffers = PRO_PRODUCT_SLUGS.flatMap((slug) =>
    Option.match(products.get(slug), {
      onNone: () => [],
      onSome: (product) => [product],
    }),
  );
  const knownSlugs = new Set(knownOffers.map((product) => product.slug));
  const offers = [
    ...knownOffers,
    ...products.toList().filter((product) => !knownSlugs.has(product.slug)),
  ];

  const handleBuy = useCallback(
    async (product: Product) => {
      setPendingSlug(product.slug);
      voidhash.client.capture(EVENTS.checkoutStarted, {
        currency: product.currency,
        price: product.price,
        product_slug: product.slug,
      });

      const result = await purchase(product);
      setPendingSlug(null);

      if (result.isErr()) {
        Alert.alert(
          "Purchase failed",
          result.error.code === "READ_ONLY_PURCHASE_NOT_ALLOWED"
            ? "This build runs Voidhash in observer mode, so it cannot start purchases."
            : result.error.message,
        );
        return;
      }

      // Cancellation and deferral are outcomes, not errors: the store returned
      // an answer, it just wasn't "paid".
      switch (result.value.status) {
        case "completed":
          await refetchAccess();
          Alert.alert("You're on Pro", "Unlimited notes and export are unlocked.");
          return;
        case "pending":
          Alert.alert(
            "Waiting on approval",
            "The store needs to confirm this purchase. Pro unlocks as soon as it does.",
          );
          return;
        case "disabled":
          Alert.alert("Voidhash is disabled", "This build cannot complete purchases.");
          return;
        case "cancelled":
          return;
      }
    },
    [purchase, refetchAccess],
  );

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    const result = await voidhash.client.restorePurchases();
    setIsRestoring(false);

    if (result.isErr()) {
      Alert.alert("Restore failed", result.error.message);
      return;
    }

    await refetchAccess();
    Alert.alert("Restore complete", "Any purchase we found for this account is active again.");
  }, [refetchAccess]);

  return (
    <Screen>
      <Card
        subtitle={
          isPro
            ? "You already have everything Nimbus offers."
            : "Keep every note you write and take them with you."
        }
        title="Nimbus Pro"
      >
        {isPro ? <Badge label="Active" tone="positive" /> : null}
        <View style={styles.benefits}>
          {PRO_BENEFITS.map((benefit) => (
            <Text key={benefit} style={[styles.benefit, { color: theme.text }]}>
              {benefit}
            </Text>
          ))}
        </View>
      </Card>

      {/* Developer aid: why the hosted paywall didn't open. Debug builds only —
          the screen has to read as the plan picker it is, not as a failure. */}
      {__DEV__ && reason !== undefined ? (
        <Text style={[styles.reason, { color: theme.mutedText }]}>{reason}</Text>
      ) : null}

      <Card title="Choose a plan">
        {isLoading ? (
          <Text style={[styles.hint, { color: theme.mutedText }]}>Loading plans…</Text>
        ) : null}

        {!isLoading && offers.length === 0 ? (
          <Text style={[styles.hint, { color: theme.mutedText }]}>
            {productsError === undefined
              ? "No products are configured for this platform yet. Add them in Studio, " +
                "then reopen this screen."
              : `Plans could not be loaded (${productsError.code}). ` +
                "Check your connection and try again."}
          </Text>
        ) : null}

        {offers.map((product) => (
          <Pressable
            disabled={pendingSlug !== null || isRestoring}
            key={product.slug}
            onPress={() => {
              void handleBuy(product);
            }}
            style={({ pressed }) => [
              styles.offer,
              {
                backgroundColor: theme.subtleBackground,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.offerText}>
              <Text style={[styles.offerName, { color: theme.text }]}>{product.displayName}</Text>
              <Text style={[styles.hint, { color: theme.mutedText }]}>{product.slug}</Text>
            </View>
            <Text style={[styles.offerPrice, { color: theme.text }]}>
              {pendingSlug === product.slug ? "…" : product.displayPrice}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Button
        disabled={pendingSlug !== null}
        loading={isRestoring}
        onPress={() => {
          void handleRestore();
        }}
        title="Restore purchases"
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  benefit: {
    fontSize: 15,
  },
  benefits: {
    gap: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  offer: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 14,
  },
  offerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: "600",
  },
  offerText: {
    flexShrink: 1,
    gap: 2,
  },
  reason: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
