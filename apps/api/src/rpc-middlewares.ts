import { BetterAuth } from '@voidhash/auth/effect';
import { inArray, projects } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { AuthMiddleware } from '@voidhash/rpc';
import {
  AuthenticationError,
  NotAuthenticatedError,
  type UserSession
} from '@voidhash/shared';
import { Effect, Layer, pipe } from 'effect';

export const RpcAuthLive = Layer.effect(
  AuthMiddleware,
  // A middleware that provides the current user.
  //
  // You can access the headers, payload, and the RPC definition when
  // implementing the middleware.
  Effect.gen(function* () {
    const dbService = yield* Db;
    const betterAuth = yield* BetterAuth;

    return AuthMiddleware.of(({ headers }) =>
      pipe(
        Effect.gen(function* () {
          const nodeHeaders = new Headers({
            cookie: headers.cookie ?? ''
          });

          const [session, usersOrganizations] = yield* Effect.all(
            [
              betterAuth.use(async (client) => {
                return await client.api.getSession({
                  headers: nodeHeaders
                });
              }),
              betterAuth.use(async (client) => {
                return await client.api.listOrganizations({
                  headers: nodeHeaders
                });
              })
            ],
            {
              concurrency: 'unbounded'
            }
          );

          const usersProjects = yield* dbService.use(async (db) => {
            return await db.query.projects.findMany({
              where: inArray(
                projects.organizationId,
                usersOrganizations.map((o) => o.id)
              )
            });
          });

          if (!session?.user) {
            return yield* Effect.fail(
              new NotAuthenticatedError({
                message: 'You are not authenticated'
              })
            );
          }

          return {
            method: 'user',
            cookie: headers.cookie ?? null,
            name: `${session.user.name} <${session.user.email}>`,
            user: {
              ...session.user,
              image: session.user.image ?? null
            },
            customer: null,
            organizations: usersOrganizations.map((o) => ({
              id: o.id,
              slug: o.slug,
              name: o.name,
              permissions: ['organization:all'] // TODO: Add permissions
            })),
            projects: usersProjects.map((p) => ({
              id: p.id,
              slug: p.slug,
              name: p.name,
              organizationId: p.organizationId,
              permissions: ['project:all'] // TODO: Add permissions
            }))
          } satisfies UserSession;
        }),
        Effect.catchTags({
          DatabaseError: (e) =>
            new AuthenticationError({
              message:
                'Failed to authenticate with api key due to an internal error',
              cause: String(e.message)
            }),
          BetterAuthError: (e) =>
            new AuthenticationError({
              message:
                'Failed to authenticate with api key due to an internal error',
              cause: String(e.message)
            })
        })
      )
    );
  })
);
