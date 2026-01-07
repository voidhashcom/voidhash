import { OrganizationService } from "@voidhash/core/services";
import { OrganizationRpcsDef } from "@voidhash/rpc";
import { AuthSession, NotAuthenticatedError } from "@voidhash/shared";
import { Effect, Layer } from "effect";

export const OrganizationRpcsLive = OrganizationRpcsDef.toLayer(
  Effect.gen(function* OrganizationRpcsLive() {
    const organizationService = yield* OrganizationService;
    return {
      CreateOrganization: ({ name }) =>
        organizationService.createOrganization({ name }),
      DeleteOrganization: ({ organizationId }) =>
        Effect.gen(function* DeleteOrganization() {
          const session = yield* AuthSession;
          const { cookie } = session;
          if (!cookie) {
            return Effect.fail(
              new NotAuthenticatedError({
                message: "Cookie not found on your session",
              })
            );
          }
          return yield* organizationService.deleteOrganization(
            { organizationId },
            cookie
          );
        }),
      UpdateOrganization: ({ organizationId, name }) =>
        Effect.gen(function* UpdateOrganization() {
          const session = yield* AuthSession;
          const { cookie } = session;
          if (!cookie) {
            return Effect.fail(
              new NotAuthenticatedError({
                message: "Cookie not found on your session",
              })
            );
          }
          return yield* organizationService.updateOrganization(
            { name, organizationId },
            cookie
          );
        }),
    };
  })
).pipe(Layer.provide(OrganizationService.Default));
