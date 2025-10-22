import { PerkService } from '@voidhash/core/services';
import { PerkRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const PerkRpcsLive = PerkRpcsDef.toLayer(
  Effect.gen(function* () {
    const perkService = yield* PerkService;
    return {
      ListPerks: ({ projectId }) =>
        Effect.gen(function* () {
          return yield* perkService.getPerks(projectId);
        }),
      CreatePerk: (input) => perkService.createPerk(input),
      DeletePerk: (input) => perkService.deletePerk(input)
    };
  })
).pipe(Layer.provide(PerkService.Default));
