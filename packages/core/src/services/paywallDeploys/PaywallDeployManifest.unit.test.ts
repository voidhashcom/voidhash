import { Effect, Result, Schema } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";

import {
  ComponentManifestSchema,
  type ManifestFileEntry,
  PaywallDeployManifestSchema,
  type PreviewNode,
  PreviewTreeSchema,
  SIZE_CAPS,
  assetBasename,
  blobStorageKey,
  canonicalJsonStringify,
  collectManifestHashes,
  componentContentHashPreimage,
  componentServingManifestKey,
  componentServingMetadata,
  componentServingPanelKey,
  componentServingPreviewKey,
  componentServingPrefix,
  componentServingRuntimeKey,
  computeManifestHash,
  computePaywallContentHash,
  countSlotNodes,
  findDeclaredContentType,
  manifestAssetsByPath,
  manifestFileEntries,
  paywallContentHashPreimage,
  paywallServingAssetKey,
  paywallServingHtmlKey,
  paywallServingJsKey,
  servingCopiesForComponent,
  servingCopiesForPaywall,
  sha256Hex,
  sizeCapForRole,
  strictParseOptions,
  validateManifestConstraints,
  validateRecordedBlobCaps,
  validateUploadedBlobSize,
} from "./PaywallDeployManifest.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 64-char lowercase hex built from a single hex digit. */
const hex = (char: string) => char.repeat(64);

const file = (path: string, sha256: string, bytes = 100) => ({ bytes, path, sha256 });

const artifact = (path: string, sha256: string, contentType: string, bytes = 100) => ({
  bytes,
  contentType,
  path,
  sha256,
});

const ASSET_PATH = ".voidhash/.build/paywalls/onboarding/assets/hero-AB12CD.png";

const basePaywall = () => ({
  artifacts: {
    html: artifact(
      ".voidhash/.build/paywalls/onboarding/index.html",
      hex("b"),
      "text/html; charset=utf-8",
    ),
    js: artifact(
      ".voidhash/.build/paywalls/onboarding/bundle.js",
      hex("c"),
      "text/javascript; charset=utf-8",
    ),
  },
  assets: [ASSET_PATH],
  contentHash: hex("d"),
  id: "onboarding",
  products: ["yearly", "monthly"],
  source: file(".voidhash/paywalls/onboarding.tsx", hex("a")),
  title: "Onboarding",
  variables: { accentColor: "#16a34a", dark: true, maxItems: 3 },
});

const baseComponent = () => ({
  artifacts: {
    panel: null,
    runtime: artifact(
      ".voidhash/.build/components/product-option/runtime.js",
      hex("1"),
      "text/javascript; charset=utf-8",
    ),
  },
  contentHash: hex("2"),
  id: "product-option",
  manifest: artifact(
    ".voidhash/.build/components/product-option/manifest.json",
    hex("f"),
    "application/json",
  ),
  previews: [
    {
      file: artifact(
        ".voidhash/.build/components/product-option/previews/default.json",
        hex("0"),
        "application/json",
      ),
      state: "default",
    },
  ],
  source: file(".voidhash/components/product-option.tsx", hex("e")),
  title: "Product Option",
});

/** Base component with a panel bundle and a second `trial` preview state. */
const componentWithPanel = () => {
  const base = baseComponent();
  return {
    ...base,
    artifacts: {
      panel: artifact(
        ".voidhash/.build/components/product-option/panel.js",
        hex("9"),
        "text/javascript; charset=utf-8",
      ),
      runtime: base.artifacts.runtime,
    },
    previews: [
      ...base.previews,
      {
        file: artifact(
          ".voidhash/.build/components/product-option/previews/trial.json",
          hex("8"),
          "application/json",
        ),
        state: "trial",
      },
    ],
  };
};

const baseManifest = () => ({
  assets: [artifact(ASSET_PATH, hex("4"), "image/png")],
  cliVersion: "0.0.1-alpha.1",
  components: [baseComponent()],
  config: file("voidhash.config.ts", hex("3")),
  createdAt: "2026-06-11T10:00:00.000Z",
  paywalls: [basePaywall()],
  project: "dev-proj",
  runtimeVersion: "0.0.1-alpha.1",
  schemaVersion: 2,
  team: "voidhash-dev-sro",
});

const withTopLevel = (overrides: Record<string, unknown>): unknown => ({
  ...baseManifest(),
  ...overrides,
});

const decodeManifest = (input: unknown) =>
  Effect.runSync(
    Effect.result(
      Schema.decodeUnknownEffect(PaywallDeployManifestSchema, strictParseOptions)(input),
    ),
  );

const decodeComponentManifest = (input: unknown) =>
  Effect.runSync(
    Effect.result(Schema.decodeUnknownEffect(ComponentManifestSchema, strictParseOptions)(input)),
  );

