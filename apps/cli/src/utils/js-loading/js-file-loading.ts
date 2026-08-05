// Inspired by https://github.dev/drizzle-team/drizzle-orm

import { Data, Effect } from "effect";

export class FailedToLoadJsFileError extends Data.TaggedError("FailedToLoadJsFileError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const assertES5 = ({ unregister }: { unregister: () => void }) =>
  Effect.try({
    try: () => require("./_es5.ts"),
    catch: (e: any) => {
      unregister();
      if ("errors" in e && Array.isArray(e.errors) && e.errors.length > 0) {
        const es5Error = (e.errors as any[]).some((it) =>
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
      try: () => import("esbuild-register/dist/node"),
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
      Effect.catch(() =>
        Effect.succeed({
          // it is on purpose an empty function. It is here instead of try-catch due to tsx.
          unregister(): void {},
        }),
      ),
    );

    yield* assertES5(res);
    return res;
  });
