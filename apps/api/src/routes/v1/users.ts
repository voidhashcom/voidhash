import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { UserService } from '@voidhash/core/services';
import { Effect } from 'effect';

export const UsersGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'users',
  (handlers) =>
    Effect.gen(function* () {
      const userService = yield* UserService;
      return handlers.handle('getUser', () =>
        Effect.gen(function* () {
          return yield* userService.getUser();
        })
      );
    })
);
