import { createVoidhashClient } from "@voidhash/react-native";
import Constants from "expo-constants";

import * as schema from "./_schema";

const debuggerHost =
	(Constants.expoConfig as { debuggerHost?: string } | null)?.debuggerHost ??
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

const baseUrl =
	process.env.EXPO_PUBLIC_VOIDHASH_API_URL ??
	(localhost ? `http://${localhost}:5001` : "http://localhost:5001");

export const voidhash = createVoidhashClient(
	"vh_pk_jlnppipPRGhqHVnEGnBFgknpAEMnPQiF",
	schema,
	{
		baseUrl,
		debug: true,
	},
);
