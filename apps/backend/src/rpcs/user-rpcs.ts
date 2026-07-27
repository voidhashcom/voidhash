import { UserService } from "@voidhash/core/services";
import {
  RpcAuthenticationError,
  RpcAvatarValidationError,
  RpcUserServiceError,
  UserRpcsDef,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const UserRpcsLive = UserRpcsDef.toLayer(
  Effect.gen(function* UserRpcsLive() {
    const userService = yield* UserService;
    return {
      CurrentUser: () =>
        userService.getUser().pipe(
          Effect.catchTags({
            AuthenticationError: (error) =>
              Effect.fail(
                new RpcAuthenticationError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),
      RemoveUserAvatar: () =>
        userService.removeAvatar().pipe(
          Effect.catchTags({
            AuthenticationError: (error) =>
              Effect.fail(
                new RpcAuthenticationError({ cause: error.cause, message: error.message }),
              ),
            UserServiceError: (error) =>
              Effect.fail(new RpcUserServiceError({ cause: error.cause })),
          }),
        ),
      SetUserAvatar: ({ contentType, imageBase64 }) =>
        userService.setAvatar({ contentType, imageBase64 }).pipe(
          Effect.catchTags({
            AuthenticationError: (error) =>
              Effect.fail(
                new RpcAuthenticationError({ cause: error.cause, message: error.message }),
              ),
            AvatarValidationError: (error) =>
              Effect.fail(new RpcAvatarValidationError({ message: error.message })),
            UserServiceError: (error) =>
              Effect.fail(new RpcUserServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
