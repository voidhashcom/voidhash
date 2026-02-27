import { createVoidhashClient } from "@voidhash/react-native";
import Constants from "expo-constants";

import * as schema from "./_schema";

const debuggerHost =
	(
		Constants.expoConfig as {
			debuggerHost?: string;
			hostUri?: string;
		} | null
	)?.debuggerHost ??
	(
		Constants.expoConfig as {
			debuggerHost?: string;
			hostUri?: string;
		} | null
	)?.hostUri ??
	(
		Constants.manifest2 as {
			extra?: {
				expoGo?: {
					debuggerHost?: string;
				};
			};
		} | null
	)?.extra?.expoGo?.debuggerHost;
const localhost = debuggerHost?.split(":")[0];
const useLocalApiFromEnv =
	process.env.EXPO_PUBLIC_VOIDHASH_USE_LOCAL_API === "1" ||
	process.env.EXPO_PUBLIC_VOIDHASH_USE_LOCAL_API === "true";
const defaultToLocalApiInDev =
	__DEV__ &&
	process.env.EXPO_PUBLIC_VOIDHASH_USE_LOCAL_API == null &&
	process.env.EXPO_PUBLIC_VOIDHASH_API_URL == null;
const useLocalApi = useLocalApiFromEnv || defaultToLocalApiInDev;
const inferredLocalBaseUrl = localhost
	? `http://${localhost}:5001`
	: "http://localhost:5001";

const baseUrl =
	process.env.EXPO_PUBLIC_VOIDHASH_API_URL ??
	(useLocalApi ? inferredLocalBaseUrl : undefined);

if (__DEV__) {
	console.log(
		`[voidhash-example] Resolved API URL: ${baseUrl ?? "https://api.voidhash.com"}`
	);
}

// Defaults to local API in development and Voidhash cloud API in production.
// Set EXPO_PUBLIC_VOIDHASH_API_URL to explicitly override base URL.
// Set EXPO_PUBLIC_VOIDHASH_USE_LOCAL_API=1/true to force inferred local URL.
const clientOptions = {
	debug: true,
	...(baseUrl ? { baseUrl } : {}),
};
const publishableKey = "vh_pk_PWIsDyqMEOOuHpmAsFQvwaFhGKBVlkHf";

export const voidhash = createVoidhashClient(
	publishableKey,
	schema,
	clientOptions,
);
