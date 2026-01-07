import { MenuItem } from "components/menu-item";
import { useRouter } from "expo-router";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { fakeAuthService, useCurrentUser } from "utils/fake-auth-service";
import { cn } from "utils/lib";
import { voidhash } from "utils/voidhash/local.client";

import { Logo } from "../components/logo";

export default function HomeScreen() {
  const router = useRouter();

  // Mock authentication
  const { user, isLoading } = useCurrentUser();

  // Signs out the user
  const handleSignOut = async () => {
    await fakeAuthService.signOut();
    await voidhash.client.signOut();
  };

  // Resets the Voidhash cache. This is useful for testing.
  const handleResetCache = () => {
    voidhash.client.resetCache();
  };

  if (isLoading) {
    return (
      <View className="h-full w-full items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // If no active subscription, show the paywall
  return (
    <View className="flex-1 justify-between bg-black px-4 pt-safe-4 pt-safe-offset-8 pb-safe-offset-4">
      <View className="flex-row items-end gap-x-3">
        <Logo className="mt-2" height={20} variant="symbol" />
        <Text className="mb-px font-bold text-3xl text-white">Playground</Text>
      </View>

      <View className="mt-8">
        {user && (
          <>
            <View
              className={cn(
                "flex flex-row items-center gap-6 rounded-t-lg border-zinc-800 border-b bg-zinc-900 p-3"
              )}
            >
              <Image
                className="aspect-square w-20 rounded-md"
                source={user.avatar}
              />
              <View className="flex-1 ">
                <Text className="font-semibold text-white">{user.name}</Text>
                <Text className="mt-2 text-zinc-400">{user.email}</Text>
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
      <View className="mt-8 flex-1 justify-start">
        <MenuItem
          isFirst
          onPress={() => router.push("/menu/paywall")}
          title="Paywall"
        />
        <MenuItem
          isLast
          onPress={() => router.push("/menu/customer")}
          title="Customer"
        />
        <View className="mt-8">
          <MenuItem
            isFirst
            isLast
            onPress={handleResetCache}
            title="Clear cache"
          />
        </View>
      </View>
    </View>
  );
}
