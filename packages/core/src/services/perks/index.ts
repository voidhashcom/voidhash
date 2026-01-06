import { Effect } from 'effect';
import { createPerk } from './create-perk';
import { deletePerk } from './delete-perk';
import { getPerkById } from './get-perk-by-id';
import { getPerks } from './get-perks';

export class PerkService extends Effect.Service<PerkService>()('PerkService', {
  dependencies: [],
  effect: Effect.gen(function* () {
    return {
      createPerk: yield* createPerk,
      getPerks: yield* getPerks,
      getPerkById: yield* getPerkById,
      deletePerk: yield* deletePerk
    } as const;
  })
}) {}
