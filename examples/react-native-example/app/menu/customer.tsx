import { Button } from "components/button";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voidhash } from "utils/voidhash/local.client";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { client } = voidhash.useVoidhash();
  const {
    data: customer,
    isLoading: isCustomerLoading,
    error: customerError,
  } = voidhash.useCurrentCustomer();

  if (isCustomerLoading) {
    return null;
  }

  const containerStyle = [
    styles.container,
    {
      paddingBottom: Math.max(16, insets.bottom + 16),
      paddingTop: Math.max(32, insets.top + 16),
    },
  ];

  // If no active subscription, show the paywall
  return (
    <View style={containerStyle}>
      <View>
        <Text style={styles.title}>Customer</Text>
        <Text style={styles.jsonText}>{JSON.stringify(customer, null, 2)}</Text>
        <Text style={styles.jsonText}>{JSON.stringify(customerError, null, 2)}</Text>

        {Platform.OS === "ios" && (
          <View style={styles.actions}>
            <Button
              onPress={() => client.iosPresentCodeRedemptionSheet()}
              style={styles.secondaryButton}
              title="Present code redemption sheet"
            />
            <Button
              onPress={() => client.iosShowManageSubscriptions()}
              style={styles.secondaryButton}
              title="Show manage subscriptions"
            />
          </View>
        )}
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
  jsonText: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  actions: {
    gap: 16,
    marginTop: 16,
  },
  secondaryButton: {
    backgroundColor: "#27272a",
  },
});
