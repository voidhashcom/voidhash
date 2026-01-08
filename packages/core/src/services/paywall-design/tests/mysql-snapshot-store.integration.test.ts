/**
 * Integration tests for mysql-snapshot-store
 *
 * Requires MySQL to be running with the schema applied.
 * Uses the integration test harness for database setup.
 */

import { paywallDesignStates, eq } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { generateId } from "@voidhash/lib";
import { Effect, Exit, Option } from "effect";
import { describe, expect, test } from "vitest";

import { createIntegrationTestRunner } from "../../../integration-test-runtime";
import { IntegrationHarness } from "../../../testing/integration-harness";
import { VersionConflictError } from "../errors";
import {
  layer as mysqlLayer,
  MySqlSnapshotStoreTag,
} from "../mysql-snapshot-store";
import { CURRENT_SCHEMA_VERSION } from "../schema-migration";

describe.sequential("mysql-snapshot-store integration", () => {
  const integrationTestRunner = createIntegrationTestRunner();

  test("should save and load design state", async (t) => {
    const h = await IntegrationHarness.init(t);
    const paywallId = generateId("test");

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        const state = { name: "Test Paywall", children: [] };

        // Save state
        const saveResult = yield* mysql.save({
          expectedVersion: 0,
          paywallId,
          redisCheckpoint: "checkpoint-1",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state,
        });

        expect(saveResult.success).toBe(true);
        expect(saveResult.newVersion).toBe(1);

        // Load state
        const loaded = yield* mysql.load(paywallId);
        expect(Option.isSome(loaded)).toBe(true);

        if (Option.isSome(loaded)) {
          expect(loaded.value.state).toEqual(state);
          expect(loaded.value.version).toBe(1);
          expect(loaded.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
          expect(loaded.value.redisCheckpoint).toBe("checkpoint-1");
        }

        return { loaded, saveResult };
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);

    // Cleanup
    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallDesignStates)
        .where(eq(paywallDesignStates.paywallId, paywallId));
    });
  });

  test("should update existing state with version increment", async (t) => {
    const h = await IntegrationHarness.init(t);
    const paywallId = generateId("test");

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        // Insert initial state
        yield* mysql.save({
          expectedVersion: 0,
          paywallId,
          redisCheckpoint: "cp-1",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state: { name: "V1" },
        });

        // Update state
        const updateResult = yield* mysql.save({
          expectedVersion: 1,
          paywallId,
          redisCheckpoint: "cp-2",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state: { name: "V2" },
        });

        expect(updateResult.success).toBe(true);
        expect(updateResult.newVersion).toBe(2);

        // Verify update
        const loaded = yield* mysql.load(paywallId);
        expect(Option.isSome(loaded)).toBe(true);

        if (Option.isSome(loaded)) {
          expect(loaded.value.state).toEqual({ name: "V2" });
          expect(loaded.value.version).toBe(2);
        }

        return updateResult;
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallDesignStates)
        .where(eq(paywallDesignStates.paywallId, paywallId));
    });
  });

  test("should fail with VersionConflictError on version mismatch", async (t) => {
    const h = await IntegrationHarness.init(t);
    const paywallId = generateId("test");

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        // Insert initial state at v1
        yield* mysql.save({
          expectedVersion: 0,
          paywallId,
          redisCheckpoint: "cp-1",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state: { name: "V1" },
        });

        // Try to update with wrong expected version
        const conflictResult = yield* mysql
          .save({
            expectedVersion: 0, // Wrong! Should be 1
            paywallId,
            redisCheckpoint: "cp-2",
            schemaVersion: CURRENT_SCHEMA_VERSION,
            state: { name: "V2" },
          })
          .pipe(Effect.either);

        expect(conflictResult._tag).toBe("Left");
        if (conflictResult._tag === "Left") {
          expect(conflictResult.left._tag).toBe("VersionConflictError");
          const error = conflictResult.left as VersionConflictError;
          expect(error.expectedVersion).toBe(0);
          expect(error.actualVersion).toBe(1);
        }

        return conflictResult;
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallDesignStates)
        .where(eq(paywallDesignStates.paywallId, paywallId));
    });
  });

  test("should soft delete and restore state", async (t) => {
    const h = await IntegrationHarness.init(t);
    const paywallId = generateId("test");

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        // Insert state
        yield* mysql.save({
          expectedVersion: 0,
          paywallId,
          redisCheckpoint: "cp-1",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state: { name: "Test" },
        });

        // Verify exists
        const beforeDelete = yield* mysql.load(paywallId);
        expect(Option.isSome(beforeDelete)).toBe(true);

        // Soft delete
        yield* mysql.softDelete(paywallId);

        // Verify not loadable
        const afterDelete = yield* mysql.load(paywallId);
        expect(Option.isNone(afterDelete)).toBe(true);

        // Restore
        yield* mysql.restore(paywallId);

        // Verify loadable again
        const afterRestore = yield* mysql.load(paywallId);
        expect(Option.isSome(afterRestore)).toBe(true);

        return { afterDelete, afterRestore, beforeDelete };
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallDesignStates)
        .where(eq(paywallDesignStates.paywallId, paywallId));
    });
  });

  test("should return None for non-existent paywall", async (t) => {
    const h = await IntegrationHarness.init(t);
    const nonExistentId = "non-existent-paywall-id";

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        const loaded = yield* mysql.load(nonExistentId);
        expect(Option.isNone(loaded)).toBe(true);

        return loaded;
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);
  });

  test("should handle large state objects", async (t) => {
    const h = await IntegrationHarness.init(t);
    const paywallId = generateId("test");

    const largeState = {
      name: "Large Paywall",
      children: Array.from({ length: 200 }, (_, i) => ({
        id: `node-${i}`,
        name: `Node ${i}`,
        style: {
          backgroundColor: "#ffffff",
          height: 100 + i,
          width: 200 + i,
        },
        type: "element",
      })),
    };

    const result = await integrationTestRunner(
      Effect.gen(function* () {
        const mysql = yield* MySqlSnapshotStoreTag;

        yield* mysql.save({
          expectedVersion: 0,
          paywallId,
          redisCheckpoint: "cp-1",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state: largeState,
        });

        const loaded = yield* mysql.load(paywallId);
        expect(Option.isSome(loaded)).toBe(true);

        if (Option.isSome(loaded)) {
          expect(loaded.value.state).toEqual(largeState);
        }

        return loaded;
      }).pipe(Effect.provide(mysqlLayer), Effect.provide(Db.Default))
    );

    expect(Exit.isSuccess(result)).toBe(true);

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallDesignStates)
        .where(eq(paywallDesignStates.paywallId, paywallId));
    });
  });
});
