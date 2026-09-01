import {
  createdResponse,
  PaywallLocation,
  PaywallLocationShowing,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaywallLocationNotFoundError,
  ApiPaywallLocationServiceError,
  ApiPaywallLocationShowingValidationError,
  ApiPaywallLocationSlugAlreadyExistsError,
  ApiPaywallNotFoundError,
} from "@voidhash/api-contracts/errors";
import {
  PaywallLocationService,
  type PaywallLocationShowingView,
  type PaywallLocationWithActiveShowing,
} from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

/** Projects a stored location row onto the public resource shape. */
const toLocation = (row: PaywallLocationWithActiveShowing) =>
  new PaywallLocation({
    description: Option.getOrNull(row.description),
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    slug: row.slug,
  });

/**
 * Projects the showing view's release block onto the public shape, preserving
 * its absence.
 */
const toShowingRelease = (release: PaywallLocationShowingView["paywallRelease"]) => {
  if (Option.isNone(release)) return null;

  return {
    htmlUrl: release.value.htmlUrl,
    publishedAt: Option.getOrNull(release.value.publishedAt),
    releaseId: release.value.releaseId,
    version: release.value.version,
  };
};

/**
 * Projects a showing view onto the public resource shape. The release's
 * `runtime` block is deliberately dropped: it is SDK serving detail, exposed
 * through `/sdk/*`, not management metadata.
 */
const toShowing = (view: PaywallLocationShowingView) =>
  new PaywallLocationShowing({
    createdAt: Option.getOrNull(view.createdAt),
    createdByUserId: Option.getOrNull(view.createdByUserId),
    endedAt: Option.getOrNull(view.endedAt),
    featureFlagId: Option.getOrNull(view.featureFlagId),
    id: view.id,
    paywall: Option.getOrNull(view.paywall),
    paywallId: Option.getOrNull(view.paywallId),
    paywallLocationId: view.paywallLocationId,
    paywallRelease: toShowingRelease(view.paywallRelease),
    paywallReleaseId: Option.getOrNull(view.paywallReleaseId),
    projectId: view.projectId,
    startedAt: view.startedAt,
    type: view.type,
    updatedAt: Option.getOrNull(view.updatedAt),
  });

/**
 * Handlers for paywall locations — the named slots an app resolves at runtime —
 * and their showing history. The active showing is modelled as a singleton
 * sub-resource: `PUT` to set it, `DELETE` to clear it.
 */
export const PaywallLocationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "paywall_locations",
  (handlers) =>
    Effect.gen(function* () {
      const paywallLocationService = yield* PaywallLocationService;

      /**
       * Reads one location out of its project's listing. The service has no
       * by-id accessor, so the project must be resolvable from the request.
       */
      const loadLocation = (projectId: string, locationId: string) =>
        Effect.fn("loadLocation")(function* () {
          const locations = yield* paywallLocationService.listLocations({
            includeArchived: true,
            projectId,
          });
          const location = locations.find((candidate) => candidate.id === locationId);
          if (!location) {
            return yield* Effect.fail(
              new ApiPaywallLocationNotFoundError({
                message: `Paywall location not found: ${locationId}`,
              }),
            );
          }
          return location;
        })();

      return handlers
        .handle("listPaywallLocations", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const locations = yield* paywallLocationService.listLocations({
                includeArchived: query.includeArchived === "true",
                projectId,
              });
              const page = yield* paginate(locations, (location) => location.id, query);
              return { data: page.data.map(toLocation), pageInfo: page.pageInfo };
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createPaywallLocation", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const created = yield* paywallLocationService.createLocation({
                description: Option.fromNullishOr(payload.description),
                name: payload.name,
                projectId,
                slug: payload.slug,
              });
              const locations = yield* paywallLocationService.listLocations({
                includeArchived: true,
                projectId,
              });
              const location = locations.find((candidate) => candidate.id === created.id);
              if (!location) {
                // The row was just written; a miss is an internal inconsistency.
                return yield* Effect.fail(
                  new ApiPaywallLocationServiceError({
                    cause: `Created paywall location ${created.id} could not be read back`,
                  }),
                );
              }
              const apiLocation = toLocation(location);
              // `GET /paywall-locations/:locationId` is project-scoped, so the
              // scope the create resolved travels with the `Location` URL.
              return yield* createdResponse(
                PaywallLocation,
                apiLocation,
                `/paywall-locations/${apiLocation.id}?projectId=${projectId}`,
              );
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
              PaywallLocationSlugAlreadyExistsError: (e) =>
                Effect.fail(new ApiPaywallLocationSlugAlreadyExistsError({ slug: e.slug })),
            }),
          ),
        )
        .handle("getPaywallLocation", ({ params, query }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              return toLocation(yield* loadLocation(projectId, params.locationId));
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("updatePaywallLocation", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              yield* paywallLocationService.updateLocation({
                description:
                  payload.description === undefined
                    ? undefined
                    : Option.fromNullishOr(payload.description),
                locationId: params.locationId,
                name: payload.name,
                projectId,
              });
              return toLocation(yield* loadLocation(projectId, params.locationId));
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationNotFoundError: (e) =>
                Effect.fail(new ApiPaywallLocationNotFoundError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("archivePaywallLocation", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              return yield* paywallLocationService.archiveLocation({
                locationId: params.locationId,
              });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationNotFoundError: (e) =>
                Effect.fail(new ApiPaywallLocationNotFoundError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("setPaywallLocationShowing", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const assigned = yield* paywallLocationService.assignLocationShowing({
                featureFlagId: payload.featureFlagId,
                locationId: params.locationId,
                paywallId: payload.paywallId,
                type: payload.type,
              });
              const showings = yield* paywallLocationService.listLocationShowings({
                locationId: params.locationId,
              });
              const showing = showings.find((candidate) => candidate.id === assigned.id);
              if (!showing) {
                return yield* Effect.fail(
                  new ApiPaywallLocationServiceError({
                    cause: `Assigned showing ${assigned.id} could not be read back`,
                  }),
                );
              }
              return toShowing(showing);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationNotFoundError: (e) =>
                Effect.fail(new ApiPaywallLocationNotFoundError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
              PaywallLocationShowingValidationError: (e) =>
                Effect.fail(new ApiPaywallLocationShowingValidationError({ message: e.message })),
              PaywallNotFoundError: (e) =>
                Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            }),
          ),
        )
        .handle("clearPaywallLocationShowing", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              return yield* paywallLocationService.clearLocationShowing({
                locationId: params.locationId,
              });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationNotFoundError: (e) =>
                Effect.fail(new ApiPaywallLocationNotFoundError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("listPaywallLocationShowings", ({ params, query }) =>
          bridgeAuthSession(
            Effect.fn("PaywallLocationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const showings = yield* paywallLocationService.listLocationShowings({
                locationId: params.locationId,
              });
              return yield* paginate(showings.map(toShowing), (showing) => showing.id, query);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallLocationNotFoundError: (e) =>
                Effect.fail(new ApiPaywallLocationNotFoundError({ message: e.message })),
              PaywallLocationServiceError: (e) =>
                Effect.fail(new ApiPaywallLocationServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);
