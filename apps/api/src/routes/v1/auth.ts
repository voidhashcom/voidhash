import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { AuthSession } from '@voidhash/shared';
import { Effect } from 'effect';

export const AuthGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'auth',
  (handlers) =>
    handlers.handle('session', () =>
      Effect.gen(function* () {
        const authSession = yield* AuthSession;
        const method =
          authSession.method === 'user'
            ? 'api-key'
            : (authSession.method as
                | 'api-key'
                | 'publishable-key'
                | 'secret-key');
        return {
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
        };
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
