import { and, desc, Db, eq, isNull, voidhashAgentSession } from "@voidhash/db";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { isSessionProjectMember } from "../../utils/permissions.ts";

/** Stable storage failure raised by the agent-session index. */
export class AgentSessionIndexServiceError extends Schema.TaggedErrorClass<AgentSessionIndexServiceError>(
  "AgentSessionIndexServiceError",
)("AgentSessionIndexServiceError", { message: Schema.String }) {}

/** Raised when a caller cannot access the persisted session scope. */
export class AgentSessionForbiddenError extends Schema.TaggedErrorClass<AgentSessionForbiddenError>(
  "AgentSessionForbiddenError",
)("AgentSessionForbiddenError", { message: Schema.String }) {}

/** Raised when an indexed session does not exist. */
export class AgentSessionNotFoundError extends Schema.TaggedErrorClass<AgentSessionNotFoundError>(
  "AgentSessionNotFoundError",
)("AgentSessionNotFoundError", { sessionId: Schema.String }) {}

/** Metadata returned by session history operations. */
export interface AgentSessionSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: string;
  readonly paywallId: string | null;
  readonly userId: string;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input used by the durable session core to create or refresh index metadata. */
export interface AgentSessionTouchInput {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly surface?: string;
  readonly paywallId?: string | null;
  readonly title?: string;
}

/** Public searchable metadata service for durable Pi sessions. */
export interface AgentSessionIndexServiceShape {
  readonly touch: (
    input: AgentSessionTouchInput,
  ) => Effect.Effect<
    AgentSessionSummary,
    AgentSessionIndexServiceError | AgentSessionForbiddenError,
    AuthSession
  >;
  readonly list: (input: {
    readonly organizationId: string;
    readonly projectId: string;
    readonly surface: string;
    readonly paywallId?: string | null;
  }) => Effect.Effect<
    ReadonlyArray<AgentSessionSummary>,
    AgentSessionIndexServiceError | AgentSessionForbiddenError,
    AuthSession
  >;
  readonly get: (input: {
    readonly sessionId: string;
  }) => Effect.Effect<
    AgentSessionSummary,
    AgentSessionIndexServiceError | AgentSessionForbiddenError | AgentSessionNotFoundError,
    AuthSession
  >;
  readonly delete: (input: {
    readonly sessionId: string;
  }) => Effect.Effect<
    void,
    AgentSessionIndexServiceError | AgentSessionForbiddenError | AgentSessionNotFoundError,
    AuthSession
  >;
}

