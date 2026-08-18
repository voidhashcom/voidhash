import { createVoidhashClient } from "@voidhash/react-native";
import { Effect } from "effect";
import Constants from "expo-constants";

const LOCALHOST_NAMES = new Set(["0.0.0.0", "127.0.0.1", "::1", "[::1]", "localhost"]);

const isLocalhost = (hostname: string) => LOCALHOST_NAMES.has(hostname.toLowerCase());

/** Parses a URL, returning `null` instead of throwing on malformed input. */
const parseUrl = (input: string): URL | null =>
  Effect.runSync(Effect.try(() => new URL(input)).pipe(Effect.orElseSucceed(() => null)));

const withProtocol = (hostUri: string) => {
  if (hostUri.includes("://")) return hostUri;
  return `http://${hostUri}`;
};

const parseHostUriHostname = (hostUri: string | null | undefined) => {
  if (!hostUri) return null;

  const url = parseUrl(withProtocol(hostUri));
  if (!url) return null;

  return url.hostname || null;
};

const resolveExampleApiUrl = (baseUrl: string) => {
  const url = parseUrl(baseUrl);
  if (!url) return baseUrl;

  if (!isLocalhost(url.hostname)) return baseUrl;

  const hostHostname = parseHostUriHostname(
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost,
  );
  if (!hostHostname || isLocalhost(hostHostname)) return baseUrl;

  url.hostname = hostHostname;
  return url.toString();
};

// `process.env.EXPO_PUBLIC_*` must stay a literal member expression: Expo's Babel
// plugin inlines it at build time, so it cannot be read through Effect's Config.
const configuredApiUrl = process.env.EXPO_PUBLIC_VOIDHASH_API_URL;
const devEnabled = process.env.EXPO_PUBLIC_VOIDHASH_DEV !== "false";

const resolveConfiguredApiUrl = () => {
  if (!configuredApiUrl) return undefined;
  return resolveExampleApiUrl(configuredApiUrl);
};

const apiUrl = resolveConfiguredApiUrl();

const baseUrlOption = (): { baseUrl?: string } => {
  if (!apiUrl) return {};
  return { baseUrl: apiUrl };
};

/**
 * Voidhash client for the example app.
 *
 * Schema lives on the server now — run `voidhash-cli types generate` to refresh
 * the local `voidhash.gen.d.ts` whenever the dashboard schema changes.
 */
export const voidhash = createVoidhashClient("vh_pk_QrGDcbcCbCcWHjOouLZipyEBoBrDKoAb", {
  debug: true,
  dev: devEnabled,
  ...baseUrlOption(),
});
