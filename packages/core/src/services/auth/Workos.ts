import {
  type Event as WorkosEvent,
  type Organization as WorkosOrganization,
  type OrganizationMembership as WorkosOrganizationMembership,
  WorkOS,
  type User as WorkOSUser,
} from "@workos-inc/node";
import { Context, Data, Effect, Layer } from "effect";

export interface WorkosConfig {
  readonly apiKey: Effect.Effect<string>;
  readonly clientId: Effect.Effect<string>;
  readonly cookieName: Effect.Effect<string>;
  readonly cookiePassword: Effect.Effect<string>;
  readonly webhookSecret: Effect.Effect<string>;
}

export class WorkosAuthError extends Data.TaggedError("WorkosAuthError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

type AuthenticatedSession = {
  readonly accessToken: string;
  readonly organizationId?: string;
  readonly permissions?: string[];
  readonly role?: string;
  readonly roles?: string[];
  readonly sessionId: string;
  readonly user: WorkOSUser;
};

/**
 * Format a WorkOS SDK rejection into a single human-readable string. The SDK
 * throws `WorkOSResponseError`-shaped objects whose useful fields live under
 * `rawData` (`message`, `code`, `errors`) and on `status` — without this
 * normalization the `Error.message` we surface is empty and the cause is just
 * `[object Object]`.
 */
const describeWorkosError = (cause: unknown): string => {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  const data = cause as {
    readonly status?: number;
    readonly rawData?: {
      readonly message?: string;
      readonly code?: string;
      readonly errors?: unknown;
    };
    readonly message?: string;
  } | null;
  if (data) {
    const parts: string[] = [];
    if (data.status) parts.push(`HTTP ${data.status}`);
    if (data.rawData?.code) parts.push(data.rawData.code);
    if (data.rawData?.message) parts.push(data.rawData.message);
    else if (data.message) parts.push(data.message);
    if (data.rawData?.errors) parts.push(JSON.stringify(data.rawData.errors));
    if (parts.length > 0) return parts.join(" — ");
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
};

const getCookieValue = (cookieHeader: string | null | undefined, cookieName: string) => {
  if (!cookieHeader) {
    return undefined;
  }

  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(`${cookieName}=`)) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(cookieName.length + 1));
  }

  return undefined;
};

