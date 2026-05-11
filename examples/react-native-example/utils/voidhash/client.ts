import { createVoidhashClient } from "@voidhash/react-native";
import Constants from "expo-constants";

const LOCALHOST_NAMES = new Set([
	"0.0.0.0",
	"127.0.0.1",
	"::1",
	"[::1]",
	"localhost",
]);

const isLocalhost = (hostname: string) =>
	LOCALHOST_NAMES.has(hostname.toLowerCase());

const parseHostUriHostname = (hostUri: string | null | undefined) => {
	if (!hostUri) return null;

	try {
		const url = hostUri.includes("://")
			? new URL(hostUri)
			: new URL(`http://${hostUri}`);
		return url.hostname || null;
	} catch {
		return null;
	}
};

const resolveExampleApiUrl = (baseUrl: string) => {
	let url: URL;
	try {
		url = new URL(baseUrl);
	} catch {
		return baseUrl;
	}

	if (!isLocalhost(url.hostname)) return baseUrl;

	const hostHostname = parseHostUriHostname(
		Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost,
	);
	if (!hostHostname || isLocalhost(hostHostname)) return baseUrl;

	url.hostname = hostHostname;
	return url.toString();
};

const apiUrl = process.env.EXPO_PUBLIC_VOIDHASH_API_URL
	? resolveExampleApiUrl(process.env.EXPO_PUBLIC_VOIDHASH_API_URL)
	: undefined;

/**
 * Voidhash client for the example app.
 *
 * Schema lives on the server now — run `voidhash-cli types generate` to refresh
 * the local `voidhash.gen.d.ts` whenever the dashboard schema changes.
 */
export const voidhash = createVoidhashClient(
	process.env.EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY ??
		"vh_pk_hrvyOZJoxtonGGPtTnkMehrCoEPsAbwD",
	{
		debug: true,
		...(apiUrl ? { baseUrl: apiUrl } : {}),
	},
);
