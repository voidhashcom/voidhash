/**
 * Unit tests for schema-migration
 */

import { Effect, Exit } from "effect";
import { describe, expect, test } from "vitest";

import {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  migrateState,
  migrateStateSync,
  needsMigration,
  wrapWithVersion,
  type VersionedState,
} from "../schema-migration";

describe("schema-migration", () => {
  describe("CURRENT_SCHEMA_VERSION", () => {
    test("should be a positive integer", () => {
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
    });
  });

  describe("needsMigration", () => {
    test("should return true for version 0", () => {
      expect(needsMigration(0)).toBe(true);
    });

    test("should return false for current version", () => {
      expect(needsMigration(CURRENT_SCHEMA_VERSION)).toBe(false);
    });

    test("should return true for versions below current", () => {
      if (CURRENT_SCHEMA_VERSION > 1) {
        expect(needsMigration(CURRENT_SCHEMA_VERSION - 1)).toBe(true);
      }
    });

    test("should return false for versions at or above current", () => {
      expect(needsMigration(CURRENT_SCHEMA_VERSION)).toBe(false);
      expect(needsMigration(CURRENT_SCHEMA_VERSION + 1)).toBe(false);
    });
  });

  describe("wrapWithVersion", () => {
    test("should wrap state with current schema version", () => {
      const state = { name: "Test", children: [] };
      const wrapped = wrapWithVersion(state);

      expect(wrapped).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        state,
      });
    });

    test("should handle null state", () => {
      const wrapped = wrapWithVersion(null);
      expect(wrapped).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        state: null,
      });
    });

    test("should handle primitive state", () => {
      const wrapped = wrapWithVersion("simple string");
      expect(wrapped).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        state: "simple string",
      });
    });
  });

  describe("getSchemaVersion", () => {
    test("should return 0 for legacy unversioned state", () => {
      const legacyState = { name: "Legacy", children: [] };
      expect(getSchemaVersion(legacyState)).toBe(0);
    });

    test("should return 0 for null", () => {
      expect(getSchemaVersion(null)).toBe(0);
    });

    test("should return 0 for undefined", () => {
      expect(getSchemaVersion(undefined)).toBe(0);
    });

    test("should extract version from versioned state", () => {
      const versionedState: VersionedState = {
        schemaVersion: 5,
        state: { name: "Test" },
      };
      expect(getSchemaVersion(versionedState)).toBe(5);
    });

    test("should extract version 1 from versioned state", () => {
      const versionedState: VersionedState = {
        schemaVersion: 1,
        state: { name: "Test" },
      };
      expect(getSchemaVersion(versionedState)).toBe(1);
    });
  });

  describe("migrateState (Effect)", () => {
    test("should handle legacy unversioned state (v0)", async () => {
      const legacyState = { name: "Legacy", children: [] };

      const result = await Effect.runPromiseExit(migrateState(legacyState));

      expect(Exit.isSuccess(result)).toBe(true);
      if (Exit.isSuccess(result)) {
        // At v1, state should be unchanged
        expect(result.value).toEqual(legacyState);
      }
    });

    test("should handle already current state", async () => {
      const currentState: VersionedState = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        state: { name: "Current", children: [] },
      };

      const result = await Effect.runPromiseExit(migrateState(currentState));

      expect(Exit.isSuccess(result)).toBe(true);
      if (Exit.isSuccess(result)) {
        expect(result.value).toEqual(currentState.state);
      }
    });

    test("should extract state from versioned wrapper", async () => {
      const innerState = { name: "Inner", children: [] };
      const versionedState: VersionedState = {
        schemaVersion: 1,
        state: innerState,
      };

      const result = await Effect.runPromiseExit(migrateState(versionedState));

      expect(Exit.isSuccess(result)).toBe(true);
      if (Exit.isSuccess(result)) {
        expect(result.value).toEqual(innerState);
      }
    });

    test("should handle null state", async () => {
      const result = await Effect.runPromiseExit(migrateState(null));

      expect(Exit.isSuccess(result)).toBe(true);
      if (Exit.isSuccess(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("migrateStateSync", () => {
    test("should handle legacy unversioned state (v0)", () => {
      const legacyState = { name: "Legacy", children: [] };
      const result = migrateStateSync(legacyState);

      // At v1, state should be unchanged
      expect(result).toEqual(legacyState);
    });

    test("should handle already current state", () => {
      const currentState: VersionedState = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        state: { name: "Current", children: [] },
      };

      const result = migrateStateSync(currentState);
      expect(result).toEqual(currentState.state);
    });

    test("should extract state from versioned wrapper", () => {
      const innerState = { name: "Inner", children: [] };
      const versionedState: VersionedState = {
        schemaVersion: 1,
        state: innerState,
      };

      const result = migrateStateSync(versionedState);
      expect(result).toEqual(innerState);
    });

    test("should handle null state", () => {
      const result = migrateStateSync(null);
      expect(result).toBeNull();
    });

    test("should handle undefined state", () => {
      const result = migrateStateSync(undefined);
      expect(result).toBeUndefined();
    });

    test("should handle primitive state", () => {
      const result = migrateStateSync("simple string");
      expect(result).toBe("simple string");
    });
  });

  describe("round-trip", () => {
    test("wrapping and extracting should preserve state", () => {
      const originalState = {
        name: "Test Paywall",
        children: [{ type: "screen", name: "Screen 1" }],
      };

      const wrapped = wrapWithVersion(originalState);
      const version = getSchemaVersion(wrapped);
      const extracted = migrateStateSync(wrapped);

      expect(version).toBe(CURRENT_SCHEMA_VERSION);
      expect(extracted).toEqual(originalState);
    });
  });
});
