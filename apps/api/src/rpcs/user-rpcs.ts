import { UserService } from '@voidhash/core/services';
import { UserRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const UserRpcsLive = UserRpcsDef.toLayer(
  Effect.gen(function* () {
    const userService = yield* UserService;
    return {
      CurrentUser: () => userService.getUser()
    };
  })
).pipe(
  // Provide the UserRepository layer
  Layer.provide(UserService.Default)
);
