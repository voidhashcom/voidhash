import { PaywallLocationShowingType } from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  type ShowingWithRelations,
  toDbShowingType,
  toShowingTypeLabel,
  toShowingView,
} from "../../../src/services/paywallLocations/helpers.ts";

const at = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

/**
 * Fresh `ShowingWithRelations` fixture per test. Defaults to a feature-flag
 * showing with both relations absent so individual cases only override the
 * fields they exercise.
 */
const showing = (overrides: Partial<ShowingWithRelations> = {}): ShowingWithRelations => ({
  createdAt: at("2026-01-02T00:00:00.000Z"),
  createdByUserId: "user-1",
  endedAt: at("2026-02-01T00:00:00.000Z"),
  featureFlagId: null,
  id: "showing-1",
  paywall: null,
  paywallId: null,
  paywallLocationId: "loc-1",
  paywallRelease: null,
  paywallReleaseId: null,
  projectId: "project-1",
  startedAt: at("2026-01-01T00:00:00.000Z"),
  type: PaywallLocationShowingType.paywallRelease,
  updatedAt: at("2026-01-03T00:00:00.000Z"),
  ...overrides,
});

const urlConfig = {
  cdnUrl: "https://cdn.example.com",
  publicBaseUrl: "https://api.example.com",
};

/** Editor-release relation fixture: no code-deploy provenance. */
const editorRelease = (
  overrides: Partial<NonNullable<ShowingWithRelations["paywallRelease"]>> = {},
): NonNullable<ShowingWithRelations["paywallRelease"]> => ({
  contentHash: null,
  id: "rel-1",
  publishedAt: at("2026-01-05T00:00:00.000Z"),
  runtimeConfig: null,
  s3Bucket: "paywalls",
  s3Key: "project-1/rel-1/index.html",
  version: 3,
  ...overrides,
});

describe("toShowingTypeLabel", () => {
  it.each([
    [PaywallLocationShowingType.paywallRelease, "paywall_release"],
    [PaywallLocationShowingType.featureFlag, "feature_flag"],
  ])("maps db type %i to label %s", (type, label) => {
    expect(toShowingTypeLabel(type)).toBe(label);
  });

  it("defaults an unknown numeric type to 'paywall_release'", () => {
    expect(toShowingTypeLabel(999)).toBe("paywall_release");
    expect(toShowingTypeLabel(0)).toBe("paywall_release");
  });
});

describe("toDbShowingType", () => {
  it.each(
    constant([
      ["paywall_release", PaywallLocationShowingType.paywallRelease],
      ["feature_flag", PaywallLocationShowingType.featureFlag],
    ]),
  )("maps label %s to db type %i", (label, type) => {
    expect(toDbShowingType(label)).toBe(type);
  });

  it("round-trips with toShowingTypeLabel", () => {
    expect(toShowingTypeLabel(toDbShowingType("feature_flag"))).toBe("feature_flag");
    expect(toShowingTypeLabel(toDbShowingType("paywall_release"))).toBe("paywall_release");
  });
});

