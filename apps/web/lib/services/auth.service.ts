import { apiKeys, projects, type User } from '@voidhash/db';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { eq, inArray } from 'drizzle-orm';
import { Context, Data, Effect, Option } from 'effect';
import { hashKey } from '@/lib/core/api-keys/effect/utils';
import { BetterAuth } from '../effect/better-auth';
import { Db } from '../effect/db';
import { UnauthorizedError } from '../effect/errors';
import { Request } from '../effect/request';
import { HonoRuntimeTag, NextjsRuntimeTag } from '../effect/runtimes/tags';

export class InvalidSourceError extends Data.TaggedError('InvalidSourceError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingSecretKeyError extends Data.TaggedError(
  'MissingSecretKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidSecretKeyError extends Data.TaggedError(
  'InvalidSecretKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingPublishableKeyError extends Data.TaggedError(
  'MissingPublishableKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingAppUserIdError extends Data.TaggedError(
  'MissingAppUserIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidPublishableKeyError extends Data.TaggedError(
  'InvalidPublishableKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingProjectIdError extends Data.TaggedError(
  'MissingProjectIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

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
  readonly user: User;
  readonly customer: null;
  readonly environment: null;
};

export type ApiKeySession = VoidhashBaseSession & {
  readonly method: 'api-key';
  readonly user: null;
  readonly customer: null;
  readonly environment: EnvironmentValue;
};

export type PublishableApiKeySession = VoidhashBaseSession & {
  readonly method: 'publishable-api-key';
  readonly customer: {
    readonly appUserId: string;
    readonly sdkOrigin: string | null;
    readonly sdkVersion: string | null;
    readonly os: string | null;
    readonly device: string | null;
  };
  readonly user: null;
  readonly environment: EnvironmentValue;
};

export class InvalidAuthMethodError extends Data.TaggedError(
  'InvalidAuthMethodError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class AuthSession extends Context.Tag('app/AuthSession')<
  AuthSession,
  UserSession | ApiKeySession | PublishableApiKeySession
>() {
  static readonly provide = (
    session: UserSession | ApiKeySession | PublishableApiKeySession
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

export const authenticateWithSession = <A, B, C>(
  effect: Effect.Effect<A, B, C>
) =>
  Effect.gen(function* () {
    yield* NextjsRuntimeTag;
    const existingSession = yield* Effect.serviceOption(AuthSession);
    if (Option.isSome(existingSession)) {
      return yield* effect.pipe(AuthSession.provide(existingSession.value));
    }
    const userAuthSession = yield* getUserAuthSession;
    return yield* effect.pipe(AuthSession.provide(userAuthSession));
  });

export const authenticateWithSecretKey = <A, B, C>(
  effect: Effect.Effect<A, B, C>
) =>
  Effect.gen(function* () {
    yield* HonoRuntimeTag;
    const existingSession = yield* Effect.serviceOption(AuthSession);
    if (Option.isSome(existingSession)) {
      return yield* effect.pipe(AuthSession.provide(existingSession.value));
    }
    const secretApiKeyAuthSession = yield* getSecretApiKeyAuthSession;
    return yield* effect.pipe(AuthSession.provide(secretApiKeyAuthSession));
  });

export const authenticateWithPublishableKey = <A, B, C>(
  effect: Effect.Effect<A, B, C>
) =>
  Effect.gen(function* () {
    yield* HonoRuntimeTag;
    const existingSession = yield* Effect.serviceOption(AuthSession);
    if (Option.isSome(existingSession)) {
      return yield* effect.pipe(AuthSession.provide(existingSession.value));
    }
    const publishableApiKeyAuthSession = yield* getPublishableApiKeyAuthSession;
    return yield* effect.pipe(
      AuthSession.provide(publishableApiKeyAuthSession)
    );
  });

const getUserAuthSession = Effect.gen(function* () {
  const betterAuth = yield* BetterAuth;
  const request = yield* Request;
  const headers = yield* request.getHeaders();
  const session = yield* betterAuth.use(async (client) => {
    return await client.api.getSession({
      headers
    });
  });

  if (!session?.user) {
    return yield* Effect.fail(
      new UnauthorizedError({
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

const getSecretApiKeyAuthSession = Effect.gen(function* () {
  const request = yield* Request;

  const headers = yield* request.getHeaders();
  const apiKey = headers.get('x-secret-key');

  if (!apiKey) {
    return yield* Effect.fail(
      new MissingSecretKeyError({
        message: 'No Secret Key provided.'
      })
    );
  }

  const keyHash = yield* hashKey(apiKey);
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
    method: 'api-key',
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
  } satisfies ApiKeySession;
});

export const getPublishableApiKeyAuthSession = Effect.gen(function* () {
  const request = yield* Request;
  const headers = yield* request.getHeaders();

  const publishableApiKey = headers.get('x-publishable-key');
  if (!publishableApiKey) {
    return yield* Effect.fail(
      new MissingPublishableKeyError({
        message:
          'Publishable key is required. Add it to the x-publishable-key header.'
      })
    );
  }

  const dbService = yield* Db;
  const apiKeyRecord = yield* dbService.use(async (db) => {
    return await db.query.apiKeys.findFirst({
      where: eq(apiKeys.key, publishableApiKey),
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

  const appUserId = headers.get('x-app-user-id');
  if (!appUserId) {
    return yield* Effect.fail(
      new MissingAppUserIdError({
        message: 'App User ID not found.'
      })
    );
  }

  const sdkOrigin = headers.get('x-sdk-origin');
  const sdkVersion = headers.get('x-sdk-version');
  const os = headers.get('x-os');
  const device = headers.get('x-device');

  const projects = [apiKeyRecord.project];

  return {
    method: 'publishable-api-key',
    user: null,
    customer: {
      appUserId,
      sdkOrigin,
      sdkVersion,
      os,
      device
    },
    environment: apiKeyRecord.environment,
    organizations: [] as never[],
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      organizationId: p.organizationId,
      permissions: []
    }))
  } satisfies PublishableApiKeySession;
});
