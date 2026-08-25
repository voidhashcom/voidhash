/**
 * Integration tests for {@link WebhookManagerService.getDeliveriesPage}, run
 * against the real Postgres provisioned once by the suite's `globalSetup`.
 * The read under test is the keyset walk over delivery history: the cursor
 * (`after` = last delivery id) resolves to its row via `(projectId, id)`,
 * then the page is the row-value comparison
 * `(coalesce(created_at, epoch), id) < (anchor…)` ordered by
 * `coalesce(created_at, epoch) desc, id desc` — `created_at` is nullable, so
 * both sides coalesce to the epoch to keep the sort total.
 *
 * Conventions (see WebhookManagerService.integration.test.ts): webhook tables
 * have no FK to `project`, so each test walks a *synthetic per-test project*
 * (authorized via a custom session) for exact exhaustion semantics, tracks
 * every row it writes, and deletes them on exit, success or failure.
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import { WebhookManagerService } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  Db,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  eq,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

/** Builds a `Date` from epoch millis without the `new Date` global. */
const dateAt = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** Monotonic counter so ids stay unique even within one millisecond. */
let seq = 0;
const unique = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-whp-${label}-${now}-${seq++}`);

/** Fixed epoch timestamp for synthetic session rows — a constant, not a clock read. */
const EPOCH_DATE = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/**
 * A `user`-method session granting `project:all` on the synthetic per-test
 * project, mirroring how {@link CoreAuthSession} grants the fixture project.
 */
const sessionForProject = (projectId: string): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [
    {
      id: projectId,
      logo: null,
      name: "Keyset Walk Project",
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: "it-keyset-walk",
    },
  ],
  user: {
    createdAt: EPOCH_DATE,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH_DATE,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const insertEndpoint = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = yield* unique("ep");
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: 0,
      createdAt: yield* DateTime.nowAsDate,
      events: ["person.created"],
      id,
      name: "Keyset Endpoint",
      projectId,
      secret: `whsec_${id}`,
      status: WebhookEndpointStatus.Active,
      url: "https://example.test/keyset",
    });
    return id;
  });

/** Insert a delivery with a caller-controlled id and (nullable) createdAt. */
const insertDelivery = (input: {
  readonly id: string;
  readonly endpointId: string;
  readonly projectId: string;
  readonly createdAt: Date | null;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(webhookDeliveries).values({
      attemptCount: 0,
      completedAt: null,
      createdAt: input.createdAt,
      eventOccurredAt: yield* DateTime.nowAsDate,
      eventType: "person.created",
      id: input.id,
      nextAttemptAt: null,
      payload: { hello: "keyset" },
      projectId: input.projectId,
      status: WebhookDeliveryStatus.Failed,
      webhookEndpointId: input.endpointId,
    });
    return input.id;
  });

/** Delete every row the synthetic project accumulated; never fails the test. */
const cleanupProjectRows = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.projectId, projectId))
      .pipe(Effect.ignore);
    yield* db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.projectId, projectId))
      .pipe(Effect.ignore);
  });

interface DeliveryPage {
  readonly deliveryIds: ReadonlyArray<string>;
  readonly endCursorId: string | null;
  readonly hasNextPage: boolean;
}

/**
 * Follow `hasNextPage` / `endCursorId` to exhaustion, exactly like the route
 * does. Bounded so a paging bug that never terminates fails the test instead
 * of hanging it.
 */
const walkDeliveryPages = (input: {
  readonly projectId: string;
  readonly endpointId?: string;
  readonly limit: number;
}) =>
  Effect.gen(function* () {
    const svc = yield* WebhookManagerService;
    const pages: Array<DeliveryPage> = [];
    let after: string | undefined = undefined;
    for (let i = 0; i < 25; i++) {
      const page: {
        readonly deliveries: ReadonlyArray<{ readonly id: string }>;
        readonly endCursorId: string | null;
        readonly hasNextPage: boolean;
      } = yield* svc.getDeliveriesPage({
        after,
        endpointId: input.endpointId,
        limit: input.limit,
        projectId: input.projectId,
      });
      pages.push({
        deliveryIds: page.deliveries.map((delivery) => delivery.id),
        endCursorId: page.endCursorId,
        hasNextPage: page.hasNextPage,
      });
      if (!page.hasNextPage) return pages;
      if (page.endCursorId === null) return pages;
      after = page.endCursorId;
    }
    return pages;
  });

describe("WebhookManagerService.getDeliveriesPage", () => {
  test(
    "pages newest-first to exhaustion, breaking timestamp ties by id and coalescing null createdAt to the epoch",
    Effect.gen(function* () {
      const projectId = yield* unique("proj-walk");
      yield* Effect.gen(function* () {
        const endpointId = yield* insertEndpoint(projectId);
        const now = yield* Clock.currentTimeMillis;

        // Sortable, zero-padded ids so the id desc tie-break is predictable.
        const freshIds: string[] = [];
        for (let i = 0; i < 4; i++) {
          const id = yield* insertDelivery({
            createdAt: dateAt(now - i * 60_000),
            endpointId,
            id: `it-whp-walk-${now}-fresh-${4 - i}`,
            projectId,
          });
          freshIds.push(id);
        }
        const tieTime = dateAt(now - 5 * 60_000);
        const tieLow = yield* insertDelivery({
          createdAt: tieTime,
          endpointId,
          id: `it-whp-walk-${now}-tie-1`,
          projectId,
        });
        const tieHigh = yield* insertDelivery({
          createdAt: tieTime,
          endpointId,
          id: `it-whp-walk-${now}-tie-2`,
          projectId,
        });
        const nullCreatedAt = yield* insertDelivery({
          createdAt: null,
          endpointId,
          id: `it-whp-walk-${now}-null`,
          projectId,
        });

        // Distinct timestamps newest-first, then the tie pair by id desc,
        // then the epoch-coalesced null row last.
        const expected = [...freshIds, tieHigh, tieLow, nullCreatedAt];

        const pages = yield* walkDeliveryPages({ limit: 3, projectId });
        expect(pages.map((page) => page.deliveryIds.length)).toEqual([3, 3, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);
        expect(pages[0]?.endCursorId).not.toBeNull();
        expect(pages[2]?.endCursorId).toBeNull();

        const walked = pages.flatMap((page) => page.deliveryIds);
        expect(walked).toEqual(expected);
        expect(new Set(walked).size).toBe(expected.length);
      }).pipe(Effect.ensuring(cleanupProjectRows(projectId)), CoreAuthSession.authenticate(sessionForProject(projectId)));
    }).pipe(Effect.provide(WebhookManagerService.layer)),
  );

  test(
    "filters by endpointId and computes hasNextPage within the filtered set",
    Effect.gen(function* () {
      const projectId = yield* unique("proj-filter");
      yield* Effect.gen(function* () {
        const endpointA = yield* insertEndpoint(projectId);
        const endpointB = yield* insertEndpoint(projectId);
        const now = yield* Clock.currentTimeMillis;

        const aIds: string[] = [];
        for (let i = 0; i < 5; i++) {
          const id = yield* insertDelivery({
            createdAt: dateAt(now - i * 60_000),
            endpointId: endpointA,
            id: `it-whp-filter-${now}-a-${5 - i}`,
            projectId,
          });
          aIds.push(id);
        }
        const bId = yield* insertDelivery({
          createdAt: dateAt(now - 30_000),
          endpointId: endpointB,
          id: `it-whp-filter-${now}-b-1`,
          projectId,
        });

        const pages = yield* walkDeliveryPages({
          endpointId: endpointA,
          limit: 2,
          projectId,
        });
        expect(pages.map((page) => page.deliveryIds.length)).toEqual([2, 2, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);

        const walked = pages.flatMap((page) => page.deliveryIds);
        expect(walked).toEqual(aIds);
        // The endpoint B delivery would interleave by time; the filter keeps
        // it out of every page.
        expect(walked.includes(bId)).toBe(false);
      }).pipe(Effect.ensuring(cleanupProjectRows(projectId)), CoreAuthSession.authenticate(sessionForProject(projectId)));
    }).pipe(Effect.provide(WebhookManagerService.layer)),
  );

  test(
    "fails with ActionForbiddenError for a cursor whose row was deleted or lives in another project",
    Effect.gen(function* () {
      const projectId = yield* unique("proj-stale");
      const foreignProjectId = yield* unique("proj-stale-foreign");
      yield* Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const db = yield* Db;
        const endpointId = yield* insertEndpoint(projectId);
        const now = yield* Clock.currentTimeMillis;

        const deleted = yield* insertDelivery({
          createdAt: dateAt(now),
          endpointId,
          id: `it-whp-stale-${now}-deleted`,
          projectId,
        });
        yield* db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, deleted));

        const staleError = yield* Effect.flip(
          svc.getDeliveriesPage({ after: deleted, projectId }),
        );
        expect(staleError).toBeInstanceOf(ActionForbiddenError);
        if (staleError instanceof ActionForbiddenError) {
          expect(staleError.message).toBe("Pagination cursor no longer refers to a known item.");
        }

        // The anchor lookup is project-scoped: a live delivery from another
        // project is just as unknown to this walk.
        const foreignEndpointId = yield* insertEndpoint(foreignProjectId);
        const foreign = yield* insertDelivery({
          createdAt: dateAt(now),
          endpointId: foreignEndpointId,
          id: `it-whp-stale-${now}-foreign`,
          projectId: foreignProjectId,
        });
        const foreignError = yield* Effect.flip(
          svc.getDeliveriesPage({ after: foreign, projectId }),
        );
        expect(foreignError).toBeInstanceOf(ActionForbiddenError);
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        Effect.ensuring(cleanupProjectRows(foreignProjectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(WebhookManagerService.layer)),
  );
});
