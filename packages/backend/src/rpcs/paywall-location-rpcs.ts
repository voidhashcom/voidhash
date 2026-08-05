import { PaywallLocationService } from "@voidhash/core/services";
import {
  PaywallLocationRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallLocationNotFoundError,
  RpcPaywallLocationServiceError,
  RpcPaywallLocationShowingValidationError,
  RpcPaywallLocationSlugAlreadyExistsError,
  RpcPaywallNotFoundError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaywallLocationRpcsLive = PaywallLocationRpcsDef.toLayer(
  Effect.gen(function* PaywallLocationRpcsLive() {
    const service = yield* PaywallLocationService;

    return {
      ArchivePaywallLocation: ({ locationId }) =>
        service.archiveLocation({ locationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationNotFoundError: (error) =>
              Effect.fail(new RpcPaywallLocationNotFoundError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
      AssignPaywallLocationShowing: (input) =>
        service.assignLocationShowing(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationNotFoundError: (error) =>
              Effect.fail(new RpcPaywallLocationNotFoundError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
            PaywallLocationShowingValidationError: (error) =>
              Effect.fail(new RpcPaywallLocationShowingValidationError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
          }),
        ),
      ClearPaywallLocationShowing: ({ locationId }) =>
        service.clearLocationShowing({ locationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationNotFoundError: (error) =>
              Effect.fail(new RpcPaywallLocationNotFoundError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
      CreatePaywallLocation: (input) =>
        service.createLocation(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
            PaywallLocationSlugAlreadyExistsError: (error) =>
              Effect.fail(new RpcPaywallLocationSlugAlreadyExistsError({ slug: error.slug })),
          }),
        ),
      ListPaywallLocations: (input) =>
        service.listLocations(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
      ListPaywallLocationShowings: ({ locationId }) =>
        service.listLocationShowings({ locationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationNotFoundError: (error) =>
              Effect.fail(new RpcPaywallLocationNotFoundError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
      UpdatePaywallLocation: (input) =>
        service.updateLocation(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationNotFoundError: (error) =>
              Effect.fail(new RpcPaywallLocationNotFoundError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
