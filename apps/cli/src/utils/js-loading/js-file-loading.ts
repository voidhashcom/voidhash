// Inspired by https://github.dev/drizzle-team/drizzle-orm

import { Data, Effect } from 'effect';

export class FailedToLoadJsFileError extends Data.TaggedError(
  'FailedToLoadJsFileError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const assertES5 = ({ unregister }: { unregister: () => void }) =>
  Effect.try({
    try: () => require('./_es5.ts'),
    // biome-ignore lint/suspicious/noExplicitAny: yolo
    catch: (e: any) => {
      unregister();
      if ('errors' in e && Array.isArray(e.errors) && e.errors.length > 0) {
        const es5Error =
          // biome-ignore lint/suspicious/noExplicitAny: yolo
          (e.errors as any[]).filter((it) =>
            it.text?.includes(`("es5") is not supported yet`)
          ).length > 0;
        if (es5Error) {
          return new FailedToLoadJsFileError({
            message: 'An error occurred while trying to load .js/ts file.',
            cause: e
          });
        }
      }

      return new FailedToLoadJsFileError({
        message: 'An error occurred while loading the source code',
        cause: e
      });
    }
  });

export const safeRegister = () =>
  Effect.gen(function* () {
    const { register } = yield* Effect.tryPromise({
      try: () => import('esbuild-register/dist/node'),
      catch: (e) => {
        return new FailedToLoadJsFileError({
          message: 'An error occurred while trying to load .js/ts file.',
          cause: e
        });
      }
    });
    const res: { unregister: () => void } = yield* Effect.try({
      try: () =>
        register({
          format: 'cjs',
          loader: 'ts'
        }),
      catch: (e) => {
        return new FailedToLoadJsFileError({
          message: 'An error occurred while trying to load .js/ts file.',
          cause: e
        });
      }
    }).pipe(
      Effect.orElse(() =>
        Effect.succeed({
          // biome-ignore lint/suspicious/noEmptyBlockStatements: it is on purpose an empty function. It is here instead of try-catch due to tsx.
          unregister(): void {}
        })
      )
    );

    yield* assertES5(res);
    return res;
  });
