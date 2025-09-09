// Inspired by https://github.dev/drizzle-team/drizzle-orm

import { HelpDoc, ValidationError } from '@effect/cli';
import { Effect } from 'effect';

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
          return ValidationError.invalidValue(
            HelpDoc.p(
              `Please change compilerOptions.target from 'es5' to 'es6' or above in your tsconfig.json`
            )
          );
        }
      }

      return ValidationError.invalidValue(
        HelpDoc.p('An error occurred while loading the source code')
      );
    }
  });

export const safeRegister = () =>
  Effect.gen(function* () {
    const { register } = yield* Effect.tryPromise({
      try: () => import('esbuild-register/dist/node'),
      catch: () => {
        return ValidationError.invalidValue(
          HelpDoc.p('An error occurred while trying to load .js/ts file.')
        );
      }
    });
    const res: { unregister: () => void } = yield* Effect.try({
      try: () =>
        register({
          format: 'cjs',
          loader: 'ts'
        }),
      catch: () => {
        return Effect.fail('Error');
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
