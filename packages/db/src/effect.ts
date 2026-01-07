import { Cause, Context, Data, Effect, Exit, Option, Runtime } from "effect";

import type { Transaction } from ".";
import { createDb, type db } from ".";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

type TransactionContextShape = <U>(
  fn: (client: Transaction) => Promise<U>
) => Effect.Effect<U, DatabaseError>;
export class TransactionContext extends Context.Tag("TransactionContext")<
  TransactionContext,
  TransactionContextShape
>() {
  static readonly provide = (
    transaction: TransactionContextShape
  ): (<A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, TransactionContext>>) =>
    Effect.provideService(this, transaction);
}

type Client = typeof db;

export class Db extends Effect.Service<Db>()("app/Db", {
  dependencies: [],
  scoped: Effect.gen(function* scoped() {
    const { mysql, drizzle: db } = createDb();
    yield* Effect.addFinalizer(() => Effect.promise(() => mysql.end()));

    const use = Effect.fn(<T>(fn: (client: Client) => Promise<T>) =>
      Effect.tryPromise({
        catch: (cause) =>
          new DatabaseError({
            cause,
            message: "Failed to execute transaction",
          }),
        try: () => fn(db),
      })
    );

    const transaction = Effect.fn("Database.transaction")(
      <T, E, R>(
        txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>
      ) =>
        Effect.runtime<R>().pipe(
          Effect.map((runtime) => Runtime.runPromiseExit(runtime)),
          Effect.flatMap((runPromiseExit) =>
            Effect.async<T, DatabaseError | E, R>((resume) => {
              db.transaction(async (tx: Transaction) => {
                // biome-ignore lint/suspicious/noExplicitAny: transaction wrapper
                const txWrapper = (fn: (client: Transaction) => Promise<any>) =>
                  Effect.tryPromise({
                    catch: (cause) =>
                      new DatabaseError({
                        cause,
                        message: "Failed to execute transaction",
                      }),
                    try: () => fn(tx),
                  });

                const result = await runPromiseExit(txExecute(txWrapper));
                Exit.match(result, {
                  onFailure: (cause) => {
                    if (Cause.isFailType(cause)) {
                      resume(Effect.fail(cause.error));
                    } else {
                      resume(Effect.die(cause));
                    }
                  },
                  onSuccess: (value) => {
                    resume(Effect.succeed(value));
                  },
                });
              }).catch((error) => {
                resume(
                  Effect.fail(
                    new DatabaseError({
                      cause: error,
                      message: "Failed to execute transaction",
                    })
                  )
                );
              });
            })
          )
        )
    );

    type ExecuteFn = <T>(
      fn: (client: Client | Transaction) => Promise<T>
    ) => Effect.Effect<T, DatabaseError>;
    const makeQuery =
      <A, E, R, Input = never>(
        queryFn: (execute: ExecuteFn, input: Input) => Effect.Effect<A, E, R>
      ) =>
      (
        ...args: [Input] extends [never] ? [] : [input: Input]
      ): Effect.Effect<A, E, R> => {
        const input = args[0] as Input;
        return Effect.serviceOption(TransactionContext).pipe(
          Effect.map(Option.getOrNull),
          Effect.flatMap((txOrNull) => queryFn(txOrNull ?? use, input))
        );
      };

    return {
      makeQuery,
      transaction,
      use,
    };
  }),
}) {}
