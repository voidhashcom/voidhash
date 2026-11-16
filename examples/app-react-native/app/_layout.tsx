// `@noble/hashes`, used by the SDK, needs a global TextEncoder that Hermes
// does not ship. The polyfill must be imported before anything touches it.
import "fast-text-encoding";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { VoidhashGate } from "../components/voidhash-gate";
import { voidhash } from "../lib/voidhash";

export default function RootLayout() {
  return (
    <voidhash.Provider>
      <VoidhashGate>
        <Stack screenOptions={{ headerShown: false }} />
      </VoidhashGate>
      <StatusBar style="auto" />
    </voidhash.Provider>
  );
}
