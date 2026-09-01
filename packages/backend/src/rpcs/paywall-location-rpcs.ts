import {
  PaywallLocationService,
  type PaywallLocationShowingView,
  type PaywallLocationWithActiveShowing,
} from "@voidhash/core/services";
import {
  PaywallLocationRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallLocationNotFoundError,
  RpcPaywallLocationServiceError,
  RpcPaywallLocationShowingValidationError,
  RpcPaywallLocationSlugAlreadyExistsError,
  RpcPaywallNotFoundError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/** Encodes the internal showing Option model for the nullable RPC schema. */
const toRpcShowing = (showing: PaywallLocationShowingView) => ({
  createdAt: Option.getOrNull(showing.createdAt),
  createdByUserId: Option.getOrNull(showing.createdByUserId),
  endedAt: Option.getOrNull(showing.endedAt),
  featureFlagId: Option.getOrNull(showing.featureFlagId),
  id: showing.id,
  paywall: Option.getOrNull(showing.paywall),
  paywallId: Option.getOrNull(showing.paywallId),
  paywallLocationId: showing.paywallLocationId,
  paywallRelease: Option.getOrNull(
    Option.map(showing.paywallRelease, (release) => ({
      htmlUrl: release.htmlUrl,
      publishedAt: Option.getOrNull(release.publishedAt),
      releaseId: release.releaseId,
      version: release.version,
    })),
  ),
  paywallReleaseId: Option.getOrNull(showing.paywallReleaseId),
  projectId: showing.projectId,
  startedAt: showing.startedAt,
  type: showing.type,
  updatedAt: Option.getOrNull(showing.updatedAt),
});

/** Encodes the internal location Option model for the nullable RPC schema. */
const toRpcLocation = (location: PaywallLocationWithActiveShowing) => ({
  activeShowing: Option.getOrNull(Option.map(location.activeShowing, toRpcShowing)),
  archivedAt: Option.getOrNull(location.archivedAt),
  createdAt: Option.getOrNull(location.createdAt),
  description: Option.getOrNull(location.description),
  id: location.id,
  name: location.name,
  projectId: location.projectId,
  slug: location.slug,
  updatedAt: Option.getOrNull(location.updatedAt),
});

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
        service
          .createLocation({ ...input, description: Option.fromNullishOr(input.description) })
          .pipe(
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
          Effect.map((locations) => locations.map(toRpcLocation)),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallLocationServiceError: (error) =>
              Effect.fail(new RpcPaywallLocationServiceError({ cause: error.cause })),
          }),
        ),
      ListPaywallLocationShowings: ({ locationId }) =>
        service.listLocationShowings({ locationId }).pipe(
          Effect.map((showings) => showings.map(toRpcShowing)),
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
        service
          .updateLocation({
            ...input,
            description:
              input.description === undefined ? undefined : Option.fromNullishOr(input.description),
          })
          .pipe(
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