const makeWorkos = (config: WorkosConfig) =>
  Effect.gen(function* () {
    const apiKey = (yield* config.apiKey).trim();
    const clientId = (yield* config.clientId).trim();
    const cookiePassword = (yield* config.cookiePassword).trim();
    const webhookSecret = (yield* config.webhookSecret).trim();
    const cookieName = (yield* config.cookieName).trim();

    const workos = new WorkOS(apiKey, { clientId });
    const jwksUrl = workos.userManagement.getJwksUrl(clientId);

    const authenticateSessionCookie = (headers: Headers) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: "Failed to authenticate WorkOS session cookie",
          }),
        try: async (): Promise<AuthenticatedSession | null> => {
          const sessionData = getCookieValue(headers.get("cookie"), cookieName);
          if (!sessionData) {
            return null;
          }

          const session = workos.userManagement.loadSealedSession({
            cookiePassword,
            sessionData,
          });

          const authResponse = await session.authenticate();
          if (!authResponse.authenticated) {
            return null;
          }

          return {
            accessToken: authResponse.accessToken,
            organizationId: authResponse.organizationId,
            permissions: authResponse.permissions,
            role: authResponse.role,
            roles: authResponse.roles,
            sessionId: authResponse.sessionId,
            user: authResponse.user,
          };
        },
      });

    const getUser = (userId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to fetch WorkOS user ${userId}`,
          }),
        try: () => workos.userManagement.getUser(userId),
      });

    const setUserExternalId = (workosUserId: string, externalId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to set WorkOS external id for user ${workosUserId}`,
          }),
        try: () =>
          workos.userManagement.updateUser({
            externalId,
            userId: workosUserId,
          }),
      });

    const createOrganization = (input: { readonly name: string; readonly externalId: string }) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to create WorkOS organization for external id ${input.externalId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<WorkosOrganization> =>
          workos.organizations.createOrganization({
            externalId: input.externalId,
            name: input.name,
          }),
      });

    const updateOrganization = (input: {
      readonly workosOrganizationId: string;
      readonly name?: string;
    }) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to update WorkOS organization ${input.workosOrganizationId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<WorkosOrganization> =>
          workos.organizations.updateOrganization({
            name: input.name,
            organization: input.workosOrganizationId,
          }),
      });

    const deleteOrganization = (workosOrganizationId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to delete WorkOS organization ${workosOrganizationId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<void> => workos.organizations.deleteOrganization(workosOrganizationId),
      });

    /**
     * Look up a WorkOS organization by the `external_id` we set on creation
     * (= local UUID). Returns `null` when WorkOS reports a 404 so callers can
     * treat absence as a normal control-flow case.
     */
    const getOrganizationByExternalId = (externalId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to get WorkOS organization by external id ${externalId}`,
          }),
        try: (): Promise<WorkosOrganization> =>
          workos.organizations.getOrganizationByExternalId(externalId),
      }).pipe(
        Effect.catch((error) => {
          // The SDK throws `NotFoundException` (status 404) when no org has
          // the given external id; treat that as a normal "absent" result.
          // Other transports surface the same condition as a generic error
          // with `rawData.code === "entity_not_found"`.
          const cause = error.cause as {
            name?: string;
            status?: number;
            rawData?: { code?: string };
          } | null;
          const isNotFound =
            cause?.name === "NotFoundException" ||
            cause?.status === 404 ||
            cause?.rawData?.code === "entity_not_found";
          if (isNotFound) {
            return Effect.succeed(null as WorkosOrganization | null);
          }
          return Effect.fail(error);
        }),
      );

    /** Fetch a WorkOS organization by WorkOS id. */
    const getOrganization = (workosOrganizationId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to get WorkOS organization ${workosOrganizationId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<WorkosOrganization> =>
          workos.organizations.getOrganization(workosOrganizationId),
      });

    const createOrganizationMembership = (input: {
      readonly workosOrganizationId: string;
      readonly workosUserId: string;
      readonly roleSlug?: string;
    }) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to create WorkOS membership for user ${input.workosUserId} in org ${input.workosOrganizationId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<WorkosOrganizationMembership> =>
          workos.userManagement.createOrganizationMembership({
            organizationId: input.workosOrganizationId,
            roleSlug: input.roleSlug,
            userId: input.workosUserId,
          }),
      });

    const updateOrganizationMembership = (
      workosMembershipId: string,
      input: { readonly roleSlug: string },
    ) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to update WorkOS membership ${workosMembershipId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<WorkosOrganizationMembership> =>
          workos.userManagement.updateOrganizationMembership(workosMembershipId, {
            roleSlug: input.roleSlug,
          }),
      });

    const deleteOrganizationMembership = (workosMembershipId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to delete WorkOS membership ${workosMembershipId}: ${describeWorkosError(cause)}`,
          }),
        try: (): Promise<void> =>
          workos.userManagement.deleteOrganizationMembership(workosMembershipId),
      });

    /** List active organization memberships for a WorkOS user. */
    const listOrganizationMembershipsForUser = (workosUserId: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to list WorkOS memberships for user ${workosUserId}: ${describeWorkosError(cause)}`,
          }),
        try: async (): Promise<ReadonlyArray<WorkosOrganizationMembership>> => {
          const result = await workos.userManagement.listOrganizationMemberships({
            userId: workosUserId,
          });
          return result.autoPagination();
        },
      });

    /** First WorkOS user whose email matches, or `null` if none. */
    const findUserByEmail = (email: string) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: `Failed to look up WorkOS user by email ${email}: ${describeWorkosError(cause)}`,
          }),
        try: async (): Promise<WorkOSUser | null> => {
          const result = await workos.userManagement.listUsers({ email });
          return result.data[0] ?? null;
        },
      });

    /**
     * Verify a webhook signature and parse the event. Throws via WorkosAuthError
     * on bad signatures, expired timestamps, or malformed payloads.
     */
    const verifyWebhook = (input: { readonly rawBody: string; readonly signatureHeader: string }) =>
      Effect.tryPromise({
        catch: (cause) =>
          new WorkosAuthError({
            cause,
            message: "Failed to verify WorkOS webhook signature",
          }),
        try: (): Promise<WorkosEvent> => {
          const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
          return workos.webhooks.constructEvent({
            payload,
            secret: webhookSecret,
            sigHeader: input.signatureHeader,
          });
        },
      });

    return {
      authenticateSessionCookie,
      clientId,
      cookieName,
      createOrganization,
      createOrganizationMembership,
      deleteOrganization,
      deleteOrganizationMembership,
      findUserByEmail,
      getJwksUrl: () => jwksUrl,
      getOrganization,
      getOrganizationByExternalId,
      getUser,
      listOrganizationMembershipsForUser,
      setUserExternalId,
      updateOrganization,
      updateOrganizationMembership,
      verifyWebhook,
    };
  });

type WorkosService = Effect.Success<ReturnType<typeof makeWorkos>>;

export class Workos extends Context.Service<Workos, WorkosService>()("core/Workos") {
  /** Create a WorkOS service layer from already-bound runtime configuration. */
  static layer = (config: WorkosConfig): Layer.Layer<Workos> =>
    Layer.effect(Workos)(makeWorkos(config));
}
