/**
 * Integration tests for the keyset reads of {@link PushNotificationSendService}
 * — `listSendsPage` (send history, `(created_at, id)` desc; `created_at` is
 * NOT NULL here, so no epoch coalescing) and `getSendDeliveriesPage` (per-send
 * delivery trail, `(created_at, id)` asc, with the `status` label filter
 * pushed into SQL). Run against the real Postgres provisioned once by the
 * suite's `globalSetup`.
 *
 * Conventions (see NotificationsAuthorization.integration.test.ts): the push
 * tables have no FK to `project`, so each test walks a *synthetic per-test
 * project* (authorized via a custom session) for exact exhaustion semantics,
 * tracks every row it writes, and deletes them on exit, success or failure.
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import {
  PushNotificationSendNotFoundError,
  PushNotificationSendService,
} from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  Db,
  PushNotificationDeliveryStatus,
  PushNotificationSendStatus,
  eq,
  pushNotificationDeliveries,
  pushNotificationSends,
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
  Effect.map(Clock.currentTimeMillis, (now) => `it_pushp_${label}_${now}_${seq++}`);

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
      slug: "it-push-keyset-walk",
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

/** Insert a send with a caller-controlled id and createdAt (NOT NULL column). */
const insertSend = (input: {
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: Date;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(pushNotificationSends).values({
      createdAt: input.createdAt,
      deviceCount: 0,
      failedCount: 0,
      id: input.id,
      message: { body: "keyset", title: "Keyset" },
      projectId: input.projectId,
      requestedDistinctIds: [],
      requestedPersonIds: [],
      skippedCount: 0,
      status: PushNotificationSendStatus.Succeeded,
      succeededCount: 0,
      unresolvedDistinctIds: [],
    });
    return input.id;
  });

/** Insert a delivery row under a send; the device token id must be unique per send. */
const insertDelivery = (input: {
  readonly id: string;
  readonly sendId: string;
  readonly projectId: string;
  readonly createdAt: Date;
  readonly status: number;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(pushNotificationDeliveries).values({
      attemptCount: 0,
      createdAt: input.createdAt,
      id: input.id,
      maxAttempts: 5,
      personId: "person_keyset",
      projectId: input.projectId,
      provider: "fcm",
      pushDeviceTokenId: `${input.id}_token`,
      pushNotificationSendId: input.sendId,
      status: input.status,
    });
    return input.id;
  });

/** Delete every row the synthetic project accumulated; never fails the test. */
const cleanupProjectRows = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .delete(pushNotificationDeliveries)
      .where(eq(pushNotificationDeliveries.projectId, projectId))
      .pipe(Effect.ignore);
    yield* db
      .delete(pushNotificationSends)
      .where(eq(pushNotificationSends.projectId, projectId))
      .pipe(Effect.ignore);
  });

interface WalkedPage {
  readonly ids: ReadonlyArray<string>;
  readonly endCursorId: string | null;
  readonly hasNextPage: boolean;
}

/**
 * Follow `hasNextPage` / `endCursorId` to exhaustion, exactly like the route
 * does. Bounded so a paging bug that never terminates fails the test instead
 * of hanging it.
 */
const walkPages = <E, R>(
  fetchPage: (after: string | undefined) => Effect.Effect<
    {
      readonly ids: ReadonlyArray<string>;
      readonly endCursorId: string | null;
      readonly hasNextPage: boolean;
    },
    E,
    R
  >,
) =>
  Effect.gen(function* () {
    const pages: Array<WalkedPage> = [];
    let after: string | undefined = undefined;
    for (let i = 0; i < 25; i++) {
      const page: WalkedPage = yield* fetchPage(after);
      pages.push(page);
      if (!page.hasNextPage) return pages;
      if (page.endCursorId === null) return pages;
      after = page.endCursorId;
    }
    return pages;
  });

