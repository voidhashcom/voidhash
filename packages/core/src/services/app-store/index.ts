import { Effect } from "effect";

import { validateTransaction } from "./validate-transaction";

export class AppStoreService extends Effect.Service<AppStoreService>()(
  "AppStoreService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        validateTransaction: yield* validateTransaction,
      } as const;
    }),
  }
) {}
