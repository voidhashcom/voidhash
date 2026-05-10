import type { UsePaywallByLocationOptions } from "@voidhash/react-native";
import { Button } from "components/button";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voidhash } from "utils/voidhash/client";

const PAYWALL_LOCATION_SLUG = "example-paywall";

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const [isOpening, setIsOpening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const paywallOptions = useMemo<UsePaywallByLocationOptions>(
    () => ({
      onError: (error, context) => {
        setStatusMessage(`Paywall ${context.action} failed: ${error.message}`);
      },
      onPurchase: ({ productId }) => {
        setStatusMessage(`Purchase completed: ${productId}`);
      },
      onRestore: () => {
        setStatusMessage("Restore completed");
      },
    }),
    []
  );

  const { show } = voidhash.usePaywallByLocation(
    PAYWALL_LOCATION_SLUG,
    paywallOptions
  );
  const { data: customer, isLoading: isCustomerLoading } =
    voidhash.useCurrentCustomer();

  const handleShowPaywall = async () => {
    setIsOpening(true);
    try {
      await show();
    } finally {
      setIsOpening(false);
    }
  };

  const containerStyle = [
    styles.container,
    {
      paddingBottom: Math.max(16, insets.bottom + 16),
      paddingTop: Math.max(32, insets.top + 16),
    },
  ];

  return (
    <View style={containerStyle}>
      <View>
        <Text style={styles.title}>Native Paywall</Text>
        <Text style={styles.subtitle}>
          Opens a preloaded full-screen paywall rendered by Swift/Kotlin.
        </Text>
        <Text style={styles.location}>Location: {PAYWALL_LOCATION_SLUG}</Text>
        {statusMessage && (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        )}
        <Text style={styles.customerState}>
          {isCustomerLoading
            ? "Loading customer..."
            : `Customer: ${JSON.stringify(customer)}`}
        </Text>

        <Button
          disabled={isOpening}
          onPress={() => {
            void handleShowPaywall();
          }}
          style={styles.actionButton}
          title={isOpening ? "Opening..." : "Open paywall"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  location: {
    color: "#71717a",
    marginTop: 8,
  },
  statusMessage: {
    backgroundColor: "#18181b",
    borderRadius: 6,
    color: "#e4e4e7",
    fontSize: 14,
    marginTop: 16,
    padding: 12,
  },
  customerState: {
    color: "#a1a1aa",
    marginTop: 16,
  },
  actionButton: {
    marginTop: 16,
  },
});
