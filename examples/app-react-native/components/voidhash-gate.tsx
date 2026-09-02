import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Option from "effect/Option";

import { hasPublishableKey, voidhash } from "../lib/voidhash";
import { useTheme } from "../lib/theme";
import { Button } from "./button";
import { Card } from "./card";

interface VoidhashGateProps {
  children: ReactNode;
}

/**
 * Renders the app only once the SDK is ready, and gives the two states most
 * apps forget a real screen: still initializing, and failed to initialize.
 *
 * A failed `init()` is recoverable — no network on app launch is the common
 * cause — so the failure state offers `retryInit()` rather than leaving the
 * user with a blank screen.
 */
export function VoidhashGate(props: VoidhashGateProps) {
  const { initError, retryInit, status } = voidhash.useVoidhash();
  const theme = useTheme();
  const initErrorMessage = Option.map(initError, (error) => error.message).pipe(
    Option.getOrElse(() => "Voidhash could not start."),
  );

  if (status === "ready") {
    return <>{props.children}</>;
  }

  if (status === "initializing") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.hint, { color: theme.mutedText }]}>Connecting to Voidhash…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.centered}>
        {status === "disabled" && !hasPublishableKey ? (
          <Card
            subtitle={
              "Copy .env.example to .env, paste the vh_pk_ key from Studio → Project " +
              "settings → API keys, then restart the bundler: Expo inlines EXPO_PUBLIC_ " +
              "variables at build time, so a running bundler will not pick the key up."
            }
            title="Add your publishable key"
          />
        ) : status === "disabled" ? (
          <Card
            subtitle="This build was created with enabled: false, so the SDK is inert."
            title="Voidhash is disabled"
          />
        ) : (
          <Card subtitle={initErrorMessage} title="Could not reach Voidhash">
            <Button onPress={retryInit} title="Try again" />
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    gap: 16,
    justifyContent: "center",
    padding: 24,
  },
  container: {
    flex: 1,
    justifyContent: "center",
  },
  hint: {
    fontSize: 14,
    textAlign: "center",
  },
});