describe("PushNotificationSendService.listSendsPage", () => {
  test(
    "pages send history newest-first to exhaustion, breaking timestamp ties by id",
    Effect.gen(function* () {
      const projectId = yield* unique("proj_sends");
      yield* Effect.gen(function* () {
        const svc = yield* PushNotificationSendService;
        const now = yield* Clock.currentTimeMillis;

        // Sortable, zero-padded ids so the id desc tie-break is predictable.
        const freshIds: string[] = [];
        for (let i = 0; i < 5; i++) {
          const id = yield* insertSend({
            createdAt: dateAt(now - i * 60_000),
            id: `it_pushp_send_${now}_fresh_${5 - i}`,
            projectId,
          });
          freshIds.push(id);
        }
        const tieTime = dateAt(now - 6 * 60_000);
        const tieLow = yield* insertSend({
          createdAt: tieTime,
          id: `it_pushp_send_${now}_tie_1`,
          projectId,
        });
        const tieHigh = yield* insertSend({
          createdAt: tieTime,
          id: `it_pushp_send_${now}_tie_2`,
          projectId,
        });

        const expected = [...freshIds, tieHigh, tieLow];

        const pages = yield* walkPages((after) =>
          Effect.map(svc.listSendsPage({ after, limit: 3, projectId }), (page) => ({
            endCursorId: page.endCursorId,
            hasNextPage: page.hasNextPage,
            ids: page.sends.map((send) => send.id),
          })),
        );
        expect(pages.map((page) => page.ids.length)).toEqual([3, 3, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);
        expect(pages[0]?.endCursorId).not.toBeNull();
        expect(pages[2]?.endCursorId).toBeNull();

        const walked = pages.flatMap((page) => page.ids);
        expect(walked).toEqual(expected);
        expect(new Set(walked).size).toBe(expected.length);
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(PushNotificationSendService.layer)),
  );

  test(
    "fails with ActionForbiddenError for a cursor whose send was deleted or lives in another project",
    Effect.gen(function* () {
      const projectId = yield* unique("proj_sends_stale");
      const foreignProjectId = yield* unique("proj_sends_foreign");
      yield* Effect.gen(function* () {
        const svc = yield* PushNotificationSendService;
        const db = yield* Db;
        const now = yield* Clock.currentTimeMillis;

        const deleted = yield* insertSend({
          createdAt: dateAt(now),
          id: yield* unique("send_stale_deleted"),
          projectId,
        });
        yield* db.delete(pushNotificationSends).where(eq(pushNotificationSends.id, deleted));

        const staleError = yield* Effect.flip(svc.listSendsPage({ after: deleted, projectId }));
        expect(staleError).toBeInstanceOf(ActionForbiddenError);
        if (staleError instanceof ActionForbiddenError) {
          expect(staleError.message).toBe("Pagination cursor no longer refers to a known item.");
        }

        // The anchor lookup is project-scoped: a live send from another
        // project is just as unknown to this walk.
        const foreign = yield* insertSend({
          createdAt: dateAt(now),
          id: yield* unique("send_stale_foreign"),
          projectId: foreignProjectId,
        });
        const foreignError = yield* Effect.flip(svc.listSendsPage({ after: foreign, projectId }));
        expect(foreignError).toBeInstanceOf(ActionForbiddenError);
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        Effect.ensuring(cleanupProjectRows(foreignProjectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(PushNotificationSendService.layer)),
  );
});

describe("PushNotificationSendService.getSendDeliveriesPage", () => {
  test(
    "pages the delivery trail oldest-first to exhaustion, breaking timestamp ties by id",
    Effect.gen(function* () {
      const projectId = yield* unique("proj_trail");
      yield* Effect.gen(function* () {
        const svc = yield* PushNotificationSendService;
        const now = yield* Clock.currentTimeMillis;
        const sendId = yield* insertSend({
          createdAt: dateAt(now - 10 * 60_000),
          id: yield* unique("send_trail"),
          projectId,
        });

        const freshIds: string[] = [];
        for (let i = 0; i < 5; i++) {
          const id = yield* insertDelivery({
            createdAt: dateAt(now - (10 - i) * 60_000),
            id: `it_pushp_del_${now}_fresh_${i + 1}`,
            projectId,
            sendId,
            status: PushNotificationDeliveryStatus.Succeeded,
          });
          freshIds.push(id);
        }
        const tieTime = dateAt(now - 60_000);
        const tieLow = yield* insertDelivery({
          createdAt: tieTime,
          id: `it_pushp_del_${now}_tie_1`,
          projectId,
          sendId,
          status: PushNotificationDeliveryStatus.Succeeded,
        });
        const tieHigh = yield* insertDelivery({
          createdAt: tieTime,
          id: `it_pushp_del_${now}_tie_2`,
          projectId,
          sendId,
          status: PushNotificationDeliveryStatus.Succeeded,
        });

        // Ascending walk: oldest first, ties by id asc.
        const expected = [...freshIds, tieLow, tieHigh];

        const pages = yield* walkPages((after) =>
          Effect.map(
            svc.getSendDeliveriesPage({ after, limit: 3, projectId, sendId }),
            (page) => ({
              endCursorId: page.endCursorId,
              hasNextPage: page.hasNextPage,
              ids: page.deliveries.map((delivery) => delivery.id),
            }),
          ),
        );
        expect(pages.map((page) => page.ids.length)).toEqual([3, 3, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);
        expect(pages[2]?.endCursorId).toBeNull();

        const walked = pages.flatMap((page) => page.ids);
        expect(walked).toEqual(expected);
        expect(new Set(walked).size).toBe(expected.length);
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(PushNotificationSendService.layer)),
  );

  test(
    "filters by status in SQL and returns an empty page for an unknown status label",
    Effect.gen(function* () {
      const projectId = yield* unique("proj_status");
      yield* Effect.gen(function* () {
        const svc = yield* PushNotificationSendService;
        const now = yield* Clock.currentTimeMillis;
        const sendId = yield* insertSend({
          createdAt: dateAt(now - 10 * 60_000),
          id: yield* unique("send_status"),
          projectId,
        });

        const failedIds: string[] = [];
        const succeededIds: string[] = [];
        const statusPlan = [
          PushNotificationDeliveryStatus.Failed,
          PushNotificationDeliveryStatus.Succeeded,
          PushNotificationDeliveryStatus.Failed,
          PushNotificationDeliveryStatus.Succeeded,
          PushNotificationDeliveryStatus.Failed,
        ];
        for (let i = 0; i < statusPlan.length; i++) {
          const status = statusPlan[i]!;
          const id = yield* insertDelivery({
            createdAt: dateAt(now - (10 - i) * 60_000),
            id: `it_pushp_del_${now}_status_${i + 1}`,
            projectId,
            sendId,
            status,
          });
          if (status === PushNotificationDeliveryStatus.Failed) failedIds.push(id);
          if (status === PushNotificationDeliveryStatus.Succeeded) succeededIds.push(id);
        }

        const pages = yield* walkPages((after) =>
          Effect.map(
            svc.getSendDeliveriesPage({ after, limit: 2, projectId, sendId, status: "failed" }),
            (page) => ({
              endCursorId: page.endCursorId,
              hasNextPage: page.hasNextPage,
              ids: page.deliveries.map((delivery) => delivery.id),
            }),
          ),
        );
        expect(pages.map((page) => page.ids.length)).toEqual([2, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, false]);
        const walked = pages.flatMap((page) => page.ids);
        expect(walked).toEqual(failedIds);
        expect(walked.some((id) => succeededIds.includes(id))).toBe(false);

        // Unknown labels match no rows, mirroring the previous in-memory filter.
        const unknown = yield* svc.getSendDeliveriesPage({
          projectId,
          sendId,
          status: "bogus",
        });
        expect(unknown).toEqual({ deliveries: [], endCursorId: null, hasNextPage: false });
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(PushNotificationSendService.layer)),
  );

  test(
    "fails with ActionForbiddenError for a stale delivery cursor and with PushNotificationSendNotFoundError for a bogus send",
    Effect.gen(function* () {
      const projectId = yield* unique("proj_trail_stale");
      yield* Effect.gen(function* () {
        const svc = yield* PushNotificationSendService;
        const db = yield* Db;
        const now = yield* Clock.currentTimeMillis;
        const sendId = yield* insertSend({
          createdAt: dateAt(now - 10 * 60_000),
          id: yield* unique("send_trail_stale"),
          projectId,
        });

        const deleted = yield* insertDelivery({
          createdAt: dateAt(now - 60_000),
          id: yield* unique("del_stale_deleted"),
          projectId,
          sendId,
          status: PushNotificationDeliveryStatus.Succeeded,
        });
        yield* db
          .delete(pushNotificationDeliveries)
          .where(eq(pushNotificationDeliveries.id, deleted));

        const staleError = yield* Effect.flip(
          svc.getSendDeliveriesPage({ after: deleted, projectId, sendId }),
        );
        expect(staleError).toBeInstanceOf(ActionForbiddenError);
        if (staleError instanceof ActionForbiddenError) {
          expect(staleError.message).toBe("Pagination cursor no longer refers to a known item.");
        }

        const missingSend = yield* unique("send_missing");
        const notFound = yield* Effect.flip(
          svc.getSendDeliveriesPage({ projectId, sendId: missingSend }),
        );
        expect(notFound).toBeInstanceOf(PushNotificationSendNotFoundError);
      }).pipe(
        Effect.ensuring(cleanupProjectRows(projectId)),
        CoreAuthSession.authenticate(sessionForProject(projectId)),
      );
    }).pipe(Effect.provide(PushNotificationSendService.layer)),
  );
});
