/**
 * Unit tests for {@link deterministicAnalyticsEventId}: stability (same triple →
 * same id), injectivity (distinct triples → distinct ids, including separator
 * edge cases), and the `an_evt_` namespace shared with `generateId`.
 */
import { describe, expect, it } from "vite-plus/test";

import { deterministicAnalyticsEventId } from "../../src/utils/deterministic-id.ts";

const id = (anchor: string, eventName: string, personId: string) =>
  deterministicAnalyticsEventId({ anchor, eventName, personId });

describe("deterministicAnalyticsEventId", () => {
  it("is stable: the same (anchor, eventName, personId) always yields the same id", () => {
    expect(id("k1", "$subscription.created", "person_1")).toBe(
      id("k1", "$subscription.created", "person_1"),
    );
  });

  it("uses the an_evt_ namespace (shared with generateId('analyticsEvent'))", () => {
    expect(id("k1", "$purchase.completed", "person_1")).toMatch(/^an_evt_/);
  });

  it("changes when ANY component changes", () => {
    const base = id("k1", "$subscription.created", "person_1");
    expect(id("k2", "$subscription.created", "person_1")).not.toBe(base); // anchor
    expect(id("k1", "$subscription.renewed", "person_1")).not.toBe(base); // eventName
    expect(id("k1", "$subscription.created", "person_2")).not.toBe(base); // personId
  });

  it("is injective even when the anchor contains the ':' separator", () => {
    // The anchor (a ledger idempotency_key) legitimately contains ':' — e.g.
    // transfer keys. The encoding parses from the right, so a ':'-laden anchor
    // can never be confused with the eventName / personId segments.
    const a = id(
      "subscription_transfer:sub_1:person_a->person_b:2026-01-01T00:00:00.000Z",
      "$subscription.transferred_in",
      "person_b",
    );
    const b = id(
      "subscription_transfer:sub_1:person_a->person_b:2026-01-01T00:00:00.001Z",
      "$subscription.transferred_in",
      "person_b",
    );
    expect(a).not.toBe(b);
  });

  it("cannot be collided by shifting characters across the eventName/personId boundary", () => {
    // eventName is slugged to [A-Za-z0-9._-] (no ':'), so a crafted personId
    // cannot 'absorb' part of the eventName and vice-versa.
    expect(id("k", "$a.b", "c")).not.toBe(id("k", "$a", "b.c"));
  });

  it("slugs the '$' sigil and '.' in event names deterministically", () => {
    // Two distinct reserved names never slug to the same value.
    expect(id("k", "$purchase.transferred_out", "p")).not.toBe(
      id("k", "$purchase.transferred_in", "p"),
    );
  });
});
