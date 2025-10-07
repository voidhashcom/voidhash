import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { PerkService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { AuthSession } from '@voidhash/shared';
import { Effect } from 'effect';

export const PerksGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'perks',
  (handlers) =>
    Effect.gen(function* () {
      const perkService = yield* PerkService;
      return handlers.handle('listPerks', () =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* perkService.getPerks(projectId);
        })
      );
    })
);
