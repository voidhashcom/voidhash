import { createVoidhashClient } from "@voidhash/react-native";
import Constants from "expo-constants";

import * as schema from "./schema";

const debuggerHost =
  // @ts-expect-error - TODO: fix this
  Constants.expoConfig?.debuggerHost ??
  Constants.manifest2?.extra?.expoGo?.debuggerHost;
const localhost = debuggerHost?.split(":")[0];

const baseUrl = `http://${localhost}:3000/api`;

export const voidhash = createVoidhashClient(
  "vh_pk_jlnppipPRGhqHVnEGnBFgknpAEMnPQiF",
  schema,
  {
    baseUrl,
    debug: true,
  }
);
