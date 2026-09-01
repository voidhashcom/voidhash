import { PerkService } from "@voidhash/core/services";
import {
  PerkRpcsDef,
  RpcActionForbiddenError,
  RpcPerkNotFoundError,
  RpcPerkServiceError,
  RpcPerkSlugAlreadyExistsError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";

export const PerkRpcsLive = PerkRpcsDef.toLayer(
  Effect.gen(function* PerkRpcsLive() {
    const perkService = yield* PerkService;
    return {
      CreatePerk: (input) =>
        perkService.createPerk(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PerkServiceError: (error) =>
              Effect.fail(new RpcPerkServiceError({ cause: error.cause })),
            PerkSlugAlreadyExistsError: (error) =>
              Effect.fail(new RpcPerkSlugAlreadyExistsError({ slug: error.slug })),
          }),
        ),
      DeletePerk: (input) =>
        perkService.deletePerk(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PerkNotFoundError: (error) =>
              Effect.fail(new RpcPerkNotFoundError({ message: error.message })),
            PerkServiceError: (error) =>
              Effect.fail(new RpcPerkServiceError({ cause: error.cause })),
          }),
        ),
      ListPerks: ({ projectId }) =>
        perkService.getPerks(projectId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PerkServiceError: (error) =>
              Effect.fail(new RpcPerkServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
