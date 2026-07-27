/**
 * WorkOS webhook endpoint — `POST /api/webhooks/workos`.
 *
 * WorkOS is the source of truth for users and organizations. The handler
 * verifies the WorkOS signature, persists the raw event for idempotency, and
 * applies public user/organization mutations locally. Optional multi-user
 * membership projection is delegated through an extension port.
 *
 * - Bad signature → 400.
 * - Idempotent duplicate (same `event.id` already recorded) → 200.
 * - Processing failure → 500 (WorkOS retries on the same `event.id`).
 */
import type {
  Event as WorkosEvent,
  Organization as WorkosOrganization,
  User as WorkosUser,
} from "@workos-inc/node";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { Workos } from "@voidhash/core/services/auth/Workos";
import { OrganizationMembershipWebhookPort } from "@voidhash/core/services/organizations/OrganizationMembershipWebhookPort";
import { generateId } from "@voidhash/core/utils";
import {
  Db,
  eq,
  organization,
  user,
  workosWebhookEvents,
  type InsertOrganization,
  type InsertWorkosWebhookEvent,
} from "@voidhash/db";
import { Cause, Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

type DbService = Context.Service.Shape<typeof Db>;
type WorkosShape = Context.Service.Shape<typeof Workos>;
type LocalUserSessionShape = Context.Service.Shape<typeof LocalUserSessionService>;
type MembershipWebhookShape = Context.Service.Shape<typeof OrganizationMembershipWebhookPort>;

class WebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookProcessingError";
  }
}

const describeFailure = (failure: unknown): string => {
  const message = failure instanceof Error ? failure.message : String(failure);
  const cause = (failure as { readonly cause?: unknown } | null)?.cause;
  if (!cause) return message;
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : (() => {
          try {
            return typeof cause === "object" ? JSON.stringify(cause) : String(cause);
          } catch {
            return String(cause);
          }
        })();
  return causeMessage && causeMessage !== message ? `${message}: ${causeMessage}` : message;
};

const recordWebhookReceived = (db: DbService, event: InsertWorkosWebhookEvent) =>
  db.insert(workosWebhookEvents).values(event);

const findWebhookRecordByExternalId = (db: DbService, externalEventId: string) =>
  db.query.workosWebhookEvents.findFirst({
    where: { externalEventId },
  });

const refreshWebhookRecordForRetry = (
  db: DbService,
  input: Pick<InsertWorkosWebhookEvent, "eventType" | "payload"> & { readonly id: string },
) =>
  db
    .update(workosWebhookEvents)
    .set({
      error: null,
      eventType: input.eventType,
      payload: input.payload,
    })
    .where(eq(workosWebhookEvents.id, input.id));

const markWebhookProcessed = (db: DbService, id: string) =>
  db
    .update(workosWebhookEvents)
    .set({ error: null, processedAt: new Date() })
    .where(eq(workosWebhookEvents.id, id));

const markWebhookError = (db: DbService, id: string, error: string) =>
  db.update(workosWebhookEvents).set({ error }).where(eq(workosWebhookEvents.id, id));

const isOrganizationEvent = (
  e: WorkosEvent,
): e is Extract<WorkosEvent, { event: `organization.${string}` }> =>
  e.event === "organization.created" ||
  e.event === "organization.updated" ||
  e.event === "organization.deleted";

const isMembershipEvent = (
  e: WorkosEvent,
): e is Extract<WorkosEvent, { event: `organization_membership.${string}` }> =>
  e.event === "organization_membership.created" ||
  e.event === "organization_membership.updated" ||
  e.event === "organization_membership.deleted";

const isUserEvent = (e: WorkosEvent): e is Extract<WorkosEvent, { event: `user.${string}` }> =>
  e.event === "user.created" || e.event === "user.updated" || e.event === "user.deleted";

const upsertOrganizationFromWorkos = (db: DbService, org: WorkosOrganization) =>
  Effect.gen(function* () {
    const existing = yield* db.query.organization.findFirst({
      where: { workosOrganizationId: org.id },
    });
    if (existing) {
      yield* db
        .update(organization)
        .set({ name: org.name })
        .where(eq(organization.workosOrganizationId, org.id));
      return;
    }

    // `externalId` carries the local id we stamped on WorkOS at create time.
    // Re-link a row that already exists under that id (a direct existence
    // check, not a length heuristic); never adopt the external id as a fresh
    // primary key, so a foreign external id can't leak into ours.
    if (org.externalId) {
      const existingByExternalId = yield* db.query.organization.findFirst({
        where: { id: org.externalId },
      });
      if (existingByExternalId) {
        yield* db
          .update(organization)
          .set({ name: org.name, workosOrganizationId: org.id })
          .where(eq(organization.id, existingByExternalId.id));
        return;
      }
    }

    // We weren't the creator (e.g., org created in the WorkOS Admin Portal
    // directly). Mint a local row from scratch with our own generated id.
    const newOrg: InsertOrganization = {
      createdAt: new Date(),
      id: generateId("organization"),
      logo: null,
      metadata: null,
      name: org.name,
      slug: `${(org.externalId ?? org.id).slice(0, 12)}-${crypto.randomUUID().slice(0, 6)}`,
      workosOrganizationId: org.id,
    };
    yield* db.insert(organization).values(newOrg);
  });

