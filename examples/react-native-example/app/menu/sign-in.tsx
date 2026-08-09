import { Effect } from "effect";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fakeAuthService, users } from "utils/fake-auth-service";
import { voidhash } from "utils/voidhash/client";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignIn = (email: string) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const user = yield* Effect.promise(() => fakeAuthService.signIn(email));

        // This syncs the current user with Voidhash. Make sure the identifier passed is unique and hard to guess.
        yield* Effect.promise(() =>
          voidhash.client.identify(user.id, {
            email: user.email,
            name: user.name,
          }),
        );

        router.back();
      }),
    );

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
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Tap to sign in</Text>
        <View style={styles.userGrid}>
          {Object.values(users).map((user) => (
            <Pressable
              key={user.id}
              onPress={() => handleSignIn(user.email)}
              style={styles.userCard}
            >
              <Image source={user.avatar} style={styles.avatar} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </Pressable>
          ))}
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
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  userGrid: {
    columnGap: 32,
    flexDirection: "row",
    marginTop: 32,
  },
  userCard: {
    aspectRatio: 1,
    flex: 1,
  },
  avatar: {
    borderRadius: 8,
    height: "100%",
    width: "100%",
  },
  userInfo: {
    paddingTop: 16,
  },
  userName: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  userEmail: {
    color: "#a1a1aa",
    marginTop: 8,
  },
});
