import {
  ActivatedPaywallRelease,
  createdResponse,
  Paywall,
  PaywallRelease,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaywallDeployServiceError,
  ApiPaywallDeployValidationError,
  ApiPaywallNotFoundError,
  ApiPaywallPublishError,
  ApiPaywallReleaseError,
  ApiPaywallReleaseNotFoundError,
  ApiPaywallServiceError,
  ApiPaywallSlugAlreadyExistsError,
} from "@voidhash/api-contracts/errors";
import {
  PaywallDeployService,
  PaywallReleaseService,
  PaywallService,
} from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

/** Projects a stored paywall row onto the public resource shape. */
const toPaywall = (row: {
  readonly archivedAt: Date | null;
  readonly createdAt: Date | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly thumbnailUrl: string | null;
}) =>
  new Paywall({
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    slug: row.slug,
    thumbnailUrl: row.thumbnailUrl,
  });

/**
 * Handlers for the paywall aggregate: the paywall itself plus its release
 * lifecycle (snapshot → publish → activate). Every endpoint rejects a
 * publishable key, which is a client-side credential.
 */
export const PaywallsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "paywalls", (handlers) =>
  Effect.gen(function* () {
    const paywallService = yield* PaywallService;
    const releaseService = yield* PaywallReleaseService;
    const deployService = yield* PaywallDeployService;

    return handlers
      .handle("listPaywalls", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const rows = yield* paywallService.getPaywalls(
              projectId,
              query.includeArchived === "true",
            );
            return yield* paginate(rows.map(toPaywall), (paywall) => paywall.id, query);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("createPaywall", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const created = yield* paywallService.createPaywall({
              name: payload.name,
              projectId,
              slug: payload.slug,
            });
            const paywall = toPaywall(yield* paywallService.getPaywallById(created.id));
            return yield* createdResponse(Paywall, paywall, `/paywalls/${paywall.id}`);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
            // The row was just written, so a miss here is an internal
            // inconsistency rather than a client-visible 404.
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallServiceError({ cause: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
            PaywallSlugAlreadyExistsError: (e) =>
              Effect.fail(new ApiPaywallSlugAlreadyExistsError({ slug: e.slug })),
          }),
        ),
      )
      .handle("getPaywall", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            return toPaywall(yield* paywallService.getPaywallById(params.paywallId));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updatePaywall", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            if (payload.name !== undefined) {
              yield* paywallService.renamePaywall({
                name: payload.name,
                paywallId: params.paywallId,
              });
            }
            return toPaywall(yield* paywallService.getPaywallById(params.paywallId));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("archivePaywall", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            return yield* paywallService.archivePaywall({ paywallId: params.paywallId });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("restorePaywall", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            yield* paywallService.restorePaywall({ paywallId: params.paywallId });
            return toPaywall(yield* paywallService.getPaywallById(params.paywallId));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallServiceError: (e) => Effect.fail(new ApiPaywallServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listPaywallReleases", ({ params, query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const draft = yield* releaseService.getDraftRelease(params.paywallId);
            const items: Array<PaywallRelease> = [];

            if (draft !== null) {
              items.push(
                new PaywallRelease({
                  createdAt: draft.createdAt,
                  paywallId: params.paywallId,
                  publishedAt: null,
                  releaseId: draft.releaseId,
                  status: "draft",
                  url: draft.draftUrl,
                  version: draft.version,
                }),
              );
            }
            return yield* paginate(items, (release) => release.releaseId, query);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallReleaseError: (e) =>
              Effect.fail(new ApiPaywallReleaseError({ message: e.message })),
          }),
        ),
      )
      .handle("createPaywallRelease", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            // A release records its author, so this needs a real user.
            yield* requireCredential(authSession, ["user"]);
            const draft = yield* releaseService.createRelease(params.paywallId);
            return new PaywallRelease({
              createdAt: draft.createdAt,
              paywallId: params.paywallId,
              publishedAt: null,
              releaseId: draft.releaseId,
              status: "draft",
              url: draft.draftUrl,
              version: draft.version,
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallReleaseError: (e) =>
              Effect.fail(new ApiPaywallReleaseError({ message: e.message })),
          }),
        ),
      )
      .handle("publishPaywallRelease", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const published = yield* releaseService.publishRelease(
              params.releaseId,
              params.paywallId,
            );
            return new PaywallRelease({
              createdAt: null,
              paywallId: params.paywallId,
              publishedAt: published.publishedAt,
              releaseId: published.releaseId,
              status: "published",
              url: published.htmlUrl,
              version: published.version,
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaywallNotFoundError: (e) =>
              Effect.fail(new ApiPaywallNotFoundError({ message: e.message })),
            PaywallReleaseError: (e) =>
              Effect.fail(new ApiPaywallPublishError({ message: e.message })),
            ReleaseNotFoundError: (e) =>
              Effect.fail(new ApiPaywallReleaseNotFoundError({ releaseId: e.releaseId })),
          }),
        ),
      )
      .handle("activatePaywallRelease", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, ["user", "secret-key"]);
            const activated = yield* deployService.setActivePaywallRelease({
              paywallId: params.paywallId,
              releaseId: params.releaseId,
            });
            return new ActivatedPaywallRelease({
              releaseId: activated.id,
              version: activated.version,
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            AuditLogPortError: (e) =>
              Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
            PaywallDeployServiceError: (e) =>
              Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
            PaywallDeployValidationError: (e) =>
              Effect.fail(
                new ApiPaywallDeployValidationError({
                  message: e.message,
                  violations: e.violations,
                }),
              ),
            PaywallReleaseNotFoundError: () =>
              Effect.fail(new ApiPaywallReleaseNotFoundError({ releaseId: params.releaseId })),
          }),
        ),
      );
  }),
);
