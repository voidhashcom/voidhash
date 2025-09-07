import { Stack } from 'expo-router';
import 'react-native-reanimated';
import 'fast-text-encoding';
import '../global.css';

import { StatusBar } from 'expo-status-bar';
import { voidhash } from 'utils/voidhash/client';

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
              headerTransparent: true,
              headerTintColor: '#FFF',
              headerTitle: 'Products'
            }}
          />
          <Stack.Screen
            name="menu/customer"
            options={{
              headerTransparent: true,
              headerTintColor: '#FFF',
              headerTitle: 'Customer'
            }}
          />
          <Stack.Screen
            name="menu/sign-in"
            options={{
              headerTransparent: true,
              headerTintColor: '#FFF',
              headerTitle: 'Sign in'
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </voidhash.Provider>
      <StatusBar style="auto" />
    </>
  );
}
