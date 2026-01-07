import { Effect } from "effect";

import { createPerk } from "./create-perk";
import { deletePerk } from "./delete-perk";
import { getPerkById } from "./get-perk-by-id";
import { getPerks } from "./get-perks";
import { updatePerk } from "./update-perk";

export class PerkService extends Effect.Service<PerkService>()("PerkService", {
  dependencies: [],
  effect: Effect.gen(function* effect() {
    return {
      createPerk: yield* createPerk,
      deletePerk: yield* deletePerk,
      getPerkById: yield* getPerkById,
      getPerks: yield* getPerks,
      updatePerk: yield* updatePerk,
    } as const;
  }),
}) {}
