import {
  createdResponse,
  Organization,
  Project,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiOrganizationNotFoundError,
  ApiOrganizationServiceError,
  ApiProjectServiceError,
} from "@voidhash/api-contracts/errors";
import { OrganizationService, ProjectService } from "@voidhash/core/services";
import { paginate } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

export const OrganizationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "organizations",
  (handlers) =>
    Effect.gen(function* () {
      const organizationService = yield* OrganizationService;
      const projectService = yield* ProjectService;
      return handlers
        .handle("createOrganization", ({ payload }) =>
          bridgeAuthSession(
            organizationService.createOrganization({ name: payload.name }).pipe(
              Effect.flatMap((org) => {
                const created = new Organization(org);
                return createdResponse(Organization, created, `/organizations/${created.id}`);
              }),
            ),
          ).pipe(
            Effect.catchTags({
              OrganizationServiceError: (e) =>
                Effect.fail(new ApiOrganizationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("listOrganizations", ({ query }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user"]);
              // Membership already rides on the session, so this needs no
              // database round trip — and cannot reach a foreign organization.
              const organizations = [...authSession.organizations].sort((a, b) =>
                a.id.localeCompare(b.id),
              );
              const page = yield* paginate(organizations, (org) => org.id, query);
              return {
                data: page.data.map(
                  (org) => new Organization({ id: org.id, name: org.name, slug: org.slug }),
                ),
                pageInfo: page.pageInfo,
              };
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            }),
          ),
        )
        .handle("getOrganization", ({ params }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user"]);
              const org = yield* organizationService.getOrganizationById(params.organizationId);
              return new Organization({ id: org.id, name: org.name, slug: org.slug });
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              OrganizationNotFoundError: (e) =>
                Effect.fail(
                  new ApiOrganizationNotFoundError({
                    message: `Organization ${e.organizationId} not found.`,
                  }),
                ),
              OrganizationServiceError: (e) =>
                Effect.fail(new ApiOrganizationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("updateOrganization", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user"]);
              if (payload.name !== undefined) {
                yield* organizationService.updateOrganization({
                  name: payload.name,
                  organizationId: params.organizationId,
                });
              }
              const org = yield* organizationService.getOrganizationById(params.organizationId);
              return new Organization({ id: org.id, name: org.name, slug: org.slug });
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              OrganizationNotFoundError: (e) =>
                Effect.fail(
                  new ApiOrganizationNotFoundError({
                    message: `Organization ${e.organizationId} not found.`,
                  }),
                ),
              OrganizationServiceError: (e) =>
                Effect.fail(new ApiOrganizationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("listOrganizationProjects", ({ params, query }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user"]);
              const projectsList = yield* projectService.getProjects(params.organizationId);
              const sorted = [...projectsList].sort((a, b) => a.id.localeCompare(b.id));
              const page = yield* paginate(sorted, (project) => project.id, query);
              return {
                data: page.data.map(
                  (project) =>
                    new Project({ id: project.id, name: project.name, slug: project.slug }),
                ),
                pageInfo: page.pageInfo,
              };
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              ProjectServiceError: (e) =>
                Effect.fail(new ApiProjectServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);
