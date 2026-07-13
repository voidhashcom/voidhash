import type { UsePaywallByLocationOptions } from "@voidhash/react-native";
import { Button } from "components/button";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voidhash } from "utils/voidhash/client";

const PAYWALL_LOCATION_SLUG = "example-paywall";

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { client } = voidhash.useVoidhash();
  const [isOpening, setIsOpening] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshBackendEvidence = useCallback(
    async (operation: string) => {
      const snapshot = await client.getCurrentPerson(true);
      setStatusMessage(`${operation}\nBackend snapshot: ${JSON.stringify(snapshot, null, 2)}`);
    },
    [client],
  );

  const paywallOptions = useMemo<UsePaywallByLocationOptions>(
    () => ({
      onError: (error, context) => {
        setStatusMessage(`Paywall ${context.action} failed: ${error.message}`);
      },
      onPurchase: ({ productId }) => {
        void refreshBackendEvidence(`Purchase completed: ${productId}`).catch((error) => {
          setStatusMessage(`Purchase completed, but backend refresh failed: ${String(error)}`);
        });
      },
      onRestore: () => {
        void refreshBackendEvidence("Restore completed").catch((error) => {
          setStatusMessage(`Restore completed, but backend refresh failed: ${String(error)}`);
        });
      },
    }),
    [refreshBackendEvidence],
  );

  const { show } = voidhash.usePaywallByLocation(PAYWALL_LOCATION_SLUG, paywallOptions);
  const { data: person, isLoading: isPersonLoading } = voidhash.useCurrentPerson();

  const handleShowPaywall = async () => {
    setIsOpening(true);
    try {
      await show();
    } finally {
      setIsOpening(false);
    }
  };

  const handleRestore = async () => {
    setIsReconciling(true);
    try {
      await client.restorePurchases();
      await refreshBackendEvidence("Direct restore completed");
    } catch (error) {
      setStatusMessage(`Direct restore failed: ${String(error)}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleInspectProducts = async () => {
    setIsReconciling(true);
    try {
      const products = await client.getProducts();
      setStatusMessage(`Native products: ${JSON.stringify(products, null, 2)}`);
    } catch (error) {
      setStatusMessage(`Product query failed: ${String(error)}`);
    } finally {
      setIsReconciling(false);
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
    <ScrollView contentContainerStyle={containerStyle}>
      <View>
        <Text style={styles.title}>Native Paywall</Text>
        <Text style={styles.subtitle}>
          Opens a preloaded full-screen paywall rendered by Swift/Kotlin.
        </Text>
        <Text style={styles.location}>Location: {PAYWALL_LOCATION_SLUG}</Text>
        {statusMessage && <Text style={styles.statusMessage}>{statusMessage}</Text>}
        <Text style={styles.personState}>
          {isPersonLoading ? "Loading person..." : `Person: ${JSON.stringify(person)}`}
        </Text>

        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleShowPaywall();
          }}
          style={styles.actionButton}
          title={isOpening ? "Opening..." : "Open paywall"}
        />
        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleRestore();
          }}
          style={styles.secondaryButton}
          title={isReconciling ? "Working..." : "Restore and verify backend"}
        />
        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleInspectProducts();
          }}
          style={styles.secondaryButton}
          title="Inspect native products"
        />
      </View>
    </ScrollView>
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
  personState: {
    color: "#a1a1aa",
    marginTop: 16,
  },
  actionButton: {
    marginTop: 16,
  },
  secondaryButton: {
    backgroundColor: "#27272a",
    marginTop: 12,
  },
});
