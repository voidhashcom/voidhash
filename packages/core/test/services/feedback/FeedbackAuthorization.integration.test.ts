import { FeedbackService, FeedbackServiceLive } from "@voidhash/core/services";
import { Db, inArray, voidhashFeedback } from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { Effect } from "effect";
import { expect } from "vitest";

const { test } = CoreIntegrationTestHarness.make();
const createdIds: string[] = [];

test(
  "feedback identity and tenant attribution come only from the authenticated session",
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* FeedbackService;

    const derived = yield* service.submit({
      message: "Project context",
      organizationId: "forged-organization",
      pathname: "/studio",
      projectId: CoreTestFixture.projectId,
      sentiment: null,
      topic: "other",
      userAgent: null,
    });
    createdIds.push(derived.id);

    const rejected = yield* service.submit({
      message: "Forged context",
      organizationId: "forged-organization",
      pathname: null,
      projectId: "forged-project",
      sentiment: null,
      topic: "other",
      userAgent: null,
    });
    createdIds.push(rejected.id);

    const rows = yield* db
      .select()
      .from(voidhashFeedback)
      .where(inArray(voidhashFeedback.id, [derived.id, rejected.id]));
    const derivedRow = rows.find((row) => row.id === derived.id);
    const rejectedRow = rows.find((row) => row.id === rejected.id);

    expect(derivedRow).toMatchObject({
      organizationId: CoreTestFixture.organizationId,
      projectId: CoreTestFixture.projectId,
      userEmail: CoreTestFixture.userEmail,
      userId: CoreTestFixture.userId,
      userName: CoreTestFixture.userName,
    });
    expect(rejectedRow).toMatchObject({
      organizationId: null,
      projectId: null,
      userEmail: CoreTestFixture.userEmail,
      userId: CoreTestFixture.userId,
      userName: CoreTestFixture.userName,
    });
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        if (createdIds.length === 0) return;
        const db = yield* Db;
        yield* db
          .delete(voidhashFeedback)
          .where(inArray(voidhashFeedback.id, createdIds))
          .pipe(Effect.ignore);
      }),
    ),
    Effect.provide(
      FeedbackServiceLive({
        botToken: Effect.succeed(""),
      }),
    ),
    CoreAuthSession.authenticate(),
  ),
);