const deleteOrganizationByWorkosId = (db: DbService, workosOrganizationId: string) =>
  db.delete(organization).where(eq(organization.workosOrganizationId, workosOrganizationId));

const deleteUserByWorkosUser = (db: DbService, workosUser: WorkosUser) =>
  Effect.gen(function* () {
    const existing = yield* db.query.user.findFirst({
      where: { workosUserId: workosUser.id },
    });
    if (existing) {
      yield* db.delete(user).where(eq(user.id, existing.id));
      return;
    }
    yield* db.delete(user).where(eq(user.email, workosUser.email));
  });

const processEvent = (
  db: DbService,
  workosAuth: WorkosShape,
  localUserSessions: LocalUserSessionShape,
  membershipWebhooks: MembershipWebhookShape,
  event: WorkosEvent,
): Effect.Effect<void, unknown, Db> => {
  if (isOrganizationEvent(event)) {
    if (event.event === "organization.deleted") {
      return deleteOrganizationByWorkosId(db, event.data.id);
    }
    return upsertOrganizationFromWorkos(db, event.data);
  }
  if (isMembershipEvent(event)) {
    if (event.event === "organization_membership.deleted") {
      return membershipWebhooks.processEvent({
        _tag: "Delete",
        externalMembershipId: event.data.id,
      });
    }
    const role =
      typeof event.data.role === "string"
        ? event.data.role
        : (event.data.role?.slug ?? "member");
    return membershipWebhooks.processEvent({
      _tag: "Upsert",
      membership: {
        externalId: event.data.id,
        externalOrganizationId: event.data.organizationId,
        externalUserId: event.data.userId,
        role,
      },
    });
  }
  if (isUserEvent(event)) {
    if (event.event === "user.deleted") {
      return deleteUserByWorkosUser(db, event.data);
    }
    return localUserSessions.resolveLocalUser(event.data).pipe(Effect.asVoid);
  }
  return Effect.void;
};

const handleWebhook = Effect.gen(function* () {
  const db = yield* Db;
  const workosAuth = yield* Workos;
  const localUserSessions = yield* LocalUserSessionService;
  const membershipWebhooks = yield* OrganizationMembershipWebhookPort;
  const request = yield* HttpServerRequest.HttpServerRequest;

  const rawBody = yield* request.text;
  const signatureHeader = request.headers["workos-signature"] ?? "";

  if (!signatureHeader) {
    return yield* HttpServerResponse.json(
      { error: "Missing workos-signature header" },
      { status: 400 },
    );
  }

  const event = yield* workosAuth.verifyWebhook({ rawBody, signatureHeader }).pipe(
    Effect.catch((error) => {
      // Surface the underlying SDK reason (e.g. "Signature hash does not match
      // …", "Timestamp outside the tolerance zone") rather than the generic
      // wrapper message, so signature/secret problems are diagnosable.
      const detail =
        error.cause instanceof Error ? error.cause.message : String(error.cause ?? error.message);
      return Effect.logError(`WorkOS webhook signature verification failed: ${detail}`).pipe(
        Effect.andThen(Effect.fail(new WebhookProcessingError(detail))),
      );
    }),
  );

  const rowId = generateId("workosWebhookEvent");
  const insertResult = yield* Effect.result(
    recordWebhookReceived(db, {
      createdAt: new Date(),
      eventType: event.event,
      externalEventId: event.id,
      id: rowId,
      payload: event as unknown as object,
    }),
  );

  let eventRowId: string = rowId;
  if (insertResult._tag === "Failure") {
    const existing = yield* findWebhookRecordByExternalId(db, event.id);
    if (!existing) {
      const message = describeFailure(insertResult.failure);
      return yield* Effect.fail(new WebhookProcessingError(message));
    }

    if (existing.processedAt) {
      yield* Effect.logInfo(`WorkOS webhook ${event.id} already processed; skipping`);
      return yield* HttpServerResponse.json({ received: true, duplicate: true });
    }

    eventRowId = existing.id;
    yield* refreshWebhookRecordForRetry(db, {
      eventType: event.event,
      id: existing.id,
      payload: event as unknown as object,
    });
  }

  const processed = yield* Effect.result(
    processEvent(db, workosAuth, localUserSessions, membershipWebhooks, event),
  );
  if (processed._tag === "Failure") {
    const message = describeFailure(processed.failure);
    yield* markWebhookError(db, eventRowId, message.slice(0, 500)).pipe(
      Effect.catch(() => Effect.void),
    );
    return yield* Effect.fail(new WebhookProcessingError(message));
  }

  yield* markWebhookProcessed(db, eventRowId);
  return yield* HttpServerResponse.json({ received: true });
});

const registerWorkosWebhookRoute = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* router.add(
    "POST",
    "/api/webhooks/workos",
    handleWebhook.pipe(
      // catchCause (not catch) so defects — a raw driver/crypto throw, not just
      // the typed error channel — are logged with their full cause instead of
      // escaping the worker as an opaque exception ("[object Object]").
      Effect.catchCause((cause) =>
        Effect.gen(function* () {
          // Stringify the cause into the message — passing the cause object as a
          // second arg renders as "[object Object]" in the Workers log pipeline.
          yield* Effect.logError(`WorkOS webhook error: ${Cause.pretty(cause)}`);
          return yield* HttpServerResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 },
          );
        }),
      ),
    ),
  );
});

export const WorkosWebhookRouteLayer = Layer.effectDiscard(registerWorkosWebhookRoute);
