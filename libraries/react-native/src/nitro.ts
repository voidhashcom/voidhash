import { Platform, TurboModuleRegistry } from "react-native";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

import type { VoidhashNativeClient as VoidhashNativeClientSpec } from "./specs/VoidhashNativeClient.nitro";

// The bundler's `require`. `react-native-nitro-modules` is loaded with it,
// inside the guarded creation below, instead of imported: the package installs
// its native core while it is evaluated and throws when the binary has none,
// which as an import would fail the whole bundle at launch. It is loaded only
// once that core is known to be there: Metro reports a module that throws
// while it loads as a fatal error itself, before the throw reaches a `catch`
// around the `require`.
declare const require: (id: string) => unknown;

type NitroModules = Pick<typeof import("react-native-nitro-modules"), "NitroModules">;

const isNitroModules = (value: unknown): value is NitroModules =>
  P.hasProperty(value, "NitroModules") &&
  P.hasProperty(value.NitroModules, "createHybridObject") &&
  P.isFunction(value.NitroModules.createHybridObject);

/**
 * A new native client, one per `VoidhashClient`: it holds a client's state,
 * so it is never shared. Nothing native is loaded or created while the SDK is
 * imported, and nothing at all on a platform other than iOS and Android. A
 * creation that throws (an installed binary without Nitro or without this
 * package's native module: Expo Go, or an over-the-air JavaScript update onto
 * a build made before the package had one) yields `None`, so the client fails
 * `init()` with a coded error instead of the whole bundle failing to load.
 *
 * An over-the-air update onto a build whose native module implements another
 * version of its contract creates one here as usual: `init()` then refuses to
 * start it (`NATIVE_CONTRACT_VERSION`), as its answers would be misread.
 */
export const createVoidhashNativeClient = (): Option.Option<VoidhashNativeClientSpec> =>
  Platform.OS === "ios" || Platform.OS === "android"
    ? Option.flatten(
        Result.getSuccess(
          Result.try(() => {
            if (TurboModuleRegistry.get("NitroModules") === null) return Option.none();
            const nitro = require("react-native-nitro-modules");
            return isNitroModules(nitro)
              ? Option.some(
                  nitro.NitroModules.createHybridObject<VoidhashNativeClientSpec>(
                    "VoidhashNativeClient",
                  ),
                )
              : Option.none();
          }),
        ),
      )
    : Option.none();
