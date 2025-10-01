import {
  HttpApiBuilder,
  HttpApiError,
  HttpServerResponse
} from '@effect/platform';
import { VoidhashApi } from '@voidhash/api-spec';
import {
  AuthSession,
  authenticateWithApiKey,
  authenticateWithSecretKey,
  UnauthenticatedError
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { getApiKeyFromRequest, getSecretKeyFromRequest } from '@/utils/auth';

export const AuthGroupLive = HttpApiBuilder.group(
  VoidhashApi,
  'v1_auth',
  (handlers) =>
    handlers.handle('session', () =>
      Effect.gen(function* () {
        const createAuthSessionResponse = Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const method =
            authSession.method === 'user' ? 'api-key' : authSession.method;
          return yield* HttpServerResponse.json({
            method,
            name: authSession.name,
            organizations: authSession.organizations.map((o) => ({
              id: o.id,
              slug: o.slug,
              name: o.name
            })),
            projects: authSession.projects.map((p) => ({
              id: p.id,
              slug: p.slug,
              name: p.name,
              organizationId: p.organizationId
            }))
          });
        });

        const secretKey = yield* getSecretKeyFromRequest().pipe(
          Effect.orElse(() => Effect.succeed(null))
        );
        if (secretKey) {
          return yield* authenticateWithSecretKey(secretKey)(
            createAuthSessionResponse
          ).pipe(
            Effect.catchTags({
              DatabaseError: () =>
                Effect.fail(new HttpApiError.InternalServerError())
            })
          );
        }

        const apiKey = yield* getApiKeyFromRequest().pipe(
          Effect.orElse(() => Effect.succeed(null))
        );
        if (apiKey) {
          return yield* authenticateWithApiKey(apiKey)(
            createAuthSessionResponse
          ).pipe(
            Effect.catchTags({
              BetterAuthError: () =>
                Effect.fail(new HttpApiError.InternalServerError()),
              DatabaseError: () =>
                Effect.fail(new HttpApiError.InternalServerError())
            })
          );
        }

        return yield* Effect.fail(
          new UnauthenticatedError({
            message: 'Secret key or API key is required'
          })
        );
      })
    )
);

// export const CustomersGroupLive = HttpApiBuilder.group(
//   VoidhashApi,
//   'v1/customers',
//   (handlers) =>
//     Effect.gen(function* () {
//       return handlers.handle('by-app-user-id', ({ path: { appUserId } }) =>
//         Effect.gen(function* () {
//           yield* Effect.log(appUserId);
//           return yield* HttpServerResponse.json({
//             customerId: 'placeholder',
//             name: null,
//             email: null,
//             appUserId: null
//           }).pipe(
//             Effect.catchTag('HttpBodyError', () =>
//               Effect.fail(new HttpApiError.BadRequest())
//             )
//           );
//         })
//       );
//     })
// );