describe("toShowingView", () => {
  it("preserves all scalar fields and maps the type via toShowingTypeLabel", () => {
    const row = showing({
      createdAt: at("2026-01-02T00:00:00.000Z"),
      createdByUserId: "user-42",
      endedAt: at("2026-02-01T00:00:00.000Z"),
      featureFlagId: "ff-1",
      id: "showing-99",
      paywallId: "pw-1",
      paywallLocationId: "loc-99",
      paywallReleaseId: "rel-1",
      projectId: "project-99",
      startedAt: at("2026-01-01T00:00:00.000Z"),
      type: PaywallLocationShowingType.featureFlag,
      updatedAt: at("2026-01-03T00:00:00.000Z"),
    });

    const view = toShowingView(row, urlConfig);

    expect(view.id).toBe("showing-99");
    expect(view.projectId).toBe("project-99");
    expect(view.paywallLocationId).toBe("loc-99");
    expect(view.type).toBe("feature_flag");
    expect(view.paywallId).toBe("pw-1");
    expect(view.paywallReleaseId).toBe("rel-1");
    expect(view.featureFlagId).toBe("ff-1");
    expect(view.startedAt).toEqual(at("2026-01-01T00:00:00.000Z"));
    expect(view.endedAt).toEqual(at("2026-02-01T00:00:00.000Z"));
    expect(view.createdByUserId).toBe("user-42");
    expect(view.createdAt).toEqual(at("2026-01-02T00:00:00.000Z"));
    expect(view.updatedAt).toEqual(at("2026-01-03T00:00:00.000Z"));
  });

  it("maps a present paywall relation into the view", () => {
    const row = showing({
      paywall: { id: "pw-1", name: "Main", slug: "main" },
      paywallId: "pw-1",
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywall).toEqual({ id: "pw-1", name: "Main", slug: "main" });
  });

  it("builds the CDN htmlUrl from s3Bucket, s3Key, and cdnUrl for editor releases", () => {
    const row = showing({
      paywallRelease: editorRelease(),
      paywallReleaseId: "rel-1",
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallRelease).toEqual({
      htmlUrl: "https://cdn.example.com/paywalls/project-1/rel-1/index.html",
      publishedAt: at("2026-01-05T00:00:00.000Z"),
      releaseId: "rel-1",
      runtime: null,
      version: 3,
    });
  });

  it("builds the publicBaseUrl htmlUrl and runtime block for code releases", () => {
    const contentHash = "a".repeat(64);
    const row = showing({
      paywallRelease: editorRelease({
        contentHash,
        id: "rel-7",
        runtimeConfig: {
          productSlugs: ["yearly", "monthly"],
          variables: { accentColor: "#16a34a", showBadge: true, trialDays: 7 },
        },
        s3Bucket: "paywalls",
        s3Key: `p/${contentHash}/index.html`,
        version: 4,
      }),
      paywallReleaseId: "rel-7",
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallRelease).toEqual({
      htmlUrl: `https://api.example.com/p/${contentHash}/index.html`,
      publishedAt: at("2026-01-05T00:00:00.000Z"),
      releaseId: "rel-7",
      runtime: {
        contentHash,
        productSlugs: ["yearly", "monthly"],
        variables: { accentColor: "#16a34a", showBadge: true, trialDays: 7 },
      },
      version: 4,
    });
  });

  it("leaves runtime null when contentHash is set but runtimeConfig is missing", () => {
    const contentHash = "b".repeat(64);
    const row = showing({
      paywallRelease: editorRelease({ contentHash, runtimeConfig: null }),
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallRelease?.runtime).toBeNull();
    // Still served from the content-addressed layout — contentHash decides.
    expect(view.paywallRelease?.htmlUrl).toBe("https://api.example.com/project-1/rel-1/index.html");
  });

  it("preserves a null publishedAt on the paywallRelease relation", () => {
    const row = showing({
      paywallRelease: editorRelease({ id: "rel-2", publishedAt: null, s3Key: "k", version: 1 }),
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallRelease?.publishedAt).toBeNull();
  });

  it("returns null paywall when the relation is null", () => {
    const view = toShowingView(showing({ paywall: null }), urlConfig);
    expect(view.paywall).toBeNull();
  });

  it("returns null paywall when the relation is undefined", () => {
    const view = toShowingView(showing({ paywall: undefined }), urlConfig);
    expect(view.paywall).toBeNull();
  });

  it("returns null paywallRelease when the relation is null", () => {
    const view = toShowingView(showing({ paywallRelease: null }), urlConfig);
    expect(view.paywallRelease).toBeNull();
  });

  it("returns null paywallRelease when the relation is undefined", () => {
    const view = toShowingView(showing({ paywallRelease: undefined }), urlConfig);
    expect(view.paywallRelease).toBeNull();
  });

  it("passes through null paywallId, paywallReleaseId, and featureFlagId as-is", () => {
    const row = showing({
      featureFlagId: null,
      paywallId: null,
      paywallReleaseId: null,
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallId).toBeNull();
    expect(view.paywallReleaseId).toBeNull();
    expect(view.featureFlagId).toBeNull();
  });

  it("passes through string paywallId, paywallReleaseId, and featureFlagId as-is", () => {
    const row = showing({
      featureFlagId: "ff-9",
      paywallId: "pw-9",
      paywallReleaseId: "rel-9",
    });

    const view = toShowingView(row, urlConfig);

    expect(view.paywallId).toBe("pw-9");
    expect(view.paywallReleaseId).toBe("rel-9");
    expect(view.featureFlagId).toBe("ff-9");
  });
});
