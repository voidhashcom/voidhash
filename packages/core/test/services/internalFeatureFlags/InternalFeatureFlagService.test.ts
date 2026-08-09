import { constant } from "@voidhash/lib/lang";
import { describe, expect, it } from "vite-plus/test";

import { INTERNAL_FEATURE_FLAG_LIST } from "@voidhash/rpc";

import {
  enabledKeysFromOverrides,
  resolveInternalFeatureFlagList,
} from "../../../src/services/internalFeatureFlags/InternalFeatureFlagService.ts";

/**
 * Pure resolution logic of `InternalFeatureFlagService` — the `override ??
 * defaultEnabled` rule and the catalog projection — driven directly off the
 * code registry so the assertions track whatever flags exist. The DB-backed
 * methods are exercised by the integration suite.
 */

const allKeys = INTERNAL_FEATURE_FLAG_LIST.map((flag) => flag.key);
const defaultEnabledKeys = INTERNAL_FEATURE_FLAG_LIST.filter((flag) => flag.defaultEnabled).map(
  (flag) => flag.key,
);

describe("enabledKeysFromOverrides", () => {
  it("falls back to the code defaults when there are no overrides", () => {
    expect(enabledKeysFromOverrides(new Map()).sort()).toEqual([...defaultEnabledKeys].sort());
  });

  it("enables every flag when each is overridden to true", () => {
    const overrides = new Map(allKeys.map((key) => constant([key, true])));
    expect(enabledKeysFromOverrides(overrides).sort()).toEqual([...allKeys].sort());
  });

  it("disables every flag when each is overridden to false", () => {
    const overrides = new Map(allKeys.map((key) => constant([key, false])));
    expect(enabledKeysFromOverrides(overrides)).toEqual([]);
  });

  it("ignores override rows whose key is not in the registry", () => {
    const overrides = new Map<string, boolean>([["totally_unknown_flag", true]]);
    expect(enabledKeysFromOverrides(overrides).sort()).toEqual([...defaultEnabledKeys].sort());
  });
});

describe("resolveInternalFeatureFlagList", () => {
  it("returns one entry per registry flag", () => {
    expect(
      resolveInternalFeatureFlagList(new Map())
        .map((f) => f.key)
        .sort(),
    ).toEqual([...allKeys].sort());
  });

  it("reports override = null and enabled = default when not overridden", () => {
    for (const resolved of resolveInternalFeatureFlagList(new Map())) {
      expect(resolved.override).toBeNull();
      expect(resolved.enabled).toBe(resolved.defaultEnabled);
    }
  });

  it("reflects an explicit override (including false on a default-off flag)", () => {
    const someKey = allKeys[0];
    if (someKey === undefined) {
      return; // no flags defined — nothing to assert
    }
    const resolved = resolveInternalFeatureFlagList(new Map([[someKey, false]]));
    const entry = resolved.find((f) => f.key === someKey);
    expect(entry?.override).toBe(false);
    expect(entry?.enabled).toBe(false);
  });
});
