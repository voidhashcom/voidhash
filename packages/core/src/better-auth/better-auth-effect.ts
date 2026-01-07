import { Db } from "@voidhash/db/effect";
import { APIError } from "better-auth";
import { Data, Effect } from "effect";

import { createBetterAuth } from "./auth";

export class BetterAuthError extends Data.TaggedError("BetterAuthError")<{
  readonly status: APIError["status"] | "INTERNAL_SERVER_ERROR";
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class BetterAuth extends Effect.Service<BetterAuth>()("app/BetterAuth", {
  dependencies: [Db.Default],
  effect: Effect.gen(function* effect() {
    const dbService = yield* Db;
    const auth = yield* dbService.use(async (db) => createBetterAuth(db));
    return {
      use: <A>(fn: (client: typeof auth) => Promise<A>) =>
        Effect.tryPromise({
          catch: (error) =>
            new BetterAuthError({
              cause: error,
              message: "Failed to use better-auth",
              status:
                error instanceof APIError
                  ? error.status
                  : "INTERNAL_SERVER_ERROR",
            }),
          try: () => fn(auth),
        }),
    };
  }),
}) {}
