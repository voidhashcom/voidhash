/**
 * Contract test locking this server trust-boundary module to the OSS single
 * source of truth, `@voidhash/paywalls/schema` (Wave 2 of the paywall authoring
 * unification, `docs/feature-specs/paywall-authoring-unification.md`).
 *
 * The OSS package ships dependency-free validators (`parsePreviewTree`,
 * `parseComponentManifest`) that mirror the effect-Schema decoders here so the
 * CLI, studio sandbox, and any JS consumer validate the same §2/§3 wire formats
 * without pulling in `effect`. This test is the "hard gate" from the spec's Top
 * Risks §3: it fails the moment the two drift on version, style vocabulary, or
 * accept/reject behaviour.
 *
 * DELIBERATE DIVERGENCE (Wave-1 handoff): the OSS validators are stricter than
 * these raw effect-Schema struct decodes on exactly four points, because the
 * server enforces those at an ADJACENT layer, not at struct decode:
 *   1. `tree.state` must match {@link PREVIEW_STATE_PATTERN} — server enforces via
 *      `validateManifestConstraints` on `components[].previews[].state`.
 *   2. `manifest.previewStates` must be non-empty — server enforces via
 *      `validateManifestConstraints` (`previews must not be empty`).
 *   3. `manifest.hostData` must be a subset of `{"products"}` — server enforces
 *      via the `ManifestHostData` type (`"products"` is the only Phase-1 kind).
 *   4. Current OSS accepts only preview tree v2, while the server temporarily
 *      retains v1 decode support during the motion rollout.
 * Those four get their own assertions below showing OSS-strict /
 * server-lenient-at-this-layer, per the spec — the contract test accounts for
 * the difference, it does not "fix" it.
 */
import { constant } from "@voidhash/lib/lang";
import { Effect, Result, Schema } from "effect";
import {
  COMPONENT_MANIFEST_VERSION as OSS_COMPONENT_MANIFEST_VERSION,
  PAYWALL_STYLE_KEY_LIST as OSS_STYLE_KEY_LIST,
  PAYWALL_TREE_VERSION as OSS_TREE_VERSION,
  parseComponentManifest,
  parsePreviewTree,
  type ComponentManifest as OssComponentManifest,
  type PaywallNodeTree,
  type PaywallStyle,
} from "@voidhash/paywalls/schema";
import { describe, expect, it } from "vite-plus/test";

import {
  COMPONENT_MANIFEST_VERSION,
  ComponentManifestSchema,
  PREVIEW_TREE_VERSION,
  PreviewStyleSchema,
  PreviewTreeSchema,
  strictParseOptions,
  type ComponentManifest,
  type PreviewStyle,
  type PreviewTree,
} from "./PaywallDeployManifest.ts";

// ---------------------------------------------------------------------------
// Server decode helpers (the trust boundary), mirroring the unit-test style.
// ---------------------------------------------------------------------------

const decodePreviewTree = (input: unknown) =>
  Effect.runSync(
    Effect.result(Schema.decodeUnknownEffect(PreviewTreeSchema, strictParseOptions)(input)),
  );

const decodeComponentManifest = (input: unknown) =>
  Effect.runSync(
    Effect.result(Schema.decodeUnknownEffect(ComponentManifestSchema, strictParseOptions)(input)),
  );

const serverAcceptsTree = (input: unknown) => Result.isSuccess(decodePreviewTree(input));
const serverAcceptsManifest = (input: unknown) => Result.isSuccess(decodeComponentManifest(input));

const ossAcceptsTree = (input: unknown) => parsePreviewTree(input).ok;
const ossAcceptsManifest = (input: unknown) => parseComponentManifest(input).ok;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validTree = () =>
  constant({
    treeVersion: OSS_TREE_VERSION,
    state: "default",
    root: {
      type: "view",
      style: {
        flexDirection: "column",
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: "#ffffff",
        gap: 8,
      },
      children: [
        { type: "text", style: { fontSize: 18, fontWeight: 700, color: "#111827" }, text: "Go Pro" },
        {
          type: "pressable",
          style: {
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 12,
            paddingRight: 12,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            backgroundColor: "#2563eb",
          },
          children: [{ type: "text", style: { color: "#ffffff" }, text: "Subscribe" }],
          action: "purchase",
        },
        {
          type: "image",
          style: { width: 120, height: 120 },
          src: "https://x/hero.png",
          resizeMode: "cover",
        },
        { type: "slot" },
      ],
    },
  });

