/**
 * `EventAdmissionService` is the read/write surface for a project's event
 * admission policy — the built-in registry overrides and the custom-event
 * blocklist stored on `capture_project_policy`.
 *
 * The registry and its defaults live in code
 * (`@voidhash/core-v2`); the database only ever holds explicit
 * overrides. Which defaults apply depends on the edition, which is fixed at
 * layer construction: self-hosted runtimes take the default `"oss"` build, the
 * hosted runtime builds `EventAdmissionService.layer("cloud")`.
 *
 * `AuthSession` and `Db` are provided by the application root; every method is
 * authorized against the caller's project permissions.
 */
import { constant, pick } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";

import { captureProjectPolicies, Db, eq } from "@voidhash/db";

import {
  AnalyticsEdition,
  emptyEventAdmissionPolicy,
  EventAdmissionPolicy,
  isBuiltinEventAdmissionKey,
  normalizeCustomEventName,
  resolveBuiltinEventAdmissionList,
  type ResolvedBuiltinEventAdmission,
} from "@voidhash/core-v2";
import { checkProjectPermission } from "@voidhash/core/utils/permissions";

/** Tagged error raised by {@link EventAdmissionService} public methods. */
export class EventAdmissionServiceError extends Schema.TaggedErrorClass<EventAdmissionServiceError>(
  "EventAdmissionServiceError",
)("EventAdmissionServiceError", { message: Schema.String }) {}

/** A project's admission policy resolved against the running edition's defaults. */
export interface ResolvedEventAdmissionPolicy {
  readonly builtinEvents: readonly ResolvedBuiltinEventAdmission[];
  readonly customEventBlocklist: readonly string[];
}

const mapDbError = (error: { readonly cause: unknown }) =>
  Effect.fail(new EventAdmissionServiceError({ message: String(error.cause) }));

const makeEventAdmissionService = (edition: typeof AnalyticsEdition.Type) =>
  Effect.gen(function* () {
    const db = yield* Db;

    /** The project's stored overrides, or the empty policy when it has no row yet. */
    const loadPolicy = (projectId: string) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .select({
            builtinEventOverrides: captureProjectPolicies.builtinEventOverrides,
            customEventBlocklist: captureProjectPolicies.customEventBlocklist,
          })
          .from(captureProjectPolicies)
          .where(eq(captureProjectPolicies.projectId, projectId))
          .limit(1);
        if (!row) return emptyEventAdmissionPolicy;
        return {
          builtinEventOverrides: row.builtinEventOverrides,
          customEventBlocklist: row.customEventBlocklist,
        } satisfies typeof EventAdmissionPolicy.Type;
      });

    const resolve = (policy: typeof EventAdmissionPolicy.Type) =>
      ({
        builtinEvents: resolveBuiltinEventAdmissionList({ edition, policy }),
        customEventBlocklist: policy.customEventBlocklist,
      }) satisfies ResolvedEventAdmissionPolicy;

    /**
     * Persist a new policy for the project. A project only gets a
     * `capture_project_policy` row once something diverges from the defaults, so
     * the first write inserts it.
     */
    const savePolicy = (projectId: string, policy: typeof EventAdmissionPolicy.Type) =>
      db
        .insert(captureProjectPolicies)
        .values({
          projectId,
          builtinEventOverrides: policy.builtinEventOverrides,
          customEventBlocklist: policy.customEventBlocklist,
        })
        .onConflictDoUpdate({
          target: captureProjectPolicies.projectId,
          set: {
            builtinEventOverrides: policy.builtinEventOverrides,
            customEventBlocklist: policy.customEventBlocklist,
          },
        });

    const authorize = (projectId: string, action: string) =>
      checkProjectPermission(
        projectId,
        "project:all",
        `Not authorized to ${action} the event admission policy for project ${projectId}`,
      );

    const getPolicy = Effect.fn("getPolicy")(
      function* (projectId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* authorize(projectId, "read");
        return resolve(yield* loadPolicy(projectId));
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
    );

    const setBuiltinEventEnabled = Effect.fn("setBuiltinEventEnabled")(
      function* (input: {
        readonly projectId: string;
        readonly key: string;
        readonly enabled: boolean;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* authorize(input.projectId, "update");
        if (!isBuiltinEventAdmissionKey(input.key)) {
          return yield* Effect.fail(
            new EventAdmissionServiceError({ message: `Unknown built-in event: ${input.key}` }),
          );
        }
        const policy = yield* loadPolicy(input.projectId);
        const next = {
          builtinEventOverrides: { ...policy.builtinEventOverrides, [input.key]: input.enabled },
          customEventBlocklist: policy.customEventBlocklist,
        } satisfies typeof EventAdmissionPolicy.Type;
        yield* savePolicy(input.projectId, next);
        return resolve(next);
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
    );

    const setCustomEventBlocked = Effect.fn("setCustomEventBlocked")(
      function* (input: {
        readonly projectId: string;
        readonly eventName: string;
        readonly blocked: boolean;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* authorize(input.projectId, "update");
        const eventName = normalizeCustomEventName(input.eventName);
        if (!eventName) {
          return yield* Effect.fail(
            new EventAdmissionServiceError({
              message:
                "Only custom event names can be blocked; reserved ($-prefixed) events are toggled in the built-in list.",
            }),
          );
        }
        const policy = yield* loadPolicy(input.projectId);
        const withoutName = policy.customEventBlocklist.filter((name) => name !== eventName);
        const next = {
          builtinEventOverrides: policy.builtinEventOverrides,
          customEventBlocklist: pick(input.blocked, [...withoutName, eventName], withoutName),
        } satisfies typeof EventAdmissionPolicy.Type;
        yield* savePolicy(input.projectId, next);
        return resolve(next);
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
    );

    return constant({ getPolicy, setBuiltinEventEnabled, setCustomEventBlocked });
  });

export class EventAdmissionService extends Context.Service<EventAdmissionService>()(
  "EventAdmissionService",
  // Default: the self-hosted registry defaults. The hosted app root overrides
  // this with `EventAdmissionService.layer("cloud")`.
  { make: makeEventAdmissionService("oss") },
) {
  /**
   * Build the service for a specific edition. The edition decides which registry
   * defaults apply to entries the project has never overridden.
   */
  static layer = (edition: typeof AnalyticsEdition.Type) =>
    Layer.effect(EventAdmissionService)(makeEventAdmissionService(edition));
}
