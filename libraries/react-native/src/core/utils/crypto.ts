import * as Option from "effect/Option";
import { NitroModules } from "react-native-nitro-modules";

import type { VoidhashPlatform } from "../../specs/VoidhashPlatform.nitro";

let platform = Option.none<VoidhashPlatform>();

/** Generates a secure UUID v4 natively, without requiring a Web Crypto polyfill. */
export const getNonce = (): string => {
  const native = Option.getOrElse(platform, () => {
    const hybrid = NitroModules.createHybridObject<VoidhashPlatform>("VoidhashPlatform");
    platform = Option.some(hybrid);
    return hybrid;
  });
  return native.randomUUID();
};
