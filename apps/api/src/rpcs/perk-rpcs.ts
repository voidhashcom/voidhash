import { PerkService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { PerkRpcsDef } from '@voidhash/rpc';
import { AuthSession } from '@voidhash/shared';
import { Effect, Layer } from 'effect';

export const PerkRpcsLive = PerkRpcsDef.toLayer(
  Effect.gen(function* () {
    const perkService = yield* PerkService;
    return {
      ListPerks: () =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* perkService.getPerks(projectId);
        })
    };
  })
).pipe(Layer.provide(PerkService.Default));
