import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { NitroModules } from "react-native-nitro-modules";

import type { NativePlatformInfo, VoidhashPlatform } from "../../specs/VoidhashPlatform.nitro";

/** The `VoidhashPlatform` hybrid could not be created: the installed binary predates this package version. */
export class NativePlatformUnavailableError extends Schema.TaggedErrorClass<NativePlatformUnavailableError>()(
  "NativePlatformUnavailableError",
  { cause: Schema.Unknown, message: Schema.String },
) {}

let nativePlatformInfo = Option.none<NativePlatformInfo>();

/**
 * Reads the host app and device metadata through the `VoidhashPlatform`
 * hybrid. The values never change while the process lives, so a successful
 * read is memoized.
 */
export const getNativePlatformInfo = (): Result.Result<
  NativePlatformInfo,
  NativePlatformUnavailableError
> => {
  if (Option.isSome(nativePlatformInfo)) return Result.succeed(nativePlatformInfo.value);
  const info = Result.try({
    catch: (cause) =>
      new NativePlatformUnavailableError({
        cause,
        message:
          "PLATFORM_UNAVAILABLE: the VoidhashPlatform native module is missing. Rebuild the app after installing @voidhash/react-native.",
      }),
    try: () => NitroModules.createHybridObject<VoidhashPlatform>("VoidhashPlatform").getInfo(),
  });
  if (Result.isSuccess(info)) nativePlatformInfo = Option.some(info.success);
  return info;
};

/** {@link getNativePlatformInfo} as an Effect. */
export const readNativePlatformInfo = Effect.suspend(() => {
  const info = getNativePlatformInfo();
  return Result.isSuccess(info) ? Effect.succeed(info.success) : Effect.fail(info.failure);
});

/**
 * The deep-link scheme the client rides purchase callbacks on: the explicit
 * option when given, otherwise the first URL scheme the native app registers.
 */
export const resolveScheme = (
  explicitScheme: Option.Option<string>,
  info: Result.Result<NativePlatformInfo, NativePlatformUnavailableError>,
): Option.Option<string> =>
  Option.orElse(explicitScheme, () =>
    Option.flatMap(Result.getSuccess(info), (platform) => Arr.head(platform.urlSchemes)),
  );
