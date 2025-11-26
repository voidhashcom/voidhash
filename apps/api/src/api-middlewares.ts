import { HttpServerRequest } from '@effect/platform';
import { AuthMiddleware } from '@voidhash/api-spec';
import { BetterAuth } from '@voidhash/auth/effect';
import { hashKey } from '@voidhash/core/utils';
import { apiKeys, eq, inArray, projects } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import {
  AuthenticationError,
  NotAuthenticatedError,
  type PublishableKeySession,
  type SecretKeySession,
  type UserSession
} from '@voidhash/shared';
import { Effect, Layer, pipe, Redacted } from 'effect';

export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const dbService = yield* Db;
    const betterAuth = yield* BetterAuth;

    // Return the security handlers for the middleware
    return {
      // Define the handler for the Bearer token
      // The Bearer token is redacted for security
      betterAuthCookie: () =>
        pipe(
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const reqNode = req.source as Request;

            const session = yield* betterAuth.use(async (client) => {
              return await client.api.getSession({
                headers: reqNode.headers
              });
            });

            if (!session?.user) {
              return yield* Effect.fail(
                new NotAuthenticatedError({
                  message: 'You are not authenticated'
                })
              );
            }

            const usersOrganizations = yield* betterAuth.use(async (client) => {
              return await client.api.listOrganizations({
                headers: reqNode.headers
              });
            });

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
              cookie: reqNode.headers.get('cookie') ?? '',
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
        ),
      apiKey: (apiKey) =>
        pipe(
          Effect.gen(function* () {
            const headers = new Headers({
              'x-api-key': Redacted.value(apiKey)
            });

            const session = yield* betterAuth
              .use(async (client) => {
                return await client.api.getSession({
                  headers
                });
              })
              .pipe(
                Effect.tapError((error) =>
                  Console.log(JSON.stringify(error, null, 2))
                )
              );

            if (!session?.user) {
              return yield* Effect.fail(
                new NotAuthenticatedError({
                  message: 'You are not authenticated'
                })
              );
            }

            const usersOrganizations = yield* betterAuth.use(async (client) => {
              return await client.api.listOrganizations({
                headers
              });
            });

            const usersProjects = yield* dbService.use(async (db) => {
              return await db.query.projects.findMany({
                where: inArray(
                  projects.organizationId,
                  usersOrganizations.map((o) => o.id)
                )
              });
            });

            return {
              method: 'user',
              name: `${session.user.name} <${session.user.email}>`,
              cookie: headers.get('cookie'),
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
        ),
      secretKey: (secretKey) =>
        pipe(
          Effect.gen(function* () {
            const keyHash = yield* hashKey(Redacted.value(secretKey));
            const apiKeyRecord = yield* dbService.use(async (db) => {
              return await db.query.apiKeys.findFirst({
                where: eq(apiKeys.key, keyHash),
                with: {
                  project: true
                }
              });
            });

            if (!apiKeyRecord) {
              return yield* Effect.fail(
                new AuthenticationError({
                  message: 'Secret Key not found, is expired or is invalid.',
                  cause: 'Secret Key not found, is expired or is invalid.'
                })
              );
            }

            const projects = [apiKeyRecord.project];

            return {
              method: 'secret-key',
              name: `${apiKeyRecord.project.name} API Key`,
              customer: null,
              user: null,
              organizations: [],
              projects: projects.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                organizationId: p.organizationId,
                permissions: ['project:all'] // TODO: Add permissions
              })),
              cookie: null
            } satisfies SecretKeySession;
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new AuthenticationError({
                message:
                  'Failed to authenticate with secret key due to an internal error',
                cause: String(e.message)
              })
          })
        ),
      publishableKey: (publishableKey) =>
        pipe(
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const headers = req.headers;
            const appUserId = headers['x-app-user-id'];
            if (!appUserId) {
              return yield* Effect.fail(
                new AuthenticationError({
                  message: 'Missing app-user-id header',
                  cause: 'Missing app-user-id header'
                })
              );
            }

            const apiKeyRecord = yield* dbService.use(async (db) => {
              return await db.query.apiKeys.findFirst({
                where: eq(apiKeys.key, Redacted.value(publishableKey)),
                with: {
                  project: true
                }
              });
            });
            if (!apiKeyRecord) {
              return yield* Effect.fail(
                new AuthenticationError({
                  message:
                    'Publishable Key not found, is expired or is invalid.',
                  cause: 'Publishable Key not found, is expired or is invalid.'
                })
              );
            }

            const projects = [apiKeyRecord.project];

            return {
              method: 'publishable-key',
              name: `${apiKeyRecord.project.name} API Key`,
              user: null,
              customer: {
                appUserId
              },
              organizations: [] as never[],
              projects: projects.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                organizationId: p.organizationId,
                permissions: []
              })),
              cookie: null
            } satisfies PublishableKeySession;
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new AuthenticationError({
                message:
                  'Failed to authenticate with publishable key due to an internal error',
                cause: String(e.message)
              })
          })
        )
    };
  })
);
