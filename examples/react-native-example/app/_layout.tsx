import { Stack } from "expo-router";
import "react-native-reanimated";
import "fast-text-encoding";
import { StatusBar } from "expo-status-bar";
import { voidhash } from "utils/voidhash/client";

// Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // useEffect(() => {
  // 	SplashScreen.hideAsync();
  // }, []);

  return (
    <>
      <voidhash.Provider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="menu/paywall"
            options={{
              headerTintColor: "#FFF",
              headerTitle: "Products",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="menu/customer"
            options={{
              headerTintColor: "#FFF",
              headerTitle: "Customer",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="menu/sign-in"
            options={{
              headerTintColor: "#FFF",
              headerTitle: "Sign in",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="menu/webview-smoke"
            options={{
              headerTitle: "WebView Smoke",
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </voidhash.Provider>
      <StatusBar style="auto" />
    </>
  );
}
