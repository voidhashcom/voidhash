import { Effect } from "effect";

import { syncUnlockedPerks } from "./sync-unlocked-perks";

export class PerkGrantService extends Effect.Service<PerkGrantService>()(
  "PerkGrantService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        syncUnlockedPerks: yield* syncUnlockedPerks,
      } as const;
    }),
  }
) {}
