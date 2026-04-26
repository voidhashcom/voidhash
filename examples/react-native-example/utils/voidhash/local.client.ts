import { createVoidhashClient } from "@voidhash/react-native";
import Constants from "expo-constants";

import * as schema from "./_schema";

function resolveHostIp() {
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

	return debuggerHost?.split(":")[0];
}

const baseUrl = process.env.EXPO_PUBLIC_VOIDHASH_API_URL?.replace(
	"localhost",
	resolveHostIp() ?? "localhost",
);

const clientOptions = {
	debug: true,
	...(baseUrl ? { baseUrl } : {}),
};
const publishableKey =
	process.env.EXPO_PUBLIC_VOIDHASH_PUBLISHABLE_KEY ??
	"vh_pk_hrvyOZJoxtonGGPtTnkMehrCoEPsAbwD";

console.log(baseUrl, publishableKey);

export const voidhash = createVoidhashClient(
	publishableKey,
	schema,
	clientOptions,
);
