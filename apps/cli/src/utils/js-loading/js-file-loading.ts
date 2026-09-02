// Inspired by https://github.dev/drizzle-team/drizzle-orm

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";

export class FailedToLoadJsFileError extends Schema.TaggedErrorClass<FailedToLoadJsFileError>(
  "FailedToLoadJsFileError",
)("FailedToLoadJsFileError", { message: Schema.String, cause: Schema.optional(Schema.Unknown) }) {}

/**
 * Lazily loads the tiny TypeScript probe used to detect an esbuild-register
 * setup that cannot compile to es5.
 */
const loadEs5Probe = () => import("./_es5");

/** Lazily loads esbuild-register, which patches require() to compile TS. */
const loadEsbuildRegister = () => import("esbuild-register/dist/node");

const assertES5 = ({ unregister }: { unregister: () => void }) =>
  Effect.tryPromise({
    try: loadEs5Probe,
    catch: (e: any) => {
      unregister();
      if ("errors" in e && Array.isArray(e.errors) && Arr.isReadonlyArrayNonEmpty(e.errors)) {
        const es5Error = e.errors.some((it: any) =>
          it.text?.includes(`("es5") is not supported yet`),
        );
        if (es5Error) {
          return new FailedToLoadJsFileError({
            cause: e,
            message: "An error occurred while trying to load .js/ts file.",
          });
        }
      }

      return new FailedToLoadJsFileError({
        cause: e,
        message: "An error occurred while loading the source code",
      });
    },
  });

export const safeRegister = () =>
  Effect.gen(function* safeRegister() {
    const { register } = yield* Effect.tryPromise({
      catch: (e) =>
        new FailedToLoadJsFileError({
          cause: e,
          message: "An error occurred while trying to load .js/ts file.",
        }),
      try: loadEsbuildRegister,
    });
    const res: { unregister: () => void } = yield* Effect.try({
      catch: (e) =>
        new FailedToLoadJsFileError({
          cause: e,
          message: "An error occurred while trying to load .js/ts file.",
        }),
      try: () =>
        register({
          format: "cjs",
          loader: "ts",
        }),
    }).pipe(
      Effect.catchTag("FailedToLoadJsFileError", () =>
        Effect.succeed({
          // it is on purpose an empty function. It is here instead of try-catch due to tsx.
          unregister(): void {},
        }),
      ),
    );

    yield* assertES5(res);
    return res;
  });
