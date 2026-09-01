import { and, desc, Db, eq, isNull, voidhashAgentSession } from "@voidhash/db";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
  readonly paywallId: Option.Option<string>;
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
  readonly surface: Option.Option<string>;
  readonly paywallId: Option.Option<Option.Option<string>>;
  readonly title: Option.Option<string>;
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
    readonly paywallId: Option.Option<Option.Option<string>>;
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
  paywallId: Option.fromNullishOr(row.paywallId),
  userId: row.userId,
  title: row.title,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Builds the partial column update for `touch`, carrying only the fields the
 * caller actually supplied so absent fields keep their stored value.
 */
const touchUpdate = (input: AgentSessionTouchInput) => ({
  ...Option.match(input.title, {
    onNone: () => ({}),
    onSome: (title) => ({ title: title.slice(0, 255) }),
  }),
  ...Option.match(input.surface, {
    onNone: () => ({}),
    onSome: (surface) => ({ surface }),
  }),
  ...Option.match(input.paywallId, {
    onNone: () => ({}),
    onSome: (paywallId) => ({ paywallId: Option.getOrNull(paywallId) }),
  }),
});

/**
 * Narrows a listing to a specific paywall (or to sessions with no paywall);
 * Outer `None` means "do not filter on paywall at all"; inner `None` selects
 * sessions with no paywall.
 */
const paywallIdFilter = (paywallId: Option.Option<Option.Option<string>>) =>
  Option.map(paywallId, (selected) =>
    Option.match(selected, {
      onNone: () => isNull(voidhashAgentSession.paywallId),
      onSome: (id) => eq(voidhashAgentSession.paywallId, id),
    }),
  );

/** Searchable metadata for durable agent sessions. */
export class AgentSessionIndexService extends Context.Service<AgentSessionIndexService>()(
  "AgentSessionIndexService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const assertProjectMember = Effect.fn("AgentSessionIndexService.assertProjectMember")(
        function* (projectId: string, organizationId: string) {
          const session = yield* AuthSession;
          if (!isSessionProjectMember(session, projectId, organizationId)) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({ message: `No access to project ${projectId}.` }),
            );
          }
        },
      );
      const currentUserId = Effect.fn("AgentSessionIndexService.currentUserId")(function* () {
        const session = yield* AuthSession;
        if (session.method !== "user" || session.user === null) {
          return yield* Effect.fail(
            new AgentSessionForbiddenError({ message: "Agent session history requires a user." }),
          );
        }
        return session.user.id;
      });
      const find = Effect.fn("AgentSessionIndexService.find")(function* (sessionId: string) {
        const rows = yield* db
          .select()
          .from(voidhashAgentSession)
          .where(eq(voidhashAgentSession.id, sessionId))
          .limit(1);
        return Arr.head(rows);
      });
      const touch: AgentSessionIndexServiceShape["touch"] = Effect.fn(
        "AgentSessionIndexService.touch",
      )(
        function* (input) {
          yield* assertProjectMember(input.projectId, input.organizationId);
          const userId = yield* currentUserId();
          if (input.userId !== userId) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({
                message: `Session ${input.id} cannot be assigned to another user.`,
              }),
            );
          }
          const existing = yield* find(input.id);
          if (Option.isNone(existing)) {
            const rows = yield* db
              .insert(voidhashAgentSession)
              .values({
                id: input.id,
                organizationId: input.organizationId,
                projectId: input.projectId,
                surface: Option.getOrElse(input.surface, () => "designer"),
                paywallId: Option.getOrNull(Option.flatten(input.paywallId)),
                userId: input.userId,
                title: Option.getOrElse(input.title, () => "New chat").slice(0, 255),
              })
              .onConflictDoNothing({ target: voidhashAgentSession.id })
              .returning();
            const inserted = Arr.head(rows);
            if (Option.isSome(inserted)) return toSummary(inserted.value);
          }
          const authoritative = Option.isSome(existing) ? existing : yield* find(input.id);
          if (
            Option.isNone(authoritative) ||
            authoritative.value.organizationId !== input.organizationId ||
            authoritative.value.projectId !== input.projectId ||
            authoritative.value.userId !== input.userId ||
            authoritative.value.deletedAt !== null
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
          const updated = Arr.head(rows);
          if (Option.isNone(updated)) {
            return yield* Effect.fail(
              new AgentSessionIndexServiceError({
                message: `Session ${input.id} disappeared while it was updated.`,
              }),
            );
          }
          return toSummary(updated.value);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
            ),
          ),
      );

      const list: AgentSessionIndexServiceShape["list"] = Effect.fn(
        "AgentSessionIndexService.list",
      )(
        function* (input) {
          yield* assertProjectMember(input.projectId, input.organizationId);
          const userId = yield* currentUserId();
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
                Option.getOrUndefined(paywallIdFilter(input.paywallId)),
              ),
            )
            .orderBy(desc(voidhashAgentSession.updatedAt), desc(voidhashAgentSession.id));
          return rows.map(toSummary);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
            ),
          ),
      );

      const get: AgentSessionIndexServiceShape["get"] = Effect.fn("AgentSessionIndexService.get")(
        function* (input) {
          const row = yield* find(input.sessionId);
          if (Option.isNone(row) || row.value.deletedAt !== null) {
            return yield* Effect.fail(
              new AgentSessionNotFoundError({ sessionId: input.sessionId }),
            );
          }
          yield* assertProjectMember(row.value.projectId, row.value.organizationId);
          const userId = yield* currentUserId();
          if (row.value.userId !== userId) {
            return yield* Effect.fail(
              new AgentSessionForbiddenError({
                message: `Session ${input.sessionId} belongs to another user.`,
              }),
            );
          }
          return toSummary(row.value);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTag("EffectDrizzleQueryError", (error) =>
              Effect.fail(new AgentSessionIndexServiceError({ message: String(error.cause) })),
            ),
          ),
      );

      const remove: AgentSessionIndexServiceShape["delete"] = (input) =>
        get(input).pipe(
          Effect.andThen(
            Effect.fn("AgentSessionIndexService.delete")(function* () {
              const deletedAt = yield* DateTime.nowAsDate;
              return yield* db
                .update(voidhashAgentSession)
                .set({ deletedAt, updatedAt: deletedAt })
                .where(eq(voidhashAgentSession.id, input.sessionId));
            })(),
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
