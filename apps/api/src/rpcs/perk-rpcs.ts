import { PerkService } from "@voidhash/core/services";
import { PerkRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const PerkRpcsLive = PerkRpcsDef.toLayer(
  Effect.gen(function* PerkRpcsLive() {
    const perkService = yield* PerkService;
    return {
      CreatePerk: (input) => perkService.createPerk(input),
      DeletePerk: (input) => perkService.deletePerk(input),
      ListPerks: ({ projectId }) =>
        Effect.gen(function* ListPerks() {
          return yield* perkService.getPerks(projectId);
        }),
    };
  })
).pipe(Layer.provide(PerkService.Default));
