import { isCuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vite-plus/test";

import { generateId } from "../../src/utils/generate-id.ts";

/**
 * `generateId` is a linchpin for entity creation across every service (100+ call
 * sites), so these tests pin down the exact wire format — `${prefix}_${cuid}` —
 * for each entity type. CUID2 ids are validated with the library's own
 * `isCuid` rather than a hand-rolled regex.
 */

// (prefix-key, expected string prefix) pairs lifted from the `prefixes` const in
// the source. We deliberately spot-check a representative spread of entity types
// (auth, billing, payment providers, webhooks, feature flags, …) including a few
// where the literal prefix is a non-obvious abbreviation (org, pw_loc_show, …).
const PREFIX_CASES = [
  ["user", "user"],
  ["organization", "org"],
  ["member", "member"],
  ["project", "proj"],
  ["product", "prod"],
  ["perk", "perk"],
  ["productPerk", "prod_perk"],
  ["transaction", "tx"],
  ["purchase", "pur"],
  ["subscription", "sub"],
  ["apiSecretKey", "api_sk"],
  ["apiPublishableKey", "api_pk"],
  ["apiPublishableKeyTesting", "api_pk_test"],
  ["person", "person"],
  ["personDistinctId", "person_dist"],
  ["paywall", "pw"],
  ["paywallLocation", "pw_loc"],
  ["paywallLocationShowing", "pw_loc_show"],
  ["appStoreTransaction", "app_store_tx"],
  ["fxRate", "fx"],
  ["webhookEndpoint", "wh_ep"],
  ["featureFlag", "ff"],
  ["experiment", "exp"],
] as const;

// The CUID2 suffix: a single leading letter then 23 lowercase-alphanumeric chars
// (the default length is 24). Used only as a secondary, structural assertion;
// `isCuid` is the authoritative validator.
const CUID2 = /^[a-z][a-z0-9]{23}$/;

describe("generateId", () => {
  describe("prefix mapping", () => {
    it.each(PREFIX_CASES)("%s → '%s_<cuid>'", (prefix, expectedPrefix) => {
      const id = generateId(prefix);
      expect(id.startsWith(`${expectedPrefix}_`)).toBe(true);
    });

    it("maps 'user' to the 'user_' prefix", () => {
      expect(generateId("user").startsWith("user_")).toBe(true);
    });

    it("maps 'organization' to the abbreviated 'org_' prefix, not 'organization_'", () => {
      const id = generateId("organization");
      expect(id.startsWith("org_")).toBe(true);
      expect(id.startsWith("organization_")).toBe(false);
    });
  });

  describe("format", () => {
    it.each(PREFIX_CASES)(
      "%s id is exactly '%s_' followed by a valid CUID2",
      (prefix, expectedPrefix) => {
        const id = generateId(prefix);
        const suffix = id.slice(expectedPrefix.length + 1);
        // The prefix is delimited by a single underscore and the suffix is a CUID2.
        expect(id).toBe(`${expectedPrefix}_${suffix}`);
        expect(isCuid(suffix)).toBe(true);
        expect(suffix).toMatch(CUID2);
      },
    );

    it("never produces a trailing-only or empty suffix", () => {
      const id = generateId("perk");
      const suffix = id.slice("perk_".length);
      expect(suffix.length).toBe(24);
    });

    it("matches the canonical /^<prefix>_<cuid>$/ shape across many prefixes", () => {
      for (const [prefix, expectedPrefix] of PREFIX_CASES) {
        const id = generateId(prefix);
        const pattern = new RegExp(`^${expectedPrefix}_[a-z][a-z0-9]{23}$`);
        expect(id).toMatch(pattern);
      }
    });
  });

  describe("uniqueness", () => {
    it("two consecutive calls for the same prefix differ", () => {
      expect(generateId("perk")).not.toBe(generateId("perk"));
    });

    it("a large batch contains no collisions", () => {
      const N = 1_000;
      const ids = new Set<string>();
      for (let i = 0; i < N; i++) ids.add(generateId("transaction"));
      expect(ids.size).toBe(N);
    });

    it("only the suffix varies — the prefix is stable", () => {
      const a = generateId("subscription");
      const b = generateId("subscription");
      expect(a.startsWith("sub_")).toBe(true);
      expect(b.startsWith("sub_")).toBe(true);
      expect(a.slice("sub_".length)).not.toBe(b.slice("sub_".length));
    });
  });
});
