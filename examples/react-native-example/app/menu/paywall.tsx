import type { UsePaywallByLocationOptions } from "@voidhash/react-native";
import { Button } from "components/button";
import { Data, Effect, Inspectable } from "effect";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voidhash } from "utils/voidhash/client";

const PAYWALL_LOCATION_SLUG = "example-paywall";

class PaywallActionError extends Data.TaggedError("PaywallActionError")<{
  readonly text: string;
}> {}

/** Runs a promise-returning SDK call, keeping the rejection value as display text. */
const attempt = <A,>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new PaywallActionError({ text: String(cause) }) });

const personStateLabel = (isLoading: boolean, person: unknown) => {
  if (isLoading) return "Loading person...";
  return `Person: ${Inspectable.toStringUnknown(person, undefined)}`;
};

const openPaywallTitle = (isOpening: boolean) => {
  if (isOpening) return "Opening...";
  return "Open paywall";
};

const restoreTitle = (isReconciling: boolean) => {
  if (isReconciling) return "Working...";
  return "Restore and verify backend";
};

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { client } = voidhash.useVoidhash();
  const [isOpening, setIsOpening] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshBackendEvidence = useCallback(
    (operation: string) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const snapshot = yield* Effect.promise(() =>
            client.getCurrentPerson({ forceFetch: true }).then((result) => result.unwrapOr(null)),
          );
          setStatusMessage(
            `${operation}\nBackend snapshot: ${Inspectable.toStringUnknown(snapshot)}`,
          );
        }),
      ),
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

  const handleShowPaywall = () => {
    setIsOpening(true);
    return Effect.runPromise(
      Effect.promise(() => show()).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            setIsOpening(false);
          }),
        ),
      ),
    );
  };

  const handleRestore = () => {
    setIsReconciling(true);
    return Effect.runPromise(
      Effect.gen(function* () {
        yield* attempt(() => client.restorePurchases().then((result) => result.unwrap()));
        yield* attempt(() => refreshBackendEvidence("Direct restore completed"));
      }).pipe(
        Effect.catchTag("PaywallActionError", (error) =>
          Effect.sync(() => {
            setStatusMessage(`Direct restore failed: ${error.text}`);
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setIsReconciling(false);
          }),
        ),
      ),
    );
  };

  const handleInspectProducts = () => {
    setIsReconciling(true);
    return Effect.runPromise(
      Effect.gen(function* () {
        const products = yield* attempt(() =>
          client.getProducts().then((result) => result.unwrap()),
        );
        setStatusMessage(`Native products: ${Inspectable.toStringUnknown(products)}`);
      }).pipe(
        Effect.catchTag("PaywallActionError", (error) =>
          Effect.sync(() => {
            setStatusMessage(`Product query failed: ${error.text}`);
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setIsReconciling(false);
          }),
        ),
      ),
    );
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
          {personStateLabel(isPersonLoading, person)}
        </Text>

        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleShowPaywall();
          }}
          style={styles.actionButton}
          title={openPaywallTitle(isOpening)}
        />
        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleRestore();
          }}
          style={styles.outlineButton}
          title={restoreTitle(isReconciling)}
        />
        <Button
          disabled={isOpening || isReconciling}
          onPress={() => {
            void handleInspectProducts();
          }}
          style={styles.outlineButton}
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
  outlineButton: {
    backgroundColor: "transparent",
    borderColor: "#3f3f46",
    borderWidth: 1,
    marginTop: 12,
  },
});