const validManifest = () =>
  constant({
    manifestVersion: 2,
    title: "Pro Card",
    description: "Upsell card",
    props: {
      heading: { kind: "string", optional: false },
      accent: { kind: "string", editor: "color", optional: true, default: "#2563eb" },
      count: { kind: "number", optional: true, default: 3 },
      featured: { kind: "boolean", optional: true },
      variant: { kind: "select", options: ["a", "b"], optional: false },
      hero: { kind: "image", optional: true },
      product: { kind: "ref", refType: "product", optional: false },
      child: { kind: "component", optional: true },
      bullets: { kind: "array", item: { kind: "string" }, optional: true },
    },
    actions: { purchase: { payload: {} }, dismiss: { payload: { reason: { kind: "string" } } } },
    slot: true,
    previewStates: ["default", "loading"],
    hostData: ["products"],
  });

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------

describe("OSS ↔ server version constants", () => {
  it("preview tree version matches", () => {
    expect(OSS_TREE_VERSION).toBe(PREVIEW_TREE_VERSION);
  });

  it("component manifest version matches", () => {
    expect(OSS_COMPONENT_MANIFEST_VERSION).toBe(COMPONENT_MANIFEST_VERSION);
  });
});

// ---------------------------------------------------------------------------
// §3.1 style vocabulary
// ---------------------------------------------------------------------------

