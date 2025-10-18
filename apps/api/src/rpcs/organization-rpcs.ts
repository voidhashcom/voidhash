import { OrganizationService } from '@voidhash/core/services';
import { OrganizationRpcsDef } from '@voidhash/rpc';
import { AuthSession, NotAuthenticatedError } from '@voidhash/shared';
import { Effect, Layer } from 'effect';

export const OrganizationRpcsLive = OrganizationRpcsDef.toLayer(
  Effect.gen(function* () {
    const organizationService = yield* OrganizationService;
    return {
      CreateOrganization: ({ name }) =>
        organizationService.createOrganization({ name }),
      UpdateOrganization: ({ organizationId, name }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const cookie = session.cookie;
          if (!cookie) {
            return Effect.fail(
              new NotAuthenticatedError({
                message: 'Cookie not found on your session'
              })
            );
          }
          return yield* organizationService.updateOrganization(
            { organizationId, name },
            cookie
          );
        }),
      DeleteOrganization: ({ organizationId }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const cookie = session.cookie;
          if (!cookie) {
            return Effect.fail(
              new NotAuthenticatedError({
                message: 'Cookie not found on your session'
              })
            );
          }
          return yield* organizationService.deleteOrganization(
            { organizationId },
            cookie
          );
        })
    };
  })
).pipe(Layer.provide(OrganizationService.Default));
