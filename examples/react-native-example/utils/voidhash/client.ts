import { createVoidhashClient } from "@voidhash/react-native";

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
		...(process.env.EXPO_PUBLIC_VOIDHASH_API_URL
			? { baseUrl: process.env.EXPO_PUBLIC_VOIDHASH_API_URL }
			: {}),
	},
);
