import { Data, Effect } from "effect";

import { initializeSdk } from "./initialize-sdk";

export class AppStoreGeneralError extends Data.TaggedError(
  "AppStoreGeneralError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class AppStoreServerAPIService extends Effect.Service<AppStoreServerAPIService>()(
  "AppStoreServerAPIService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        initializeSdk: yield* initializeSdk,
      };
    }),
  }
) {}

export type { TransactionInfoResult } from "./initialize-sdk";