const toSummary = (row: typeof voidhashAgentSession.$inferSelect): AgentSessionSummary => ({
  id: row.id,
  organizationId: row.organizationId,
  projectId: row.projectId,
  surface: row.surface,
  paywallId: row.paywallId,
  userId: row.userId,
  title: row.title,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Builds the partial column update for `touch`, carrying only the fields the
 * caller actually supplied so absent fields keep their stored value.
 */
const touchUpdate = (
  input: AgentSessionTouchInput,
): {
  readonly title?: string;
  readonly surface?: string;
  readonly paywallId?: string | null;
} => {
  const update: { title?: string; surface?: string; paywallId?: string | null } = {};
  if (input.title !== undefined) {
    update.title = input.title.slice(0, 255);
  }
  if (input.surface !== undefined) {
    update.surface = input.surface;
  }
  if (input.paywallId !== undefined) {
    update.paywallId = input.paywallId;
  }
  return update;
};

/**
 * Narrows a listing to a specific paywall (or to sessions with no paywall);
 * `undefined` means "do not filter on paywall at all".
 */
const paywallIdFilter = (paywallId: string | null | undefined) => {
  if (paywallId === undefined) {
    return undefined;
  }
  if (paywallId === null) {
    return isNull(voidhashAgentSession.paywallId);
  }
  return eq(voidhashAgentSession.paywallId, paywallId);
};

/** Searchable metadata for durable agent sessions. */
export class AgentSessionIndexService extends Context.Service<AgentSessionIndexService>()(
  "AgentSessionIndexService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const assertProjectMember = (projectId: string, organizationId: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          if (!isSessionProjectMember(session, projectId, organizationId)) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({ message: `No access to project ${projectId}.` }),
            );
          }
        });
      const currentUserId = Effect.gen(function* () {
        const session = yield* AuthSession;
        if (session.method !== "user" || session.user === null) {
          return yield* Effect.fail(
            new AgentSessionForbiddenError({ message: "Agent session history requires a user." }),
          );
        }
        return session.user.id;
      });
      const find = (sessionId: string) =>
        Effect.gen(function* () {
          const rows = yield* db
            .select()
            .from(voidhashAgentSession)
            .where(eq(voidhashAgentSession.id, sessionId))
            .limit(1);
          return rows[0];
        });
      const touch: AgentSessionIndexServiceShape["touch"] = (input) =>
        Effect.gen(function* () {
          yield* assertProjectMember(input.projectId, input.organizationId);
          const userId = yield* currentUserId;
          if (input.userId !== userId) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({
                message: `Session ${input.id} cannot be assigned to another user.`,
              }),
            );
          }
          const existing = yield* find(input.id);
          if (existing === undefined) {
            const rows = yield* db
              .insert(voidhashAgentSession)
              .values({
                id: input.id,
                organizationId: input.organizationId,
                projectId: input.projectId,
                surface: input.surface ?? "designer",
                paywallId: input.paywallId ?? null,
                userId: input.userId,
                title: (input.title ?? "New chat").slice(0, 255),
              })
              .onConflictDoNothing({ target: voidhashAgentSession.id })
              .returning();
            if (rows[0] !== undefined) return toSummary(rows[0]);
          }
          const authoritative = existing ?? (yield* find(input.id));
          if (
            authoritative === undefined ||
            authoritative.organizationId !== input.organizationId ||
            authoritative.projectId !== input.projectId ||
            authoritative.userId !== input.userId ||
            authoritative.deletedAt !== null
          ) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({
                message: `Session ${input.id} belongs to a different owner or project.`,
              }),
            );
          }
          const rows = yield* db
            .update(voidhashAgentSession)
            .set({
              ...touchUpdate(input),
              updatedAt: yield* DateTime.nowAsDate,
            })
            .where(eq(voidhashAgentSession.id, input.id))
            .returning();
          if (rows[0] === undefined) {
            return yield* Effect.fail(
              new AgentSessionIndexServiceError({
                message: `Session ${input.id} disappeared while it was updated.`,
              }),
            );
          }
          return toSummary(rows[0]);
        }).pipe(
          Effect.catchTag("EffectDrizzleQueryError", (error) =>
            Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
          ),
        );

      const list: AgentSessionIndexServiceShape["list"] = (input) =>
        Effect.gen(function* () {
          yield* assertProjectMember(input.projectId, input.organizationId);
          const userId = yield* currentUserId;
          const rows = yield* db
            .select()
            .from(voidhashAgentSession)
            .where(
              and(
                eq(voidhashAgentSession.organizationId, input.organizationId),
                eq(voidhashAgentSession.projectId, input.projectId),
                eq(voidhashAgentSession.surface, input.surface),
                eq(voidhashAgentSession.userId, userId),
                isNull(voidhashAgentSession.deletedAt),
                paywallIdFilter(input.paywallId),
              ),
            )
            .orderBy(desc(voidhashAgentSession.updatedAt), desc(voidhashAgentSession.id));
          return rows.map(toSummary);
        }).pipe(
          Effect.catchTag("EffectDrizzleQueryError", (error) =>
            Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
          ),
        );

      const get: AgentSessionIndexServiceShape["get"] = (input) =>
        Effect.gen(function* () {
          const row = yield* find(input.sessionId);
          if (row === undefined || row.deletedAt !== null) {
            return yield* Effect.fail(
              new AgentSessionNotFoundError({ sessionId: input.sessionId }),
            );
          }
          yield* assertProjectMember(row.projectId, row.organizationId);
          const userId = yield* currentUserId;
          if (row.userId !== userId) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({
                message: `Session ${input.sessionId} belongs to another user.`,
              }),
            );
          }
          return toSummary(row);
        }).pipe(
          Effect.catchTag("EffectDrizzleQueryError", (error) =>
            Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
          ),
        );

      const remove: AgentSessionIndexServiceShape["delete"] = (input) =>
        get(input).pipe(
          Effect.andThen(
            Effect.gen(function* () {
              const deletedAt = yield* DateTime.nowAsDate;
              return yield* db
                .update(voidhashAgentSession)
                .set({ deletedAt, updatedAt: deletedAt })
                .where(eq(voidhashAgentSession.id, input.sessionId));
            }),
          ),
          Effect.catchTag("EffectDrizzleQueryError", (error) =>
            Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
          ),
          Effect.asVoid,
        );

      return { touch, list, get, delete: remove };
    }),
  },
) {
  static readonly layer = Layer.effect(AgentSessionIndexService)(AgentSessionIndexService.make);
}
