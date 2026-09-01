import * as Arr from "effect/Array";
import { createdResponse, Perk, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPerkNotFoundError,
  ApiPerkServiceError,
  ApiPerkSlugAlreadyExistsError,
} from "@voidhash/api-contracts/errors";
import { PerkService } from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Credentials allowed to manage the catalog; publishable keys are public. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

export const PerksGroupLive = HttpApiBuilder.group(VoidhashV1Api, "perks", (handlers) =>
  Effect.gen(function* () {
    const perkService = yield* PerkService;

    return handlers
      .handle("listPerks", ({ query }) =>
        bridgeAuthSession(
          Effect.fn("PerksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const perks = yield* perkService.getPerks(projectId);
            // The service returns rows in database order; pagination cursors
            // only make sense over a stable one.
            const sorted = Arr.sortWith([...perks], (item) => item.id, Order.String);
            const page = yield* paginate(sorted, (perk) => perk.id, query);
            return {
              data: page.data.map(
                (perk) =>
                  new Perk({
                    id: perk.id,
                    name: perk.name,
                    projectId: perk.projectId,
                    slug: perk.slug,
                  }),
              ),
              pageInfo: page.pageInfo,
            };
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("createPerk", ({ payload }) =>
        bridgeAuthSession(
          Effect.fn("PerksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const created = yield* perkService.createPerk({
              name: payload.name,
              projectId,
              slug: payload.slug,
            });
            const perk = new Perk({
              id: created.id,
              name: payload.name,
              projectId,
              slug: payload.slug,
            });
            return yield* createdResponse(Perk, perk, `/perks/${perk.id}`);
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
            PerkSlugAlreadyExistsError: (e) =>
              Effect.fail(new ApiPerkSlugAlreadyExistsError({ slug: e.slug })),
          }),
        ),
      )
      .handle("getPerk", ({ params }) =>
        bridgeAuthSession(
          Effect.fn("PerksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const perk = yield* perkService.getPerkById(params.perkId);
            return new Perk({
              id: perk.id,
              name: perk.name,
              projectId: perk.projectId,
              slug: perk.slug,
            });
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkNotFoundError: (e) => Effect.fail(new ApiPerkNotFoundError({ message: e.message })),
            PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updatePerk", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.fn("PerksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            // The service takes a full name/slug pair plus the owning project,
            // so absent fields are filled from the current row.
            const existing = yield* perkService.getPerkById(params.perkId);
            const name = payload.name ?? existing.name;
            const slug = payload.slug ?? existing.slug;
            yield* perkService.updatePerk({
              id: params.perkId,
              name,
              projectId: existing.projectId,
              slug,
            });
            return new Perk({ id: params.perkId, name, projectId: existing.projectId, slug });
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkNotFoundError: (e) => Effect.fail(new ApiPerkNotFoundError({ message: e.message })),
            PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
            PerkSlugAlreadyExistsError: (e) =>
              Effect.fail(new ApiPerkSlugAlreadyExistsError({ slug: e.slug })),
          }),
        ),
      )
      .handle("deletePerk", ({ params }) =>
        bridgeAuthSession(
          Effect.fn("PerksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* perkService.deletePerk({ perkId: params.perkId });
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PerkNotFoundError: (e) => Effect.fail(new ApiPerkNotFoundError({ message: e.message })),
            PerkServiceError: (e) => Effect.fail(new ApiPerkServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
