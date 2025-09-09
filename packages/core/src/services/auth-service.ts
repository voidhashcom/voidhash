import { BetterAuth } from '@voidhash/auth/effect';
import { apiKeys, projects, type User } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { eq, inArray } from 'drizzle-orm';
import { Context, Effect, Option } from 'effect';
import { hashKey } from '../utils/api-keys/effect/utils';
import {
  InvalidPublishableKeyError,
  InvalidSecretKeyError,
  MissingProjectIdError,
  UnauthenticatedError
} from './errors';

type VoidhashBaseSession = {
  readonly organizations: {
    readonly id: string;
    readonly slug: string;
    readonly permissions: string[];
  }[];
  readonly projects: {
    readonly id: string;
    readonly slug: string;
    readonly organizationId: string;
    readonly permissions: string[];
  }[];
};

export type UserSession = VoidhashBaseSession & {
  readonly method: 'user';
  readonly name: string;
  readonly user: User;
  readonly customer: null;
  readonly environment: null;
};

export type SecretKeySession = VoidhashBaseSession & {
  readonly method: 'secret-key';
  readonly name: string;
  readonly user: null;
  readonly customer: null;
  readonly environment: EnvironmentValue;
};

export type PublishableKeySession = VoidhashBaseSession & {
  readonly method: 'publishable-key';
  readonly name: string;
  readonly customer: {
    readonly appUserId: string;
  };
  readonly user: null;
  readonly environment: EnvironmentValue;
};

export class AuthSession extends Context.Tag('app/AuthSession')<
  AuthSession,
  UserSession | SecretKeySession | PublishableKeySession
>() {
  static readonly provide = (
    session: UserSession | SecretKeySession | PublishableKeySession
  ): (<A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, AuthSession>>) =>
    Effect.provideService(this, session);
}

export class AuthService extends Effect.Service<AuthService>()(
  'app/AuthService',
  {
    dependencies: [Db.Default],

    effect: Effect.gen(function* () {
      return {
        getAuthorizedProjectId: () =>
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = authSession.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.fail(
                new MissingProjectIdError({
                  message: 'No project id found in session'
                })
              );
            }
            return projectId;
          })
      };
    })
  }
) {}

export const authenticateWithSession =
  (headers: Headers) =>
  <A, B, C>(effect: Effect.Effect<A, B, C>) =>
    Effect.gen(function* () {
      const existingSession = yield* Effect.serviceOption(AuthSession);
      if (Option.isSome(existingSession)) {
        return yield* effect.pipe(AuthSession.provide(existingSession.value));
      }
      const userAuthSession = yield* getUserAuthSession(headers);
      return yield* effect.pipe(AuthSession.provide(userAuthSession));
    });

export const authenticateWithApiKey =
  (apiKey: string) =>
  <A, B, C>(effect: Effect.Effect<A, B, C>) =>
    Effect.gen(function* () {
      const existingSession = yield* Effect.serviceOption(AuthSession);
      if (Option.isSome(existingSession)) {
        return yield* effect.pipe(AuthSession.provide(existingSession.value));
      }
      const userAuthSession = yield* getUserAuthSession(
        new Headers({
          'x-api-key': apiKey
        })
      );
      return yield* effect.pipe(AuthSession.provide(userAuthSession));
    });

export const authenticateWithSecretKey =
  (secretKey: string) =>
  <A, B, C>(effect: Effect.Effect<A, B, C>) =>
    Effect.gen(function* () {
      const existingSession = yield* Effect.serviceOption(AuthSession);
      if (Option.isSome(existingSession)) {
        return yield* effect.pipe(AuthSession.provide(existingSession.value));
      }
      const secretApiKeyAuthSession =
        yield* getSecretApiKeyAuthSession(secretKey);
      return yield* effect.pipe(AuthSession.provide(secretApiKeyAuthSession));
    });

export const authenticateWithPublishableKey =
  (publishableKey: string, appUserId: string) =>
  <A, B, C>(effect: Effect.Effect<A, B, C>) =>
    Effect.gen(function* () {
      const existingSession = yield* Effect.serviceOption(AuthSession);
      if (Option.isSome(existingSession)) {
        return yield* effect.pipe(AuthSession.provide(existingSession.value));
      }
      const publishableApiKeyAuthSession =
        yield* getPublishableApiKeyAuthSession(publishableKey, appUserId);
      return yield* effect.pipe(
        AuthSession.provide(publishableApiKeyAuthSession)
      );
    });

const getUserAuthSession = (headers: Headers) =>
  Effect.gen(function* () {
    const betterAuth = yield* BetterAuth;
    const session = yield* betterAuth.use(async (client) => {
      return await client.api.getSession({
        headers
      });
    });

    if (!session?.user) {
      return yield* Effect.fail(
        new UnauthenticatedError({
          message: 'You are not authenticated'
        })
      );
    }

    const usersOrganizations = yield* betterAuth.use(async (client) => {
      return await client.api.listOrganizations({
        headers
      });
    });

    const dbService = yield* Db;
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
      user: {
        ...session.user,
        image: session.user.image ?? null
      },
      customer: null,
      organizations: usersOrganizations.map((o) => ({
        id: o.id,
        slug: o.slug,
        permissions: ['organization:all'] // TODO: Add permissions
      })),
      environment: null,
      projects: usersProjects.map((p) => ({
        id: p.id,
        slug: p.slug,
        organizationId: p.organizationId,
        permissions: ['project:all'] // TODO: Add permissions
      }))
    } satisfies UserSession;
  });

const getSecretApiKeyAuthSession = (secretKey: string) =>
  Effect.gen(function* () {
    const keyHash = yield* hashKey(secretKey);
    const dbService = yield* Db;
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
        new InvalidSecretKeyError({
          message: 'Invalid Secret Key.'
        })
      );
    }

    const projects = [apiKeyRecord.project];

    return {
      method: 'secret-key',
      name: `${apiKeyRecord.project.name} API Key`,
      customer: null,
      user: null,
      environment: apiKeyRecord.environment,
      organizations: [],
      projects: projects.map((p) => ({
        id: p.id,
        slug: p.slug,
        organizationId: p.organizationId,
        permissions: ['project:all'] // TODO: Add permissions
      }))
    } satisfies SecretKeySession;
  });

export const getPublishableApiKeyAuthSession = (
  publishableKey: string,
  appUserId: string
) =>
  Effect.gen(function* () {
    const dbService = yield* Db;
    const apiKeyRecord = yield* dbService.use(async (db) => {
      return await db.query.apiKeys.findFirst({
        where: eq(apiKeys.key, publishableKey),
        with: {
          project: true
        }
      });
    });
    if (!apiKeyRecord) {
      return yield* Effect.fail(
        new InvalidPublishableKeyError({
          message: 'Invalid Publishable Key.'
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
      environment: apiKeyRecord.environment,
      organizations: [] as never[],
      projects: projects.map((p) => ({
        id: p.id,
        slug: p.slug,
        organizationId: p.organizationId,
        permissions: []
      }))
    } satisfies PublishableKeySession;
  });