describe("OSS ↔ server style vocabulary", () => {
  it("set-equals the server preview style schema keys", () => {
    // Introspect the effect Schema's struct fields to get the exact accepted keys.
    const serverKeys = Object.keys(PreviewStyleSchema.fields).sort();
    const ossKeys = [...OSS_STYLE_KEY_LIST].sort();
    expect(ossKeys).toStrictEqual(serverKeys);
  });

  it("every OSS style key is decoded by the server, and vice versa", () => {
    // A tree whose view style carries EVERY vocabulary key must decode on the
    // server — proving it accepts the full OSS set. Scalar keys take a numeric
    // value; the three structured background keys take a valid sample matching
    // the OSS validator's shape (a bare `1` is not a legal object there).
    const structured: Record<string, unknown> = {
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [{ color: "rgba(0, 0, 0, 1)", position: 0 }],
      },
      backgroundImage: { url: "https://x/y.png", resizeMode: "cover" },
    };
    const style = Object.fromEntries(OSS_STYLE_KEY_LIST.map((key) => [key, structured[key] ?? 1]));
    expect(
      serverAcceptsTree({
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "view", style, children: [] },
      }),
    ).toBe(true);
    // Conversely, any key OUTSIDE the OSS set is rejected by both.
    const bogus = {
      treeVersion: OSS_TREE_VERSION,
      state: "default",
      root: { type: "view", style: { zoom: 2 }, children: [] },
    };
    expect(serverAcceptsTree(bogus)).toBe(false);
    expect(ossAcceptsTree(bogus)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture agreement — §3 preview trees
// ---------------------------------------------------------------------------

describe("OSS ↔ server preview tree fixture agreement", () => {
  it("both accept a valid tree", () => {
    expect(ossAcceptsTree(validTree())).toBe(true);
    expect(serverAcceptsTree(validTree())).toBe(true);
  });

  const rejectedByBoth: ReadonlyArray<readonly [string, unknown]> = [
    [
      "unknown node type",
      {
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "canvas", style: {}, children: [] },
      },
    ],
    [
      "unknown key on a node",
      {
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "view", style: {}, children: [], onPress: "x" },
      },
    ],
    [
      "out-of-vocabulary style key",
      {
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "view", style: { boxShadow: "0 0 1px" }, children: [] },
      },
    ],
    [
      "wrong treeVersion",
      { treeVersion: 3, state: "default", root: { type: "view", style: {}, children: [] } },
    ],
    [
      "bad image resizeMode",
      {
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "image", style: {}, src: "x", resizeMode: "fill" },
      },
    ],
    ["missing root", { treeVersion: OSS_TREE_VERSION, state: "default" }],
    [
      "text node missing text",
      {
        treeVersion: OSS_TREE_VERSION,
        state: "default",
        root: { type: "text", style: {} },
      },
    ],
  ];

  for (const [name, input] of rejectedByBoth) {
    it(`both reject: ${name}`, () => {
      expect(ossAcceptsTree(input), `OSS should reject ${name}`).toBe(false);
      expect(serverAcceptsTree(input), `server should reject ${name}`).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Fixture agreement — §2 component manifests
// ---------------------------------------------------------------------------

describe("OSS ↔ server component manifest fixture agreement", () => {
  it("both accept a valid manifest", () => {
    expect(ossAcceptsManifest(validManifest())).toBe(true);
    expect(serverAcceptsManifest(validManifest())).toBe(true);
  });

  it("both accept `localizable` on string and image props", () => {
    const input = {
      ...validManifest(),
      props: {
        heading: { kind: "string", optional: false, localizable: true },
        hero: { kind: "image", optional: true, localizable: true },
      },
    };
    expect(ossAcceptsManifest(input)).toBe(true);
    expect(serverAcceptsManifest(input)).toBe(true);
  });

  const rejectedByBoth: ReadonlyArray<readonly [string, unknown]> = [
    // `localizable` is a string/image-only flag; on any other kind it is an
    // unknown key both sides reject.
    [
      "localizable on a number prop",
      { ...validManifest(), props: { x: { kind: "number", localizable: true, optional: false } } },
    ],
    ["wrong manifestVersion", { ...validManifest(), manifestVersion: 1 }],
    ["unknown top-level key", { ...validManifest(), extraneous: true }],
    // v2 dropped `id`: a component is identified by its file path, so an
    // id-bearing manifest is an unknown-key rejection on both sides.
    ["id-bearing manifest", { ...validManifest(), id: "pro-card" }],
    ["unknown prop kind", { ...validManifest(), props: { x: { kind: "date", optional: false } } }],
    [
      "unknown key on a prop",
      { ...validManifest(), props: { x: { kind: "string", weird: 1, optional: false } } },
    ],
    [
      "empty select options",
      { ...validManifest(), props: { x: { kind: "select", options: [], optional: false } } },
    ],
    [
      "array item that is itself an array",
      {
        ...validManifest(),
        props: { x: { kind: "array", item: { kind: "array" }, optional: false } },
      },
    ],
    [
      "editor on a non-string prop",
      { ...validManifest(), props: { x: { kind: "number", editor: "color", optional: false } } },
    ],
    [
      "malformed action payload kind",
      { ...validManifest(), actions: { go: { payload: { f: { kind: "object" } } } } },
    ],
    ["non-boolean slot", { ...validManifest(), slot: "yes" }],
    [
      "bad ref refType",
      { ...validManifest(), props: { x: { kind: "ref", refType: "user", optional: false } } },
    ],
    // `default` on a ref/component prop: the server's Ref/Component prop structs
    // carry no `default` field, so a present one is an excess property both sides
    // reject. The OSS validator now splits its base key set to match.
    [
      "default on a ref prop",
      {
        ...validManifest(),
        props: { x: { kind: "ref", refType: "product", default: "p", optional: false } },
      },
    ],
    [
      "default on a component prop",
      { ...validManifest(), props: { x: { kind: "component", default: "z", optional: false } } },
    ],
    // Array items are validated exactly like top-level props (minus the `array`
    // kind), so a malformed common field on an item is rejected by both.
    [
      "malformed common field on an array item",
      {
        ...validManifest(),
        props: { x: { kind: "array", item: { kind: "string", optional: "yes" }, optional: false } },
      },
    ],
    [
      "wrong-typed default on an array item",
      {
        ...validManifest(),
        props: { x: { kind: "array", item: { kind: "number", default: "nope" }, optional: false } },
      },
    ],
  ];

  for (const [name, input] of rejectedByBoth) {
    it(`both reject: ${name}`, () => {
      expect(ossAcceptsManifest(input), `OSS should reject ${name}`).toBe(false);
      expect(serverAcceptsManifest(input), `server should reject ${name}`).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// The four DELIBERATE layer-difference points (Wave-1 handoff + motion rollout).
// OSS `./schema` is stricter here; the server enforces the same rule one layer
// out (validateManifestConstraints / the ManifestHostData type), so its raw
// struct decode is intentionally lenient. See the module doc comment.
// ---------------------------------------------------------------------------

describe("deliberate OSS-strict / server-lenient-at-this-layer divergences", () => {
  it("tree.state pattern: OSS rejects, server struct-decode accepts", () => {
    // Server: PreviewTreeSchema `state: Schema.String`; the PREVIEW_STATE_PATTERN
    // check lives in validateManifestConstraints on the manifest preview state.
    const spacedState = {
      treeVersion: OSS_TREE_VERSION,
      state: "has space",
      root: { type: "view", style: {}, children: [] },
    };
    expect(ossAcceptsTree(spacedState)).toBe(false);
    expect(serverAcceptsTree(spacedState)).toBe(true);
  });

  it("legacy preview tree v1: current OSS rejects, rollout server decode accepts", () => {
    const legacyTree = { ...validTree(), treeVersion: 1 };
    expect(ossAcceptsTree(legacyTree)).toBe(false);
    expect(serverAcceptsTree(legacyTree)).toBe(true);
  });

  it("previewStates non-empty: OSS rejects empty, server struct-decode accepts", () => {
    // Server: ComponentManifestSchema `previewStates` is optional Array; the
    // "previews must not be empty" rule lives in validateManifestConstraints.
    const emptyStates = { ...validManifest(), previewStates: [] };
    expect(ossAcceptsManifest(emptyStates)).toBe(false);
    expect(serverAcceptsManifest(emptyStates)).toBe(true);
  });

  it("hostData subset: OSS rejects unknown host data, server struct-decode accepts", () => {
    // Server: ComponentManifestSchema `hostData` is optional Array<String>; the
    // `"products"`-only constraint is the ManifestHostData type, one layer out.
    const badHost = { ...validManifest(), hostData: ["users"] };
    expect(ossAcceptsManifest(badHost)).toBe(false);
    expect(serverAcceptsManifest(badHost)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type assignability (compile-time only). The server's decoded types use
// `string | number` style values (a strict SUPERSET of OSS's per-key literal
// unions), so OSS values assign INTO the server types. The reverse (server →
// OSS) does not hold for styles and is intentionally not asserted.
// ---------------------------------------------------------------------------

describe("type assignability (compile-time)", () => {
  it("OSS PaywallNodeTree is assignable to the server PreviewTree", () => {
    const ossTree: PaywallNodeTree = validTree();
    const asServer: PreviewTree = ossTree;
    expect(asServer.treeVersion).toBe(OSS_TREE_VERSION);
  });

  it("OSS PaywallStyle is assignable to the server PreviewStyle", () => {
    const ossStyle: PaywallStyle = { flexDirection: "row", flex: 1, color: "#000" };
    const asServer: PreviewStyle = ossStyle;
    expect(asServer.flex).toBe(1);
  });

  it("a valid manifest satisfies both the OSS and the server manifest types", () => {
    // The two `ComponentManifest` types are NOT mutually assignable — OSS types
    // a prop `default` as `unknown` and `optional` as required, while the server
    // narrows `default` per kind and leaves `optional` optional. So instead of a
    // whole-value alias we assert one fixture is a member of BOTH types.
    const oss: OssComponentManifest = validManifest();
    const server: ComponentManifest = validManifest();
    expect(oss.manifestVersion).toBe(server.manifestVersion);
  });
});