const decodePreviewTree = (input: unknown) =>
  Effect.runSync(
    Effect.result(Schema.decodeUnknownEffect(PreviewTreeSchema, strictParseOptions)(input)),
  );

const decodedBaseManifest = () => Result.getOrThrow(decodeManifest(baseManifest()));

// Well-known SHA-256 test vectors (FIPS 180-2 / NIST).
const SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const SHA256_OF_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// ---------------------------------------------------------------------------
// §1 deploy manifest schema
// ---------------------------------------------------------------------------

describe("PaywallDeployManifestSchema", () => {
  it("accepts a valid schemaVersion 2 manifest", () => {
    const result = decodeManifest(baseManifest());
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("rejects an unknown schemaVersion", () => {
    expect(Result.isFailure(decodeManifest(withTopLevel({ schemaVersion: 3 })))).toBe(true);
    expect(Result.isFailure(decodeManifest(withTopLevel({ schemaVersion: 1 })))).toBe(true);
  });

  it("rejects a paywall id violating the slug regex", () => {
    for (const id of ["Bad_ID", "-leading-dash", "UPPER", "a".repeat(65), ""]) {
      const result = decodeManifest(withTopLevel({ paywalls: [{ ...basePaywall(), id }] }));
      expect(Result.isFailure(result)).toBe(true);
    }
  });

  it("rejects non-primitive variables values", () => {
    const result = decodeManifest(
      withTopLevel({ paywalls: [{ ...basePaywall(), variables: { nested: { not: "allowed" } } }] }),
    );
    expect(Result.isFailure(result)).toBe(true);
    const arrayResult = decodeManifest(
      withTopLevel({ paywalls: [{ ...basePaywall(), variables: { list: ["nope"] } }] }),
    );
    expect(Result.isFailure(arrayResult)).toBe(true);
  });

  it("rejects unknown top-level keys", () => {
    expect(Result.isFailure(decodeManifest(withTopLevel({ extraneous: true })))).toBe(true);
  });

  it("rejects unknown keys on nested entries", () => {
    const result = decodeManifest(
      withTopLevel({ paywalls: [{ ...basePaywall(), sneaky: "value" }] }),
    );
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects malformed sha256 values", () => {
    const result = decodeManifest(
      withTopLevel({ config: { bytes: 1, path: "voidhash.config.ts", sha256: "ABC123" } }),
    );
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects negative byte counts", () => {
    const result = decodeManifest(
      withTopLevel({ config: { bytes: -1, path: "voidhash.config.ts", sha256: hex("3") } }),
    );
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects contentTypes outside the bare-type + charset grammar", () => {
    for (const contentType of [
      "text/html; charset=utf-8\r\nSet-Cookie: x=1",
      "text/html;",
      "text/html; boundary=x",
      "",
      `image/png; charset=${"a".repeat(100)}`,
    ]) {
      const paywall = basePaywall();
      paywall.artifacts.html.contentType = contentType;
      expect(Result.isFailure(decodeManifest(withTopLevel({ paywalls: [paywall] })))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// §2 component manifest schema
// ---------------------------------------------------------------------------

const baseComponentManifest = () => ({
  actions: { onSelect: { payload: { productId: { kind: "string" } } } },
  hostData: ["products"],
  manifestVersion: 2,
  previewStates: ["default", "trial"],
  props: {
    accentColor: { default: "#16a34a", editor: "color", kind: "string", optional: true },
    badge: { kind: "component", optional: true },
    features: { item: { kind: "string" }, kind: "array", optional: true },
    plan: { kind: "select", optional: true, options: ["monthly", "yearly"] },
    product: { kind: "ref", label: "Product", optional: false, refType: "product" },
    selected: { default: false, kind: "boolean", optional: true },
  },
  slot: true,
  title: "Product Option",
});

describe("ComponentManifestSchema", () => {
  it("accepts a valid component manifest", () => {
    expect(Result.isSuccess(decodeComponentManifest(baseComponentManifest()))).toBe(true);
  });

  it("rejects an unknown manifestVersion", () => {
    const result = decodeComponentManifest({ ...baseComponentManifest(), manifestVersion: 1 });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects an unknown prop kind", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { broken: { kind: "function" } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects array props whose item is itself an array", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { matrix: { item: { item: { kind: "string" }, kind: "array" }, kind: "array" } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects unknown extra keys", () => {
    const result = decodeComponentManifest({ ...baseComponentManifest(), rogue: 1 });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects a ref prop with an unsupported refType", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { entitlement: { kind: "ref", refType: "entitlement" } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects editor hints on non-string kinds", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { count: { default: 1, editor: "color", kind: "number" } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects empty select options", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { plan: { kind: "select", options: [] } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  // §2 round-trip suite: every prop-builder combination the OSS SDK can emit
  // must decode under the strict parse options.
  it("round-trips every SDK-emittable prop combination under strict parsing", () => {
    const manifest = {
      actions: {},
      manifestVersion: 2,
      props: {
        accentColor: { default: "#16a34a", editor: "color", kind: "string", optional: true },
        badge: { kind: "component", optional: true },
        count: { default: 3, kind: "number", optional: true },
        features: { default: ["a", "b"], item: { kind: "string" }, kind: "array", optional: true },
        hero: { default: "https://example.com/hero.png", kind: "image", optional: true },
        plan: {
          default: "monthly",
          kind: "select",
          optional: true,
          options: ["monthly", "yearly"],
        },
        product: { kind: "ref", refType: "product" },
        selected: { default: false, kind: "boolean", optional: true },
      },
      title: "Kitchen Sink",
    };
    const result = decodeComponentManifest(manifest);
    expect(Result.isSuccess(result), encodeJson(result)).toBe(true);
  });

  it("round-trips a minimal manifest with empty actions and no slot", () => {
    const result = decodeComponentManifest({
      actions: {},
      manifestVersion: 2,
      props: {},
    });
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("accepts image defaults (string) and array defaults (scalar arrays)", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: {
        flags: { default: [true, false], item: { kind: "boolean" }, kind: "array" },
        hero: { default: "asset://hero.png", kind: "image" },
        sizes: { default: [1, 2, 3], item: { kind: "number" }, kind: "array" },
      },
    });
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("rejects non-scalar array defaults", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: {
        broken: { default: [{ nested: true }], item: { kind: "string" }, kind: "array" },
      },
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects non-string image defaults", () => {
    const result = decodeComponentManifest({
      ...baseComponentManifest(),
      props: { hero: { default: 42, kind: "image" } },
    });
    expect(Result.isFailure(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §3 preview node tree schema
// ---------------------------------------------------------------------------

const basePreviewTree = () => ({
  root: {
    children: [
      { style: { color: "#fff", fontSize: 16 }, text: "Yearly", type: "text" },
      { resizeMode: "cover", src: "https://example.com/x.png", style: {}, type: "image" },
      { type: "slot" },
      { reason: "render returned null", type: "placeholder" },
      {
        action: "onSelect",
        children: [],
        style: { backgroundColor: "#000" },
        type: "pressable",
      },
    ],
    style: { flexDirection: "row", paddingTop: 16 },
    type: "view",
  },
  state: "default",
  treeVersion: 1,
});

describe("PreviewTreeSchema", () => {
  it("accepts a valid preview tree", () => {
    expect(Result.isSuccess(decodePreviewTree(basePreviewTree()))).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const tree = {
      ...basePreviewTree(),
      root: { children: [], style: {}, type: "marquee" },
    };
    expect(Result.isFailure(decodePreviewTree(tree))).toBe(true);
  });

  it("rejects unknown keys on a node", () => {
    const tree = {
      ...basePreviewTree(),
      root: { children: [{ type: "slot", unexpected: true }], style: {}, type: "view" },
    };
    expect(Result.isFailure(decodePreviewTree(tree))).toBe(true);
  });

  it("rejects style keys outside the §3.1 vocabulary", () => {
    const tree = {
      ...basePreviewTree(),
      root: { children: [], style: { boxShadow: "0 0 4px red" }, type: "view" },
    };
    expect(Result.isFailure(decodePreviewTree(tree))).toBe(true);
  });

  it("accepts v1 and v2 preview trees and rejects an unknown version", () => {
    expect(Result.isSuccess(decodePreviewTree({ ...basePreviewTree(), treeVersion: 1 }))).toBe(
      true,
    );
    expect(
      Result.isSuccess(
        decodePreviewTree({
          ...basePreviewTree(),
          root: { children: [], motion: { opacity: 1, x: 12 }, style: {}, type: "view" },
          treeVersion: 2,
        }),
      ),
    ).toBe(true);
    expect(Result.isFailure(decodePreviewTree({ ...basePreviewTree(), treeVersion: 3 }))).toBe(
      true,
    );
  });

  it("accepts exactly the four §3 resizeMode values and rejects others", () => {
    for (const resizeMode of ["cover", "contain", "stretch", "center"]) {
      const tree = {
        ...basePreviewTree(),
        root: { resizeMode, src: "https://example.com/x.png", style: {}, type: "image" },
      };
      expect(Result.isSuccess(decodePreviewTree(tree)), resizeMode).toBe(true);
    }
    for (const resizeMode of ["repeat", "tile", ""]) {
      const tree = {
        ...basePreviewTree(),
        root: { resizeMode, src: "https://example.com/x.png", style: {}, type: "image" },
      };
      expect(Result.isFailure(decodePreviewTree(tree)), resizeMode).toBe(true);
    }
  });
});

describe("countSlotNodes", () => {
  const text: PreviewNode = { style: {}, text: "x", type: "text" };
  const slot: PreviewNode = { type: "slot" };

  it("counts zero slots in slot-free trees", () => {
    expect(countSlotNodes(text)).toBe(0);
    expect(countSlotNodes({ children: [text], style: {}, type: "view" })).toBe(0);
    expect(countSlotNodes({ reason: "null", type: "placeholder" })).toBe(0);
  });

  it("counts a single slot anywhere in the tree", () => {
    expect(countSlotNodes(slot)).toBe(1);
    expect(
      countSlotNodes({
        children: [{ children: [slot], style: {}, type: "pressable" }],
        style: {},
        type: "view",
      }),
    ).toBe(1);
  });

  it("counts multiple slots across nested containers", () => {
    expect(
      countSlotNodes({
        children: [slot, { children: [slot, text], style: {}, type: "scroll" }],
        style: {},
        type: "view",
      }),
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §1.1 constraint validation
// ---------------------------------------------------------------------------

describe("validateManifestConstraints", () => {
  it("passes the valid base manifest", () => {
    expect(validateManifestConstraints(decodedBaseManifest())).toEqual([]);
  });

  it("requires at least one paywall or component", () => {
    const manifest = Result.getOrThrow(
      decodeManifest(withTopLevel({ assets: [], components: [], paywalls: [] })),
    );
    expect(validateManifestConstraints(manifest)).toEqual([
      "manifest must declare at least one paywall or component",
    ]);
  });

  it("flags duplicate paywall and component ids", () => {
    const manifest = Result.getOrThrow(
      decodeManifest(
        withTopLevel({
          components: [baseComponent(), baseComponent()],
          paywalls: [basePaywall(), basePaywall()],
        }),
      ),
    );
    const violations = validateManifestConstraints(manifest);
    expect(violations).toContain('duplicate paywall id "onboarding"');
    expect(violations).toContain('duplicate component id "product-option"');
  });

  it("flags js bundles over the 5 MB cap (declared bytes)", () => {
    const paywall = basePaywall();
    paywall.artifacts.js.bytes = SIZE_CAPS.jsBundle + 1;
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ paywalls: [paywall] })));
    const violations = validateManifestConstraints(manifest);
    expect(violations.some((v) => v.includes("js bundle exceeds"))).toBe(true);
  });

  it("flags assets over the 10 MB cap (declared bytes)", () => {
    const manifest = Result.getOrThrow(
      decodeManifest(
        withTopLevel({
          assets: [artifact(ASSET_PATH, hex("4"), "image/png", SIZE_CAPS.asset + 1)],
        }),
      ),
    );
    const violations = validateManifestConstraints(manifest);
    expect(violations.some((v) => v.includes(`exceeds ${SIZE_CAPS.asset} bytes`))).toBe(true);
  });

  it("flags oversize component manifests and preview trees", () => {
    const component = baseComponent();
    component.manifest.bytes = SIZE_CAPS.componentManifest + 1;
    component.previews[0]!.file.bytes = SIZE_CAPS.previewTree + 1;
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ components: [component] })));
    const violations = validateManifestConstraints(manifest);
    expect(violations.some((v) => v.includes("component manifest exceeds"))).toBe(true);
    expect(violations.some((v) => v.includes("preview tree exceeds"))).toBe(true);
  });

  it("flags contentTypes outside the allowlist", () => {
    const paywall = basePaywall();
    paywall.artifacts.js.contentType = "application/x-msdownload";
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ paywalls: [paywall] })));
    const violations = validateManifestConstraints(manifest);
    expect(violations.some((v) => v.includes('"application/x-msdownload" is not allowed'))).toBe(
      true,
    );
  });

  it("accepts allowlisted contentTypes with charset suffixes", () => {
    expect(validateManifestConstraints(decodedBaseManifest())).toEqual([]);
  });

  it("flags paywall asset paths missing from the top-level assets list", () => {
    const paywall = basePaywall();
    paywall.assets.push(".voidhash/.build/missing.png");
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ paywalls: [paywall] })));
    const violations = validateManifestConstraints(manifest);
    expect(
      violations.some((v) => v.includes('".voidhash/.build/missing.png" is not in the top-level')),
    ).toBe(true);
  });

  it("flags referenced assets sharing a serving basename, naming both paths", () => {
    const otherPath = ".voidhash/.build/paywalls/onboarding/assets/alt/hero-AB12CD.png";
    const paywall = basePaywall();
    paywall.assets.push(otherPath);
    const manifest = Result.getOrThrow(
      decodeManifest(
        withTopLevel({
          assets: [
            artifact(ASSET_PATH, hex("4"), "image/png"),
            artifact(otherPath, hex("5"), "image/png"),
          ],
          paywalls: [paywall],
        }),
      ),
    );
    const violations = validateManifestConstraints(manifest);
    expect(
      violations.some(
        (v) =>
          v.includes(`"${ASSET_PATH}"`) &&
          v.includes(`"${otherPath}"`) &&
          v.includes('collide on serving name "assets/hero-AB12CD.png"'),
      ),
    ).toBe(true);
  });

  it("flags same-basename references even when the content is identical", () => {
    const otherPath = ".voidhash/.build/paywalls/onboarding/assets/alt/hero-AB12CD.png";
    const paywall = basePaywall();
    paywall.assets.push(otherPath);
    const manifest = Result.getOrThrow(
      decodeManifest(
        withTopLevel({
          assets: [
            artifact(ASSET_PATH, hex("4"), "image/png"),
            artifact(otherPath, hex("4"), "image/png"),
          ],
          paywalls: [paywall],
        }),
      ),
    );
    const violations = validateManifestConstraints(manifest);
    expect(
      violations.some((v) => v.includes('collide on serving name "assets/hero-AB12CD.png"')),
    ).toBe(true);
  });

  it("does not flag the same asset path referenced twice", () => {
    const paywall = basePaywall();
    paywall.assets.push(ASSET_PATH);
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ paywalls: [paywall] })));
    expect(validateManifestConstraints(manifest)).toEqual([]);
  });

  it("enforces per-role contentTypes (§1.1)", () => {
    // Allowlisted types in the wrong role are still rejected.
    const paywall = basePaywall();
    paywall.artifacts.html.contentType = "text/javascript";
    paywall.artifacts.js.contentType = "application/json";
    const component = baseComponent();
    component.manifest.contentType = "text/javascript; charset=utf-8";
    component.artifacts.runtime.contentType = "application/json";
    component.previews[0]!.file.contentType = "text/html";
    const manifest = Result.getOrThrow(
      decodeManifest(withTopLevel({ components: [component], paywalls: [paywall] })),
    );
    const violations = validateManifestConstraints(manifest);
    expect(violations.some((v) => v.includes("html") && v.includes("expected text/html"))).toBe(
      true,
    );
    expect(violations.some((v) => v.includes("js") && v.includes("expected text/javascript"))).toBe(
      true,
    );
    expect(
      violations.some((v) => v.includes("manifest") && v.includes("expected application/json")),
    ).toBe(true);
    expect(
      violations.some((v) => v.includes("runtime") && v.includes("expected text/javascript")),
    ).toBe(true);
    expect(
      violations.some((v) => v.includes("preview") && v.includes("expected application/json")),
    ).toBe(true);
  });

  it("accepts per-role contentTypes with charset suffixes", () => {
    expect(validateManifestConstraints(decodedBaseManifest())).toEqual([]);
  });

  it("rejects assets declared as text/html or text/javascript", () => {
    for (const contentType of ["text/html", "text/javascript; charset=utf-8", "application/json"]) {
      const manifest = Result.getOrThrow(
        decodeManifest(withTopLevel({ assets: [artifact(ASSET_PATH, hex("4"), contentType)] })),
      );
      const violations = validateManifestConstraints(manifest);
      expect(
        violations.some((v) => v.includes("not allowed for assets")),
        `contentType ${contentType}`,
      ).toBe(true);
    }
  });

  it("accepts image/* and font/* assets", () => {
    for (const contentType of ["image/webp", "font/woff2"]) {
      const manifest = Result.getOrThrow(
        decodeManifest(withTopLevel({ assets: [artifact(ASSET_PATH, hex("4"), contentType)] })),
      );
      expect(
        validateManifestConstraints(manifest).some((v) => v.includes("not allowed for assets")),
      ).toBe(false);
    }
  });

  it("rejects components with empty previews", () => {
    const component = baseComponent();
    component.previews = [];
    const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ components: [component] })));
    const violations = validateManifestConstraints(manifest);
    expect(violations).toEqual(['component "product-option": previews must not be empty']);
  });

  it("rejects preview state names outside the safe single-segment alphabet", () => {
    for (const state of [
      "de/fault",
      "-leading",
      "_leading",
      "a".repeat(65),
      "with space",
      "dot.",
    ]) {
      const component = baseComponent();
      component.previews[0]!.state = state;
      const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ components: [component] })));
      const violations = validateManifestConstraints(manifest);
      expect(
        violations.some((v) => v.includes(`state "${state}" is malformed`)),
        `state ${state}`,
      ).toBe(true);
    }
  });

  it("accepts mixed-case, digit, underscore, and dash preview states", () => {
    for (const state of ["default", "Trial-2", "a", "STATE_b", "0state"]) {
      const component = baseComponent();
      component.previews[0]!.state = state;
      const manifest = Result.getOrThrow(decodeManifest(withTopLevel({ components: [component] })));
      expect(validateManifestConstraints(manifest), `state ${state}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// §1.2 contentHash helpers
// ---------------------------------------------------------------------------

describe("contentHash helpers", () => {
  it.effect("sha256Hex matches the NIST test vectors", () =>
    Effect.gen(function* () {
      expect(yield* sha256Hex("abc")).toBe(SHA256_OF_ABC);
      expect(yield* sha256Hex(new TextEncoder().encode("abc"))).toBe(SHA256_OF_ABC);
      expect(yield* sha256Hex("")).toBe(SHA256_OF_EMPTY);
    }),
  );

  it("builds the §1.2 paywall preimage with sorted asset hashes", () => {
    expect(
      paywallContentHashPreimage({
        assetSha256s: [hex("f"), hex("0")],
        htmlSha256: hex("b"),
        jsSha256: hex("c"),
      }),
    ).toBe(`${hex("b")}:${hex("c")}:${hex("0")}:${hex("f")}`);
  });

  it("builds the §1.2 paywall preimage with no assets", () => {
    expect(
      paywallContentHashPreimage({ assetSha256s: [], htmlSha256: hex("b"), jsSha256: hex("c") }),
    ).toBe(`${hex("b")}:${hex("c")}:`);
  });

  it("builds the §1.2 component preimage with empty panel slot", () => {
    expect(
      componentContentHashPreimage({
        manifestSha256: hex("f"),
        panelSha256: null,
        previewSha256s: [hex("1"), hex("0")],
        runtimeSha256: hex("a"),
      }),
    ).toBe(`${hex("f")}:${hex("a")}::${hex("0")}:${hex("1")}`);
  });

  it("builds the §1.2 component preimage with a panel hash", () => {
    expect(
      componentContentHashPreimage({
        manifestSha256: hex("f"),
        panelSha256: hex("9"),
        previewSha256s: [],
        runtimeSha256: hex("a"),
      }),
    ).toBe(`${hex("f")}:${hex("a")}:${hex("9")}:`);
  });

  it.effect("computePaywallContentHash hashes the preimage", () =>
    Effect.gen(function* () {
      const input = { assetSha256s: [hex("4")], htmlSha256: hex("b"), jsSha256: hex("c") };
      expect(yield* computePaywallContentHash(input)).toBe(
        yield* sha256Hex(paywallContentHashPreimage(input)),
      );
    }),
  );
});

// ---------------------------------------------------------------------------
// Canonical manifest hash
// ---------------------------------------------------------------------------

describe("canonicalJsonStringify / computeManifestHash", () => {
  it("is insensitive to object key order, recursively", () => {
    expect(canonicalJsonStringify({ a: { y: 2, x: 1 }, b: [{ d: 4, c: 3 }] })).toBe(
      canonicalJsonStringify({ b: [{ c: 3, d: 4 }], a: { x: 1, y: 2 } }),
    );
  });

  it("preserves array order", () => {
    expect(canonicalJsonStringify([2, 1])).not.toBe(canonicalJsonStringify([1, 2]));
  });

  it("drops undefined-valued keys like JSON.stringify", () => {
    expect(canonicalJsonStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("round-trips to the same JSON value", () => {
    const manifest = baseManifest();
    expect(decodeJson(canonicalJsonStringify(manifest))).toEqual(manifest);
  });

  it.effect("computeManifestHash is stable across decode round-trips", () =>
    Effect.gen(function* () {
      const first = yield* computeManifestHash(decodedBaseManifest());
      const second = yield* computeManifestHash(decodedBaseManifest());
      expect(first).toBe(second);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
    }),
  );
});

// ---------------------------------------------------------------------------
// Storage / serving key derivation
// ---------------------------------------------------------------------------

describe("serving key derivation", () => {
  it("derives upload-side blob keys", () => {
    expect(blobStorageKey("proj_1", hex("a"))).toBe(`blobs/proj_1/${hex("a")}`);
  });

  it("derives §5 serving keys", () => {
    expect(paywallServingHtmlKey(hex("d"))).toBe(`p/${hex("d")}/index.html`);
    expect(paywallServingJsKey(hex("d"))).toBe(`p/${hex("d")}/bundle.js`);
    expect(paywallServingAssetKey(hex("d"), ASSET_PATH)).toBe(
      `p/${hex("d")}/assets/hero-AB12CD.png`,
    );
  });

  it("derives asset basenames from POSIX paths", () => {
    expect(assetBasename("a/b/c.png")).toBe("c.png");
    expect(assetBasename("c.png")).toBe("c.png");
  });

  it("derives all serving copies for a paywall", () => {
    const manifest = decodedBaseManifest();
    const paywall = manifest.paywalls[0]!;
    const copies = servingCopiesForPaywall(paywall, manifestAssetsByPath(manifest));
    expect(copies).toEqual([
      {
        contentType: "text/html; charset=utf-8",
        sha256: hex("b"),
        targetKey: `p/${hex("d")}/index.html`,
      },
      {
        contentType: "text/javascript; charset=utf-8",
        sha256: hex("c"),
        targetKey: `p/${hex("d")}/bundle.js`,
      },
      {
        contentType: "image/png",
        sha256: hex("4"),
        targetKey: `p/${hex("d")}/assets/hero-AB12CD.png`,
      },
    ]);
  });

  it("derives §5.1 component serving keys", () => {
    expect(componentServingPrefix(hex("2"))).toBe(`c/${hex("2")}`);
    expect(componentServingManifestKey(hex("2"))).toBe(`c/${hex("2")}/manifest.json`);
    expect(componentServingPreviewKey(hex("2"), "trial")).toBe(`c/${hex("2")}/previews/trial.json`);
    expect(componentServingRuntimeKey(hex("2"))).toBe(`c/${hex("2")}/runtime.js`);
    expect(componentServingPanelKey(hex("2"))).toBe(`c/${hex("2")}/panel.js`);
  });

  it("derives all serving copies for a panel-less component (no panel.js)", () => {
    const manifest = decodedBaseManifest();
    const component = manifest.components[0]!;
    expect(servingCopiesForComponent(component)).toEqual([
      {
        contentType: "application/json",
        sha256: hex("f"),
        targetKey: `c/${hex("2")}/manifest.json`,
      },
      {
        contentType: "application/json",
        sha256: hex("0"),
        targetKey: `c/${hex("2")}/previews/default.json`,
      },
      {
        contentType: "text/javascript; charset=utf-8",
        sha256: hex("1"),
        targetKey: `c/${hex("2")}/runtime.js`,
      },
    ]);
  });

  it("derives panel.js and every preview state when declared", () => {
    const manifest = Result.getOrThrow(
      decodeManifest(withTopLevel({ components: [componentWithPanel()] })),
    );
    const copies = servingCopiesForComponent(manifest.components[0]!);
    expect(copies.map((copy) => copy.targetKey)).toEqual([
      `c/${hex("2")}/manifest.json`,
      `c/${hex("2")}/previews/default.json`,
      `c/${hex("2")}/previews/trial.json`,
      `c/${hex("2")}/runtime.js`,
      `c/${hex("2")}/panel.js`,
    ]);
    expect(copies.find((copy) => copy.targetKey.endsWith("panel.js"))?.sha256).toBe(hex("9"));
  });
});

// ---------------------------------------------------------------------------
// Read-time catalog metadata derivation
// ---------------------------------------------------------------------------

describe("componentServingMetadata", () => {
  it("derives previewStates and hasPanel from the matched component entry", () => {
    const manifest = decodedBaseManifest();
    expect(componentServingMetadata(manifest, hex("2"))).toEqual({
      hasPanel: false,
      previewStates: ["default"],
    });
  });

  it("reports hasPanel for components declaring a panel bundle", () => {
    const manifest = Result.getOrThrow(
      decodeManifest(withTopLevel({ components: [componentWithPanel()] })),
    );
    expect(componentServingMetadata(manifest, hex("2"))).toEqual({
      hasPanel: true,
      previewStates: ["default", "trial"],
    });
  });

  it("matches the entry by contentHash among multiple components", () => {
    const other = baseComponent();
    other.id = "other-component";
    other.contentHash = hex("7");
    other.previews = [
      {
        file: artifact(
          ".voidhash/.build/components/other-component/previews/compact.json",
          hex("6"),
          "application/json",
        ),
        state: "compact",
      },
    ];
    const manifest = Result.getOrThrow(
      decodeManifest(withTopLevel({ components: [baseComponent(), other] })),
    );
    expect(componentServingMetadata(manifest, hex("7"))).toEqual({
      hasPanel: false,
      previewStates: ["compact"],
    });
  });

  it("returns null when the manifest carries no component with the contentHash", () => {
    expect(componentServingMetadata(decodedBaseManifest(), hex("5"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Manifest traversal helpers
// ---------------------------------------------------------------------------

describe("manifest traversal helpers", () => {
  it("flattens every referenced file with its role", () => {
    const entries = manifestFileEntries(decodedBaseManifest());
    const byRole = new Map<string, number>();
    for (const entry of entries) {
      byRole.set(entry.role, (byRole.get(entry.role) ?? 0) + 1);
    }
    expect(byRole.get("source")).toBe(2);
    expect(byRole.get("paywallHtml")).toBe(1);
    expect(byRole.get("paywallJs")).toBe(1);
    expect(byRole.get("componentManifest")).toBe(1);
    expect(byRole.get("componentPreview")).toBe(1);
    expect(byRole.get("componentRuntime")).toBe(1);
    expect(byRole.get("config")).toBe(1);
    expect(byRole.get("asset")).toBe(1);
    expect(byRole.get("componentPanel")).toBeUndefined();
  });

  it("collects distinct hashes", () => {
    const hashes = collectManifestHashes(decodedBaseManifest());
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(hashes).toContain(hex("a"));
    expect(hashes).toContain(hex("4"));
  });

  it("finds declared contentTypes by hash", () => {
    const manifest = decodedBaseManifest();
    expect(findDeclaredContentType(manifest, hex("b"))).toBe("text/html; charset=utf-8");
    expect(findDeclaredContentType(manifest, hex("4"))).toBe("image/png");
    // Source files are DeployFiles without a contentType.
    expect(findDeclaredContentType(manifest, hex("a"))).toBeNull();
    expect(findDeclaredContentType(manifest, hex("9"))).toBeNull();
  });

  it("carries the declared bytes on every entry", () => {
    const entries = manifestFileEntries(decodedBaseManifest());
    expect(entries.every((entry) => entry.bytes === 100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §1.1 size caps on actual/recorded bytes
// ---------------------------------------------------------------------------

describe("sizeCapForRole", () => {
  it("maps every role to its §1.1 cap", () => {
    expect(sizeCapForRole("paywallHtml")).toBe(SIZE_CAPS.html);
    expect(sizeCapForRole("paywallJs")).toBe(SIZE_CAPS.jsBundle);
    expect(sizeCapForRole("componentRuntime")).toBe(SIZE_CAPS.jsBundle);
    expect(sizeCapForRole("componentPanel")).toBe(SIZE_CAPS.jsBundle);
    expect(sizeCapForRole("asset")).toBe(SIZE_CAPS.asset);
    expect(sizeCapForRole("source")).toBe(SIZE_CAPS.sourceFile);
    expect(sizeCapForRole("config")).toBe(SIZE_CAPS.config);
    expect(sizeCapForRole("componentManifest")).toBe(SIZE_CAPS.componentManifest);
    expect(sizeCapForRole("componentPreview")).toBe(SIZE_CAPS.previewTree);
  });
});

describe("validateUploadedBlobSize", () => {
  const entry = (role: ManifestFileEntry["role"], bytes: number): ManifestFileEntry => ({
    bytes,
    logicalPath: `path/to/${role}`,
    role,
    sha256: hex("a"),
  });

  it("passes when the body matches the declared bytes and fits the cap", () => {
    expect(validateUploadedBlobSize([entry("paywallHtml", 100)], 100)).toEqual([]);
  });

  it("rejects a declared/actual byte mismatch, naming both numbers", () => {
    const violations = validateUploadedBlobSize([entry("paywallHtml", 100)], 120);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("120 bytes");
    expect(violations[0]).toContain("declares 100 bytes");
  });

  it("rejects bodies exceeding the role cap even when declared bytes agree", () => {
    const oversize = SIZE_CAPS.html + 1;
    const violations = validateUploadedBlobSize([entry("paywallHtml", oversize)], oversize);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain(`exceeds the ${SIZE_CAPS.html}-byte cap`);
  });

  it("applies the role-appropriate cap per declared entry", () => {
    const size = SIZE_CAPS.config + 1;
    // The same hash declared as js (cap 5 MB, fine) and config (cap 256 KB, violated).
    const violations = validateUploadedBlobSize(
      [entry("paywallJs", size), entry("config", size)],
      size,
    );
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("config");
  });

  it("enforces the source-file and config caps", () => {
    const sourceSize = SIZE_CAPS.sourceFile + 1;
    expect(validateUploadedBlobSize([entry("source", sourceSize)], sourceSize)[0]).toContain(
      `exceeds the ${SIZE_CAPS.sourceFile}-byte cap`,
    );
    const configSize = SIZE_CAPS.config + 1;
    expect(validateUploadedBlobSize([entry("config", configSize)], configSize)[0]).toContain(
      `exceeds the ${SIZE_CAPS.config}-byte cap`,
    );
  });
});

describe("validateRecordedBlobCaps", () => {
  it("passes when every recorded blob fits its role cap", () => {
    const manifest = decodedBaseManifest();
    const bytes = new Map(collectManifestHashes(manifest).map((hash) => [hash, 100]));
    expect(validateRecordedBlobCaps(manifest, bytes)).toEqual([]);
  });

  it("skips hashes without recorded rows (reported separately as incomplete)", () => {
    expect(validateRecordedBlobCaps(decodedBaseManifest(), new Map())).toEqual([]);
  });

  it("flags recorded blobs exceeding the role cap", () => {
    const manifest = decodedBaseManifest();
    const bytes = new Map(collectManifestHashes(manifest).map((hash) => [hash, 100]));
    // hex("b") is the paywall html artifact in the base fixture.
    bytes.set(hex("b"), SIZE_CAPS.html + 1);
    const violations = validateRecordedBlobCaps(manifest, bytes);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("paywallHtml");
    expect(violations[0]).toContain(`exceeding the ${SIZE_CAPS.html}-byte cap`);
  });
});
