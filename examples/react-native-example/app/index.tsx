import { MenuItem } from "components/menu-item";
import { useRouter } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fakeAuthService, useCurrentUser } from "utils/fake-auth-service";
import { voidhash } from "utils/voidhash/client";

import { Logo } from "../components/logo";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mock authentication
  const { user, isLoading } = useCurrentUser();

  // Resets the current identity and signs the example user out.
  const handleSignOut = async () => {
    await fakeAuthService.signOut();
    await voidhash.client.reset();
  };

  // Resets the Voidhash cache. This is useful for testing.
  const handleResetCache = () => {
    voidhash.client.resetCache();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  const containerStyle = [
    styles.container,
    {
      paddingBottom: Math.max(16, insets.bottom + 16),
      paddingTop: Math.max(32, insets.top + 32),
    },
  ];

  // If no active subscription, show the paywall
  return (
    <View style={containerStyle}>
      <View style={styles.headerRow}>
        <Logo height={20} style={styles.logo} variant="symbol" />
        <Text style={styles.heading}>Playground</Text>
      </View>

      <View style={styles.section}>
        {user && (
          <>
            <View style={styles.userCard}>
              <Image source={user.avatar} style={styles.userAvatar} />
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
            <MenuItem onPress={handleSignOut} title="Sign out" />
          </>
        )}

        <MenuItem
          isFirst={!user}
          isLast
          onPress={() => {
            router.push("/menu/sign-in");
          }}
          title={user ? "Switch account" : "Sign in"}
        />
      </View>
      <View style={styles.menuSection}>
        <MenuItem isFirst onPress={() => router.push("/menu/paywall")} title="Paywall" />
        <MenuItem onPress={() => router.push("/menu/webview-smoke")} title="WebView smoke" />
        <MenuItem isLast onPress={() => router.push("/menu/customer")} title="Customer" />
        <View style={styles.subSection}>
          <MenuItem isFirst isLast onPress={handleResetCache} title="Clear cache" />
        </View>
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
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  headerRow: {
    alignItems: "flex-end",
    columnGap: 12,
    flexDirection: "row",
  },
  logo: {
    marginTop: 8,
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 1,
  },
  section: {
    marginTop: 32,
  },
  userCard: {
    alignItems: "center",
    backgroundColor: "#18181b",
    borderBottomColor: "#27272a",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    columnGap: 24,
    flexDirection: "row",
    padding: 12,
  },
  userMeta: {
    flex: 1,
  },
  userAvatar: {
    aspectRatio: 1,
    borderRadius: 8,
    width: 80,
  },
  userName: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  userEmail: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  menuSection: {
    flex: 1,
    justifyContent: "flex-start",
    marginTop: 32,
  },
  subSection: {
    marginTop: 32,
  },
});
