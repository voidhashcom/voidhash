import type { Period, Product } from "@voidhash/react-native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { EVENTS, ONBOARDING_LOCATION, PRO_PERK, PRO_PRODUCT_SLUGS } from "../../lib/nimbus";
import { useTheme } from "../../lib/theme";
import { voidhash } from "../../lib/voidhash";

const PRO_BENEFITS = ["Unlimited notes", "Markdown export", "Everything syncs across your devices"];

const describePeriod = (period: Period) =>
  period.count === 1 ? period.unit : `${period.count} ${period.unit}s`;

/**
 * What a plan costs, as the store sells it to this customer: the free trial
 * they can get (a purchase applies it by default), then the regular price.
 */
const describePrice = (product: Product) => {
  if (product.type !== "subscription") return product.price.formatted;
  const regular = `${product.price.formatted} / ${describePeriod(product.subscription.period)}`;
  const trial = product.subscription.introOffer?.phases[0];
  return trial?.paymentMode === "freeTrial"
    ? `${describePeriod({ ...trial.period, count: trial.period.count * trial.cycles })} free, then ${regular}`
    : regular;
};

export default function UpgradeScreen() {
  const theme = useTheme();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  // The three plans Nimbus knows, in its own order; one the store does not sell is `undefined`.
  const {
    products: plans,
    error: productsError,
    isLoading,
  } = voidhash.useProducts(PRO_PRODUCT_SLUGS);
  const { products: allProducts } = voidhash.useProducts();
  const { hasAccess: isPro } = voidhash.useHasPerk(PRO_PERK);
  const { purchase, pendingProduct } = voidhash.usePurchase();
  // The restore answers the refreshed person, so it can say what it found; `isPro` above updates
  // without a refetch.
  const { restore, isLoading: isRestoring } = voidhash.useRestorePurchases({
    onError: (error) => Alert.alert("Restore failed", error.message),
    onSuccess: (person) =>
      person?.entitlements.grants.some(
        (grant) => grant.perkSlug === PRO_PERK && grant.status === "active",
      )
        ? Alert.alert("Restore complete", "Pro is active again on this device.")
        : Alert.alert("Nothing to restore", "This store account has no Nimbus Pro purchase."),
  });

  useEffect(() => {
    voidhash.client.capture(EVENTS.paywallViewed, {
      location: ONBOARDING_LOCATION,
      presentation: "app_owned",
    });
  }, []);

  // Anything the store returned that Nimbus doesn't know about still shows up, after the three it
  // does.
  const knownSlugs: ReadonlyArray<string> = PRO_PRODUCT_SLUGS;
  const offers = [
    ...plans.filter((plan) => plan !== undefined),
    ...allProducts.filter((product) => !knownSlugs.includes(product.slug)),
  ];

  const handleBuy = useCallback(
    async (product: Product) => {
      voidhash.client.capture(EVENTS.checkoutStarted, {
        currency: product.price.currencyCode,
        price: product.price.amount,
        product_slug: product.slug,
      });

      // A second press while the store sheet is up answers the same purchase.
      const result = await purchase(product);

      if (result.isErr()) {
        Alert.alert(
          "Purchase failed",
          result.error.code === "READ_ONLY_PURCHASE_NOT_ALLOWED"
            ? "This build runs Voidhash in observer mode, so it cannot start purchases."
            : result.error.message,
        );
        return;
      }

      // Cancellation and pending payments are outcomes, not errors: the store returned an answer,
      // it just wasn't "paid".
      switch (result.value.status) {
        case "purchased":
          // `synced` is false when the store charged but Voidhash has not confirmed the receipt
          // yet (offline, say): the purchase is done, and Pro unlocks once it lands.
          Alert.alert(
            result.value.synced ? "You're on Pro" : "Purchase received",
            result.value.synced
              ? "Unlimited notes and export are unlocked."
              : "Pro unlocks as soon as the purchase reaches Voidhash. There is nothing else to do.",
          );
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
    [purchase],
  );

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
        {isPro ? (
          <Button
            onPress={() => {
              void voidhash.client.showManageSubscriptions();
            }}
            title="Manage subscription"
            variant="secondary"
          />
        ) : null}
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
            {productsError === null
              ? "No products are configured for this platform yet. Add them in Studio, " +
                "then reopen this screen."
              : `Plans could not be loaded (${productsError.code}). ` +
                "Check your connection and try again."}
          </Text>
        ) : null}

        {offers.map((product) => (
          <Pressable
            disabled={pendingProduct !== undefined || isRestoring}
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
              {pendingProduct?.slug === product.slug ? "…" : describePrice(product)}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Button
        disabled={pendingProduct !== undefined}
        loading={isRestoring}
        onPress={restore}
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
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
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
