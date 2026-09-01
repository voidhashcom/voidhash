/**
 * Wire-format schemas + pure helpers for paywall code deploys.
 *
 * Mirrors `docs/specs/paywall-deploy-contract.md` (the source of truth) exactly:
 * §1 deploy manifest (`schemaVersion: 2`), §2 component manifest, §3 preview
 * node tree, §1.2 contentHash recomputation, and the §5 serving-layout key
 * derivation. Everything in this module is pure — service-side orchestration
 * lives in `PaywallDeployService`.
 */
import { constant } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

import { promiseOrDie } from "../../effect-boundary.ts";
import { createHash } from "../apiKeys/create-hash.ts";

/** JSON serialization for the canonical hash preimage. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJsonRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));

/** Manifest major version this server build understands (contract §1/§8). */
export const DEPLOY_MANIFEST_SCHEMA_VERSION = 2;

/**
 * Component manifest version validated at finalize (contract §2/§8). v2 dropped
 * the manifest `id` field — a component is identified by its file path in the
 * paywall document, not an embedded slug — kept in lockstep with the OSS
 * `@voidhash/paywalls/schema` single source of truth (enforced by the contract
 * test).
 */
export const COMPONENT_MANIFEST_VERSION = 2;

/** New preview artifacts emit v2; decoders retain v1 support during rollout. */
export const PREVIEW_TREE_VERSION = 2;

/** `paywalls[].id` / `components[].id` slug constraint (contract §1.1). */
export const DEPLOY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * `components[].previews[].state` constraint (contract §1.1): state names
 * become §5.1 serving object keys and URL path segments, so they are limited
 * to a safe single-segment alphabet.
 */
export const PREVIEW_STATE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/** Lowercase hex sha256 of raw bytes (contract §1). */
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

/** §1.1 size caps, in bytes. */
export const SIZE_CAPS = constant({
  jsBundle: 5 * 1024 * 1024,
  asset: 10 * 1024 * 1024,
  deployManifest: 1 * 1024 * 1024,
  componentManifest: 256 * 1024,
  previewTree: 512 * 1024,
  html: 1 * 1024 * 1024,
  sourceFile: 1 * 1024 * 1024,
  config: 256 * 1024,
});

/**
 * §1.1 contentType grammar: a bare media type plus an optional charset
 * parameter only. Inherently rejects CR/LF and other control bytes, so a
 * declared value is safe to store on the artifact object and echo verbatim
 * as a `Content-Type` response header.
 */
export const CONTENT_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+(;\s*charset=[\w-]+)?$/i;

/** Longest contentType value accepted (bare type + charset comfortably fit). */
export const CONTENT_TYPE_MAX_LENGTH = 100;

/**
 * §1.1 contentType allowlist, compared on the bare type (the segment before
 * `;`) — {@link CONTENT_TYPE_PATTERN} constrains any suffix to a charset
 * parameter only.
 */
export const CONTENT_TYPE_ALLOWLIST = HashSet.fromIterable([
  "text/html",
  "text/javascript",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
]);

/**
 * Strictest decode the server applies to wire payloads: every issue is
 * reported and unknown keys are rejected (contract: schemas "mirror this
 * document exactly"; §3 additionally mandates rejecting unknown keys).
 */
export const strictParseOptions = constant({
  errors: "all",
  onExcessProperty: "error",
});

// =============================================================================
// §1 Deploy manifest
// =============================================================================

const DeploySlug = Schema.String.check(Schema.isPattern(DEPLOY_SLUG_PATTERN));
const Sha256Hex = Schema.String.check(Schema.isPattern(SHA256_HEX_PATTERN));
const FileBytes = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** `DeployFile = { path, bytes, sha256 }` (contract §1). */
export const DeployFileDefinition = Schema.Struct({
  path: Schema.String.check(Schema.isMinLength(1)),
  bytes: FileBytes,
  sha256: Sha256Hex,
});
export type DeployFile = typeof DeployFileDefinition.Type;
export type DeployFileDefinition = typeof DeployFileDefinition.Type;

/** `DeployArtifact = DeployFile + { contentType }` (contract §1). */
export const DeployArtifactDefinition = Schema.Struct({
  ...DeployFileDefinition.fields,
  contentType: Schema.String.check(
    Schema.isMaxLength(CONTENT_TYPE_MAX_LENGTH),
    Schema.isPattern(CONTENT_TYPE_PATTERN),
  ),
});
export type DeployArtifact = typeof DeployArtifactDefinition.Type;
export type DeployArtifactDefinition = typeof DeployArtifactDefinition.Type;

/** `variables` values are `string | number | boolean` only (contract §1.1). */
export const VariableValueDefinition = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);
export type VariableValue = typeof VariableValueDefinition.Type;
export type VariableValueDefinition = typeof VariableValueDefinition.Type;

export const ManifestPaywallDefinition = Schema.Struct({
  id: DeploySlug,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  products: Schema.Array(Schema.String),
  variables: Schema.Record(Schema.String, VariableValueDefinition),
  source: DeployFileDefinition,
  artifacts: Schema.Struct({
    html: DeployArtifactDefinition,
    js: DeployArtifactDefinition,
  }),
  assets: Schema.Array(Schema.String),
  contentHash: Sha256Hex,
});
export type ManifestPaywall = typeof ManifestPaywallDefinition.Type;
export type ManifestPaywallDefinition = typeof ManifestPaywallDefinition.Type;

export const ManifestComponentPreviewDefinition = Schema.Struct({
  state: Schema.String.check(Schema.isMinLength(1)),
  file: DeployArtifactDefinition,
});
export type ManifestComponentPreview = typeof ManifestComponentPreviewDefinition.Type;
export type ManifestComponentPreviewDefinition = typeof ManifestComponentPreviewDefinition.Type;

export const ManifestComponentDefinition = Schema.Struct({
  id: DeploySlug,
  title: Schema.optional(Schema.String),
  source: DeployFileDefinition,
  manifest: DeployArtifactDefinition,
  previews: Schema.Array(ManifestComponentPreviewDefinition),
  artifacts: Schema.Struct({
    runtime: DeployArtifactDefinition,
    panel: Schema.NullOr(DeployArtifactDefinition),
  }),
  contentHash: Sha256Hex,
});
export type ManifestComponent = typeof ManifestComponentDefinition.Type;
export type ManifestComponentDefinition = typeof ManifestComponentDefinition.Type;

/** The §1 deploy manifest, `schemaVersion: 2`. */
export const PaywallDeployManifestDefinition = Schema.Struct({
  schemaVersion: Schema.Literal(DEPLOY_MANIFEST_SCHEMA_VERSION),
  cliVersion: Schema.String.check(Schema.isMinLength(1)),
  runtimeVersion: Schema.String.check(Schema.isMinLength(1)),
  team: Schema.String.check(Schema.isMinLength(1)),
  project: Schema.String.check(Schema.isMinLength(1)),
  createdAt: Schema.String,
  paywalls: Schema.Array(ManifestPaywallDefinition),
  components: Schema.Array(ManifestComponentDefinition),
  config: DeployFileDefinition,
  assets: Schema.Array(DeployArtifactDefinition),
});
export type PaywallDeployManifest = typeof PaywallDeployManifestDefinition.Type;
export type PaywallDeployManifestDefinition = typeof PaywallDeployManifestDefinition.Type;

// =============================================================================
// §2 Component manifest
// =============================================================================

const PropCommonFields = constant({
  label: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  optional: Schema.optional(Schema.Boolean),
});

const StringPropDefinition = Schema.Struct({
  kind: Schema.Literal("string"),
  default: Schema.optional(Schema.String),
  editor: Schema.optional(Schema.Literal("color")),
  // §2: string/image props may carry per-locale content overrides (OSS
  // `.localizable()`). Only present when true — kept in lockstep with the OSS
  // `@voidhash/paywalls` schema, which allows `localizable` on string/image only.
  localizable: Schema.optional(Schema.Boolean),
  ...PropCommonFields,
});

const NumberPropDefinition = Schema.Struct({
  kind: Schema.Literal("number"),
  default: Schema.optional(Schema.Number),
  ...PropCommonFields,
});

const BooleanPropDefinition = Schema.Struct({
  kind: Schema.Literal("boolean"),
  default: Schema.optional(Schema.Boolean),
  ...PropCommonFields,
});

const SelectPropDefinition = Schema.Struct({
  kind: Schema.Literal("select"),
  options: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
  default: Schema.optional(Schema.String),
  ...PropCommonFields,
});

const ImagePropDefinition = Schema.Struct({
  kind: Schema.Literal("image"),
  // §2: image default is a string URL/ref.
  default: Schema.optional(Schema.String),
  // §2: localizable content override flag — see {@link StringPropDefinition}.
  localizable: Schema.optional(Schema.Boolean),
  ...PropCommonFields,
});

const RefPropDefinition = Schema.Struct({
  kind: Schema.Literal("ref"),
  // P1: products are the only referenceable entity (contract §2).
  refType: Schema.Literal("product"),
  ...PropCommonFields,
});

const ComponentPropDefinition = Schema.Struct({
  kind: Schema.Literal("component"),
  ...PropCommonFields,
});

/** `array.item` must be a non-array kind (contract §2). */
const ArrayItemDefinition = Schema.Union([
  StringPropDefinition,
  NumberPropDefinition,
  BooleanPropDefinition,
  SelectPropDefinition,
  ImagePropDefinition,
  RefPropDefinition,
  ComponentPropDefinition,
]);

const ArrayPropDefinition = Schema.Struct({
  kind: Schema.Literal("array"),
  item: ArrayItemDefinition,
  // §2: array default is a scalar array.
  default: Schema.optional(
    Schema.Array(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
  ),
  ...PropCommonFields,
});

export const ComponentPropDefinitionDefinition = Schema.Union([
  StringPropDefinition,
  NumberPropDefinition,
  BooleanPropDefinition,
  SelectPropDefinition,
  ImagePropDefinition,
  RefPropDefinition,
  ComponentPropDefinition,
  ArrayPropDefinition,
]);
export type ComponentPropDefinition = typeof ComponentPropDefinitionDefinition.Type;
export type ComponentPropDefinitionDefinition = typeof ComponentPropDefinitionDefinition.Type;

const ActionPayloadFieldDefinition = Schema.Struct({
  kind: Schema.Literals(["string", "number", "boolean"]),
});

export const ComponentActionDefinition = Schema.Struct({
  payload: Schema.Record(Schema.String, ActionPayloadFieldDefinition),
});
export type ComponentAction = typeof ComponentActionDefinition.Type;
export type ComponentActionDefinition = typeof ComponentActionDefinition.Type;

/**
 * The §2 component manifest emitted per component by the CLI. v2 dropped the
 * manifest `id` field — a component is identified by its file path in the
 * paywall document, not an embedded slug — so an id-bearing manifest is
 * rejected here (unknown key under {@link strictParseOptions}).
 */
export const ComponentManifestDefinition = Schema.Struct({
  manifestVersion: Schema.Literal(COMPONENT_MANIFEST_VERSION),
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  props: Schema.Record(Schema.String, ComponentPropDefinitionDefinition),
  actions: Schema.optional(Schema.Record(Schema.String, ComponentActionDefinition)),
  slot: Schema.optional(Schema.Boolean),
  previewStates: Schema.optional(Schema.Array(Schema.String)),
  hostData: Schema.optional(Schema.Array(Schema.String)),
});
export type ComponentManifest = typeof ComponentManifestDefinition.Type;
export type ComponentManifestDefinition = typeof ComponentManifestDefinition.Type;
export { ComponentManifestDefinition as ComponentManifestSchema };

// =============================================================================
// §3 Preview node tree
// =============================================================================

/** §3.1 style values: numbers or strings (colors, `"50%"`); no arbitrary CSS. */
const StyleValue = Schema.Union([Schema.String, Schema.Number]);
const OptionalStyleValue = Schema.optional(StyleValue);

/**
 * Which background fill a node renders. Mirrors the OSS validator's
 * `BACKGROUND_TYPES` literal set exactly.
 */
const BackgroundTypeDefinition = Schema.Literals(["solid", "gradient", "image"]);

/**
 * A gradient color stop: an RGBA color string at a finite `0..1` position.
 * Mirrors the OSS validator's per-stop constraints (`color` string, `position`
 * a finite number).
 */
const GradientStopDefinition = Schema.Struct({
  color: Schema.String,
  position: Schema.Finite,
});

/**
 * A gradient background. Geometry is a two-point line in normalized node space;
 * mirrors the OSS validator's `validateBackgroundGradient` (kind literal, finite
 * coords, stops array of {@link GradientStopDefinition}).
 */
const BackgroundGradientDefinition = Schema.Struct({
  kind: Schema.Literals(["linear", "radial"]),
  startX: Schema.Finite,
  startY: Schema.Finite,
  endX: Schema.Finite,
  endY: Schema.Finite,
  stops: Schema.Array(GradientStopDefinition),
});

/**
 * An image background. Mirrors the OSS validator's `validateBackgroundImage`
 * (url string, resizeMode literal).
 */
const BackgroundImageDefinition = Schema.Struct({
  url: Schema.String,
  resizeMode: Schema.Literals(["cover", "contain", "stretch", "center"]),
});

/**
 * Closed §3.1 RN-compatible style vocabulary. Decoded with
 * {@link strictParseOptions}, so any key outside this set is rejected.
 */
export const PreviewStyleDefinition = Schema.Struct({
  // flexbox
  flex: OptionalStyleValue,
  flexDirection: OptionalStyleValue,
  alignItems: OptionalStyleValue,
  alignSelf: OptionalStyleValue,
  justifyContent: OptionalStyleValue,
  flexWrap: OptionalStyleValue,
  gap: OptionalStyleValue,
  flexGrow: OptionalStyleValue,
  flexShrink: OptionalStyleValue,
  flexBasis: OptionalStyleValue,
  // box
  width: OptionalStyleValue,
  height: OptionalStyleValue,
  minWidth: OptionalStyleValue,
  minHeight: OptionalStyleValue,
  maxWidth: OptionalStyleValue,
  maxHeight: OptionalStyleValue,
  paddingTop: OptionalStyleValue,
  paddingBottom: OptionalStyleValue,
  paddingLeft: OptionalStyleValue,
  paddingRight: OptionalStyleValue,
  marginTop: OptionalStyleValue,
  marginBottom: OptionalStyleValue,
  marginLeft: OptionalStyleValue,
  marginRight: OptionalStyleValue,
  aspectRatio: OptionalStyleValue,
  // border
  borderTopWidth: OptionalStyleValue,
  borderRightWidth: OptionalStyleValue,
  borderBottomWidth: OptionalStyleValue,
  borderLeftWidth: OptionalStyleValue,
  borderColor: OptionalStyleValue,
  borderTopLeftRadius: OptionalStyleValue,
  borderTopRightRadius: OptionalStyleValue,
  borderBottomLeftRadius: OptionalStyleValue,
  borderBottomRightRadius: OptionalStyleValue,
  borderStyle: OptionalStyleValue,
  // visual
  backgroundColor: OptionalStyleValue,
  backgroundType: Schema.optional(BackgroundTypeDefinition),
  backgroundGradient: Schema.optional(BackgroundGradientDefinition),
  backgroundImage: Schema.optional(BackgroundImageDefinition),
  opacity: OptionalStyleValue,
  overflow: OptionalStyleValue,
  // position
  position: OptionalStyleValue,
  top: OptionalStyleValue,
  right: OptionalStyleValue,
  bottom: OptionalStyleValue,
  left: OptionalStyleValue,
  zIndex: OptionalStyleValue,
  // text-only
  color: OptionalStyleValue,
  fontSize: OptionalStyleValue,
  fontWeight: OptionalStyleValue,
  fontStyle: OptionalStyleValue,
  lineHeight: OptionalStyleValue,
  letterSpacing: OptionalStyleValue,
  textAlign: OptionalStyleValue,
  textTransform: OptionalStyleValue,
  textDecorationLine: OptionalStyleValue,
  fontFamily: OptionalStyleValue,
});
export type PreviewStyle = typeof PreviewStyleDefinition.Type;
export type PreviewStyleDefinition = typeof PreviewStyleDefinition.Type;

/** The serializable rest-state motion vocabulary introduced by preview tree v2. */
export const PreviewMotionStyleDefinition = Schema.Struct({
  x: Schema.optional(Schema.Number),
  y: Schema.optional(Schema.Number),
  scale: Schema.optional(Schema.Number),
  scaleX: Schema.optional(Schema.Number),
  scaleY: Schema.optional(Schema.Number),
  rotate: Schema.optional(Schema.Number),
  opacity: Schema.optional(Schema.Number),
  backgroundColor: Schema.optional(Schema.String),
  transformOrigin: Schema.optional(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
});
export type PreviewMotionStyle = typeof PreviewMotionStyleDefinition.Type;
export type PreviewMotionStyleDefinition = typeof PreviewMotionStyleDefinition.Type;

export interface PreviewViewNode {
  readonly type: "view";
  readonly style: PreviewStyle;
  readonly motion?: PreviewMotionStyle;
  readonly children: ReadonlyArray<PreviewNode>;
}
export interface PreviewPressableNode {
  readonly type: "pressable";
  readonly style: PreviewStyle;
  readonly motion?: PreviewMotionStyle;
  readonly children: ReadonlyArray<PreviewNode>;
  readonly action?: string;
}
export interface PreviewScrollNode {
  readonly type: "scroll";
  readonly style: PreviewStyle;
  readonly motion?: PreviewMotionStyle;
  readonly children: ReadonlyArray<PreviewNode>;
}
export interface PreviewTextNode {
  readonly type: "text";
  readonly style: PreviewStyle;
  readonly motion?: PreviewMotionStyle;
  readonly text: string;
}
export interface PreviewImageNode {
  readonly type: "image";
  readonly style: PreviewStyle;
  readonly motion?: PreviewMotionStyle;
  readonly src: string;
  readonly resizeMode?: "cover" | "contain" | "stretch" | "center";
}
export interface PreviewSlotNode {
  readonly type: "slot";
}
export interface PreviewPlaceholderNode {
  readonly type: "placeholder";
  readonly reason: string;
}

/** Closed §3 node union — servers MUST reject unknown node types and keys. */
export type PreviewNode =
  | PreviewViewNode
  | PreviewPressableNode
  | PreviewScrollNode
  | PreviewTextNode
  | PreviewImageNode
  | PreviewSlotNode
  | PreviewPlaceholderNode;

const SuspendedPreviewNode = Schema.suspend((): Schema.Codec<PreviewNode> => PreviewNodeDefinition);

const PreviewViewNodeDefinition = Schema.Struct({
  type: Schema.Literal("view"),
  style: PreviewStyleDefinition,
  motion: Schema.optional(PreviewMotionStyleDefinition),
  children: Schema.Array(SuspendedPreviewNode),
});

const PreviewPressableNodeDefinition = Schema.Struct({
  type: Schema.Literal("pressable"),
  style: PreviewStyleDefinition,
  motion: Schema.optional(PreviewMotionStyleDefinition),
  children: Schema.Array(SuspendedPreviewNode),
  // The declared action name this pressable fires (contract §3).
  action: Schema.optional(Schema.String),
});

const PreviewScrollNodeDefinition = Schema.Struct({
  type: Schema.Literal("scroll"),
  style: PreviewStyleDefinition,
  motion: Schema.optional(PreviewMotionStyleDefinition),
  children: Schema.Array(SuspendedPreviewNode),
});

const PreviewTextNodeDefinition = Schema.Struct({
  type: Schema.Literal("text"),
  style: PreviewStyleDefinition,
  motion: Schema.optional(PreviewMotionStyleDefinition),
  text: Schema.String,
});

const PreviewImageNodeDefinition = Schema.Struct({
  type: Schema.Literal("image"),
  style: PreviewStyleDefinition,
  motion: Schema.optional(PreviewMotionStyleDefinition),
  src: Schema.String,
  resizeMode: Schema.optional(Schema.Literals(["cover", "contain", "stretch", "center"])),
});

const PreviewSlotNodeDefinition = Schema.Struct({
  type: Schema.Literal("slot"),
});

const PreviewPlaceholderNodeDefinition = Schema.Struct({
  type: Schema.Literal("placeholder"),
  reason: Schema.String,
});

export const PreviewNodeDefinition: Schema.Codec<PreviewNode> = Schema.Union([
  PreviewViewNodeDefinition,
  PreviewPressableNodeDefinition,
  PreviewScrollNodeDefinition,
  PreviewTextNodeDefinition,
  PreviewImageNodeDefinition,
  PreviewSlotNodeDefinition,
  PreviewPlaceholderNodeDefinition,
]);
export type PreviewNodeDefinition = typeof PreviewNodeDefinition.Type;

/** The §3 `previews/<state>.json` artifact: a tree of closed primitives. */
export const PreviewTreeDefinition = Schema.Struct({
  treeVersion: Schema.Union([Schema.Literal(1), Schema.Literal(PREVIEW_TREE_VERSION)]),
  state: Schema.String,
  root: PreviewNodeDefinition,
});
export type PreviewTree = typeof PreviewTreeDefinition.Type;
export type PreviewTreeDefinition = typeof PreviewTreeDefinition.Type;
export { PreviewTreeDefinition as PreviewTreeSchema };

/**
 * Counts `slot` nodes in a §3 preview tree. The contract allows at most one
 * slot marker per tree; finalize validation rejects trees where this exceeds 1.
 */
export const countSlotNodes = (node: PreviewNode): number => {
  if (node.type === "slot") {
    return 1;
  }
  if (node.type === "view" || node.type === "pressable" || node.type === "scroll") {
    return node.children.reduce((count, child) => count + countSlotNodes(child), 0);
  }
  return 0;
};

// =============================================================================
// §1.2 contentHash
// =============================================================================

/** Lowercase hex sha256 over a UTF-8 string or raw bytes (WebCrypto, workerd-safe). */
export const sha256Hex = (input: string | Uint8Array): Effect.Effect<string> =>
  promiseOrDie(() => createHash("SHA-256", "hex").digest(input));

/**
 * §1.2 paywall preimage: `sha256(html) + ":" + sha256(js) + ":" +
 * sortedAssetHashes.join(":")` — plain hex string concatenation.
 */
export const paywallContentHashPreimage = (input: {
  readonly htmlSha256: string;
  readonly jsSha256: string;
  readonly assetSha256s: ReadonlyArray<string>;
}): string =>
  `${input.htmlSha256}:${input.jsSha256}:${Arr.sort(input.assetSha256s, Order.String).join(":")}`;

/** Recomputes a paywall's §1.2 contentHash from its manifest-listed file hashes. */
export const computePaywallContentHash = (input: {
  readonly htmlSha256: string;
  readonly jsSha256: string;
  readonly assetSha256s: ReadonlyArray<string>;
}): Effect.Effect<string> => sha256Hex(paywallContentHashPreimage(input));

/**
 * §1.2 component preimage: `sha256(manifest) + ":" + sha256(runtime) + ":" +
 * (sha256(panel) | "") + ":" + sortedPreviewHashes.join(":")`.
 */
export const componentContentHashPreimage = (input: {
  readonly manifestSha256: string;
  readonly runtimeSha256: string;
  readonly panelSha256: Option.Option<string>;
  readonly previewSha256s: ReadonlyArray<string>;
}): string =>
  `${input.manifestSha256}:${input.runtimeSha256}:${Option.getOrElse(input.panelSha256, () => "")}:${Arr.sort(input.previewSha256s, Order.String).join(":")}`;

/** Recomputes a component's §1.2 contentHash from its manifest-listed file hashes. */
export const computeComponentContentHash = (input: {
  readonly manifestSha256: string;
  readonly runtimeSha256: string;
  readonly panelSha256: Option.Option<string>;
  readonly previewSha256s: ReadonlyArray<string>;
}): Effect.Effect<string> => sha256Hex(componentContentHashPreimage(input));

/**
 * Deterministic JSON serialization with recursively sorted object keys.
 * `sha256Hex(canonicalJsonStringify(manifest))` is the deploy's idempotency
 * key (`paywall_deploy.manifest_hash`): the same manifest re-POSTed always
 * hashes identically regardless of key order.
 */
export const canonicalJsonStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }
  if (!P.isObject(value)) {
    return encodeJson(value);
  }
  const record = Option.getOrElse(decodeJsonRecord(value), () => R.empty<string, unknown>());
  const entries = Arr.sort(
    R.toEntries(record).filter(([, v]) => v !== undefined),
    Order.mapInput(Order.String, (entry: [string, unknown]) => entry[0]),
  ).map(([k, v]) => `${encodeJson(k)}:${canonicalJsonStringify(v)}`);
  return `{${entries.join(",")}}`;
};

/** Canonical manifest hash — the per-project deploy idempotency key. */
export const computeManifestHash = (manifest: PaywallDeployManifest): Effect.Effect<string> =>
  sha256Hex(canonicalJsonStringify(manifest));

// =============================================================================
// Storage / serving key derivation (§4.2 upload layout + §5 serving layout)
// =============================================================================

/** Upload-side blob location: `blobs/<projectId>/<sha256>`, content-addressed per project. */
export const blobStorageKey = (projectId: string, sha256: string): string =>
  `blobs/${projectId}/${sha256}`;

/** §5 serving key for a released paywall's HTML entry point. */
export const paywallServingHtmlKey = (contentHash: string): string => `p/${contentHash}/index.html`;

/** §5 serving key for a released paywall's JS bundle. */
export const paywallServingJsKey = (contentHash: string): string => `p/${contentHash}/bundle.js`;

/** Last POSIX path segment — asset serving names keep only the basename. */
export const assetBasename = (path: string): string => {
  const segments = path.split("/");
  const last = segments[segments.length - 1];
  if (last === undefined || last === "") {
    return path;
  }
  return last;
};

/** §5 serving key for one paywall asset: `p/<contentHash>/assets/<basename>`. */
export const paywallServingAssetKey = (contentHash: string, assetPath: string): string =>
  `p/${contentHash}/assets/${assetBasename(assetPath)}`;

/** One blob copy from the upload layout into the public §5 serving layout. */
export interface ServingCopy {
  readonly sha256: string;
  readonly targetKey: string;
  readonly contentType: string;
}

/**
 * Derives every §5 serving-layout copy for one manifest paywall: html →
 * `index.html`, js → `bundle.js`, each referenced asset →
 * `assets/<basename>`. `assetsByPath` indexes the manifest's top-level
 * `assets[]` by path; paths the paywall references but the manifest does not
 * declare are skipped here — `validateManifestConstraints` rejects them first.
 */
export const servingCopiesForPaywall = (
  paywall: ManifestPaywall,
  assetsByPath: HashMap.HashMap<string, DeployArtifact>,
): ReadonlyArray<ServingCopy> => [
  {
    contentType: paywall.artifacts.html.contentType,
    sha256: paywall.artifacts.html.sha256,
    targetKey: paywallServingHtmlKey(paywall.contentHash),
  },
  {
    contentType: paywall.artifacts.js.contentType,
    sha256: paywall.artifacts.js.sha256,
    targetKey: paywallServingJsKey(paywall.contentHash),
  },
  ...paywall.assets.flatMap((assetPath) =>
    Option.toArray(
      Option.map(HashMap.get(assetsByPath, assetPath), (asset) => ({
        contentType: asset.contentType,
        sha256: asset.sha256,
        targetKey: paywallServingAssetKey(paywall.contentHash, assetPath),
      })),
    ),
  ),
];

/** §5.1 serving prefix for one component's artifacts: `c/<contentHash>`. */
export const componentServingPrefix = (contentHash: string): string => `c/${contentHash}`;

/** §5.1 serving key for a component's §2 manifest. */
export const componentServingManifestKey = (contentHash: string): string =>
  `${componentServingPrefix(contentHash)}/manifest.json`;

/** §5.1 serving key for one §3 preview tree: `c/<contentHash>/previews/<state>.json`. */
export const componentServingPreviewKey = (contentHash: string, state: string): string =>
  `${componentServingPrefix(contentHash)}/previews/${state}.json`;

/** §5.1 serving key for a component's runtime bundle. */
export const componentServingRuntimeKey = (contentHash: string): string =>
  `${componentServingPrefix(contentHash)}/runtime.js`;

/** §5.1 serving key for a component's optional panel bundle. */
export const componentServingPanelKey = (contentHash: string): string =>
  `${componentServingPrefix(contentHash)}/panel.js`;

/**
 * Derives every §5.1 serving-layout copy for one manifest component: §2
 * manifest → `manifest.json`, each preview tree → `previews/<state>.json`,
 * runtime → `runtime.js`, and the panel → `panel.js` only when the manifest
 * declares one.
 */
export const servingCopiesForComponent = (
  component: ManifestComponent,
): ReadonlyArray<ServingCopy> => [
  {
    contentType: component.manifest.contentType,
    sha256: component.manifest.sha256,
    targetKey: componentServingManifestKey(component.contentHash),
  },
  ...component.previews.map((preview) => ({
    contentType: preview.file.contentType,
    sha256: preview.file.sha256,
    targetKey: componentServingPreviewKey(component.contentHash, preview.state),
  })),
  {
    contentType: component.artifacts.runtime.contentType,
    sha256: component.artifacts.runtime.sha256,
    targetKey: componentServingRuntimeKey(component.contentHash),
  },
  ...Option.toArray(
    Option.fromNullishOr(component.artifacts.panel).pipe(
      Option.map((panel) => ({
        contentType: panel.contentType,
        sha256: panel.sha256,
        targetKey: componentServingPanelKey(component.contentHash),
      })),
    ),
  ),
];

/**
 * Read-time catalog metadata for one component version, derived from its
 * MINTING deploy's §1 manifest (matched by the §1.2 contentHash): the preview
 * states actually copied into the §5.1 serving layout and whether a panel
 * bundle exists. Returns `Option.none` when the manifest declares no component with
 * this contentHash — callers treat that as ledger/manifest drift.
 */
export const componentServingMetadata = (
  manifest: PaywallDeployManifest,
  contentHash: string,
): Option.Option<{ readonly hasPanel: boolean; readonly previewStates: ReadonlyArray<string> }> =>
  Option.fromNullishOr(manifest.components.find((entry) => entry.contentHash === contentHash)).pipe(
    Option.map((component) => ({
      hasPanel: component.artifacts.panel !== null,
      previewStates: component.previews.map((preview) => preview.state),
    })),
  );

// =============================================================================
// Manifest traversal helpers
// =============================================================================

/** Indexes the manifest's top-level `assets[]` by path. */
export const manifestAssetsByPath = (
  manifest: PaywallDeployManifest,
): HashMap.HashMap<string, DeployArtifact> =>
  HashMap.fromIterable(manifest.assets.map((asset) => [asset.path, asset]));

/** One manifest-listed file flattened to its deploy-file row shape. */
export interface ManifestFileEntry {
  readonly role:
    | "paywallHtml"
    | "paywallJs"
    | "asset"
    | "source"
    | "config"
    | "componentManifest"
    | "componentPreview"
    | "componentRuntime"
    | "componentPanel";
  readonly logicalPath: string;
  readonly sha256: string;
  /** Declared size from the manifest, in bytes. */
  readonly bytes: number;
}

/** §1.1 size cap (bytes) applying to a manifest file of the given role. */
export const sizeCapForRole = (role: ManifestFileEntry["role"]): number => {
  if (role === "paywallHtml") {
    return SIZE_CAPS.html;
  }
  if (role === "paywallJs" || role === "componentRuntime" || role === "componentPanel") {
    return SIZE_CAPS.jsBundle;
  }
  if (role === "asset") {
    return SIZE_CAPS.asset;
  }
  if (role === "source") {
    return SIZE_CAPS.sourceFile;
  }
  if (role === "config") {
    return SIZE_CAPS.config;
  }
  if (role === "componentManifest") {
    return SIZE_CAPS.componentManifest;
  }
  return SIZE_CAPS.previewTree;
};

/**
 * Validates an uploaded blob's ACTUAL byte length against the manifest's
 * declarations (contract §1.1, enforced at upload before the blob is stored):
 * the body must match the declared `bytes` of every manifest entry carrying
 * this sha256 and must not exceed the role-appropriate size cap. Returns
 * human-readable violation messages — empty means the upload passes.
 */
export const validateUploadedBlobSize = (
  entries: ReadonlyArray<ManifestFileEntry>,
  actualBytes: number,
): ReadonlyArray<string> => {
  const violations: string[] = [];
  Arr.forEach(entries, (entry) => {
    if (actualBytes !== entry.bytes) {
      violations.push(
        `file "${entry.logicalPath}": uploaded body is ${actualBytes} bytes but the manifest declares ${entry.bytes} bytes`,
      );
    }
    const cap = sizeCapForRole(entry.role);
    if (actualBytes > cap) {
      violations.push(
        `file "${entry.logicalPath}" (${entry.role}): ${actualBytes} bytes exceeds the ${cap}-byte cap`,
      );
    }
  });
  return violations;
};

/**
 * Re-verifies §1.1 size caps at finalize against the bytes recorded on
 * `paywall_deploy_blobs` rows (defense in depth: rows written by older server
 * code may predate the upload-time cap enforcement). Hashes absent from
 * `bytesBySha256` are skipped — missing blobs are reported separately as an
 * incomplete deploy.
 */
export const validateRecordedBlobCaps = (
  manifest: PaywallDeployManifest,
  bytesBySha256: HashMap.HashMap<string, number>,
): ReadonlyArray<string> => {
  const violations: string[] = [];
  Arr.forEach(manifestFileEntries(manifest), (entry) => {
    const recorded = HashMap.get(bytesBySha256, entry.sha256);
    if (Option.isNone(recorded)) {
      return;
    }
    const cap = sizeCapForRole(entry.role);
    if (recorded.value > cap) {
      violations.push(
        `file "${entry.logicalPath}" (${entry.role}): recorded blob is ${recorded.value} bytes, exceeding the ${cap}-byte cap`,
      );
    }
  });
  return violations;
};

/** Flattens every file the §1 manifest references into role-tagged entries. */
export const manifestFileEntries = (
  manifest: PaywallDeployManifest,
): ReadonlyArray<ManifestFileEntry> => [
  ...manifest.paywalls.flatMap(
    (paywall): ReadonlyArray<ManifestFileEntry> => [
      {
        bytes: paywall.source.bytes,
        logicalPath: paywall.source.path,
        role: "source",
        sha256: paywall.source.sha256,
      },
      {
        bytes: paywall.artifacts.html.bytes,
        logicalPath: paywall.artifacts.html.path,
        role: "paywallHtml",
        sha256: paywall.artifacts.html.sha256,
      },
      {
        bytes: paywall.artifacts.js.bytes,
        logicalPath: paywall.artifacts.js.path,
        role: "paywallJs",
        sha256: paywall.artifacts.js.sha256,
      },
    ],
  ),
  ...manifest.components.flatMap(
    (component): ReadonlyArray<ManifestFileEntry> => [
      {
        bytes: component.source.bytes,
        logicalPath: component.source.path,
        role: "source",
        sha256: component.source.sha256,
      },
      {
        bytes: component.manifest.bytes,
        logicalPath: component.manifest.path,
        role: "componentManifest",
        sha256: component.manifest.sha256,
      },
      ...component.previews.map(
        (preview): ManifestFileEntry => ({
          bytes: preview.file.bytes,
          logicalPath: preview.file.path,
          role: "componentPreview",
          sha256: preview.file.sha256,
        }),
      ),
      {
        bytes: component.artifacts.runtime.bytes,
        logicalPath: component.artifacts.runtime.path,
        role: "componentRuntime",
        sha256: component.artifacts.runtime.sha256,
      },
      ...Option.toArray(
        Option.fromNullishOr(component.artifacts.panel).pipe(
          Option.map(
            (panel): ManifestFileEntry => ({
              bytes: panel.bytes,
              logicalPath: panel.path,
              role: "componentPanel",
              sha256: panel.sha256,
            }),
          ),
        ),
      ),
    ],
  ),
  {
    bytes: manifest.config.bytes,
    logicalPath: manifest.config.path,
    role: "config",
    sha256: manifest.config.sha256,
  },
  ...manifest.assets.map(
    (asset): ManifestFileEntry => ({
      bytes: asset.bytes,
      logicalPath: asset.path,
      role: "asset",
      sha256: asset.sha256,
    }),
  ),
];

/** Distinct sha256s of every file the manifest references. */
export const collectManifestHashes = (manifest: PaywallDeployManifest): ReadonlyArray<string> => [
  ...HashSet.fromIterable(manifestFileEntries(manifest).map((entry) => entry.sha256)),
];

/** Declared contentType of the manifest artifact carrying `sha256`, if any. */
export const findDeclaredContentType = (
  manifest: PaywallDeployManifest,
  sha256: string,
): Option.Option<string> =>
  Option.fromNullishOr(
    manifestFileArtifacts(manifest).find((artifact) => artifact.sha256 === sha256)?.contentType,
  );

const manifestFileArtifacts = (manifest: PaywallDeployManifest): ReadonlyArray<DeployArtifact> => [
  ...manifest.paywalls.flatMap((paywall) => [paywall.artifacts.html, paywall.artifacts.js]),
  ...manifest.components.flatMap((component) => [
    component.manifest,
    component.artifacts.runtime,
    ...Option.toArray(Option.fromNullishOr(component.artifacts.panel)),
    ...component.previews.map((preview) => preview.file),
  ]),
  ...manifest.assets,
];

// =============================================================================
// §1.1 constraint validation (size caps, contentType allowlist, uniqueness)
// =============================================================================

/** Bare media type — the segment before any `;charset=` parameter, lowercased. */
const bareContentType = (contentType: string): string =>
  (contentType.split(";")[0] ?? "").trim().toLowerCase();

const isAllowedContentType = (contentType: string): boolean =>
  HashSet.has(CONTENT_TYPE_ALLOWLIST, bareContentType(contentType));

/**
 * Validates the §1.1 constraints the Schema layer does not express: id
 * uniqueness, "at least one paywall or component", size caps, the
 * contentType grammar + allowlist, the per-role contentType rules (html →
 * `text/html`, js/runtime/panel → `text/javascript`, component manifest +
 * previews → `application/json`, assets → `image/*`/`font/*` only), that
 * every `paywalls[].assets` path resolves to a top-level `assets[]` entry,
 * that no two referenced assets share a §5 serving basename, and that every
 * component declares a non-empty `previews[]` whose state names match
 * {@link PREVIEW_STATE_PATTERN}. Returns human-readable violation messages —
 * empty means the manifest passes. Enforced at finalize (contract §1.1).
 */
export const validateManifestConstraints = (
  manifest: PaywallDeployManifest,
): ReadonlyArray<string> => {
  const violations: string[] = [];

  if (
    Arr.isReadonlyArrayEmpty(manifest.paywalls) &&
    Arr.isReadonlyArrayEmpty(manifest.components)
  ) {
    violations.push("manifest must declare at least one paywall or component");
  }

  let paywallIds = HashSet.empty<string>();
  Arr.forEach(manifest.paywalls, (paywall) => {
    if (HashSet.has(paywallIds, paywall.id)) {
      violations.push(`duplicate paywall id "${paywall.id}"`);
    }
    paywallIds = HashSet.add(paywallIds, paywall.id);
  });
  let componentIds = HashSet.empty<string>();
  Arr.forEach(manifest.components, (component) => {
    if (HashSet.has(componentIds, component.id)) {
      violations.push(`duplicate component id "${component.id}"`);
    }
    componentIds = HashSet.add(componentIds, component.id);
  });

  const checkContentType = (label: string, artifact: DeployArtifact): void => {
    // Re-checked here (not just at schema decode) so finalize rejects stored
    // manifests that predate the contentType grammar constraint.
    if (
      artifact.contentType.length > CONTENT_TYPE_MAX_LENGTH ||
      !CONTENT_TYPE_PATTERN.test(artifact.contentType)
    ) {
      violations.push(`${label}: contentType "${artifact.contentType}" is malformed`);
      return;
    }
    if (!isAllowedContentType(artifact.contentType)) {
      violations.push(`${label}: contentType "${artifact.contentType}" is not allowed`);
    }
  };
  // §1.1 per-role contentType rules: the serving layer echoes the declared
  // contentType verbatim, so each role is pinned to exactly the media type it
  // is served as.
  const checkExactContentType = (
    label: string,
    artifact: DeployArtifact,
    expected: "text/html" | "text/javascript" | "application/json",
  ): void => {
    checkContentType(label, artifact);
    if (bareContentType(artifact.contentType) !== expected) {
      violations.push(
        `${label}: contentType "${artifact.contentType}" is not allowed for this role; expected ${expected}`,
      );
    }
  };
  // §1.1 asset rule: image/* or font/* from the allowlist only — never an
  // executable/document type (text/html, text/javascript).
  const checkAssetContentType = (label: string, artifact: DeployArtifact): void => {
    checkContentType(label, artifact);
    const bare = bareContentType(artifact.contentType);
    if (!bare.startsWith("image/") && !bare.startsWith("font/")) {
      violations.push(
        `${label}: contentType "${artifact.contentType}" is not allowed for assets; expected an image/* or font/* type`,
      );
    }
  };
  const checkJsCap = (label: string, artifact: DeployArtifact): void => {
    if (artifact.bytes > SIZE_CAPS.jsBundle) {
      violations.push(
        `${label}: js bundle exceeds ${SIZE_CAPS.jsBundle} bytes (${artifact.bytes})`,
      );
    }
  };

  const assetsByPath = manifestAssetsByPath(manifest);

  Arr.forEach(manifest.paywalls, (paywall) => {
    const label = `paywall "${paywall.id}"`;
    checkExactContentType(`${label} html`, paywall.artifacts.html, "text/html");
    checkExactContentType(`${label} js`, paywall.artifacts.js, "text/javascript");
    checkJsCap(`${label} js`, paywall.artifacts.js);
    // §5 serving keys keep only the asset basename, so two referenced assets
    // sharing a basename would land on the same `p/<hash>/assets/<basename>`
    // object — reject the manifest instead of silently flattening them.
    let servingNames = HashMap.empty<string, string>();
    let seenPaths = HashSet.empty<string>();
    Arr.forEach(paywall.assets, (assetPath) => {
      const asset = HashMap.get(assetsByPath, assetPath);
      if (Option.isNone(asset)) {
        violations.push(`${label}: asset path "${assetPath}" is not in the top-level assets list`);
        return;
      }
      if (HashSet.has(seenPaths, assetPath)) {
        return;
      }
      seenPaths = HashSet.add(seenPaths, assetPath);
      const basename = assetBasename(assetPath);
      const first = HashMap.get(servingNames, basename);
      if (Option.isNone(first)) {
        servingNames = HashMap.set(servingNames, basename, assetPath);
      } else {
        violations.push(
          `${label}: assets "${first.value}" and "${assetPath}" collide on serving name "assets/${basename}"`,
        );
      }
    });
  });

  Arr.forEach(manifest.components, (component) => {
    const label = `component "${component.id}"`;
    checkExactContentType(`${label} manifest`, component.manifest, "application/json");
    if (component.manifest.bytes > SIZE_CAPS.componentManifest) {
      violations.push(
        `${label}: component manifest exceeds ${SIZE_CAPS.componentManifest} bytes (${component.manifest.bytes})`,
      );
    }
    checkExactContentType(`${label} runtime`, component.artifacts.runtime, "text/javascript");
    checkJsCap(`${label} runtime`, component.artifacts.runtime);
    if (component.artifacts.panel) {
      checkExactContentType(`${label} panel`, component.artifacts.panel, "text/javascript");
      checkJsCap(`${label} panel`, component.artifacts.panel);
    }
    if (Arr.isReadonlyArrayEmpty(component.previews)) {
      violations.push(`${label}: previews must not be empty`);
    }
    let previewStates = HashSet.empty<string>();
    Arr.forEach(component.previews, (preview) => {
      const previewLabel = `${label} preview "${preview.state}"`;
      if (HashSet.has(previewStates, preview.state)) {
        violations.push(`${label}: duplicate preview state "${preview.state}"`);
      }
      previewStates = HashSet.add(previewStates, preview.state);
      if (!PREVIEW_STATE_PATTERN.test(preview.state)) {
        violations.push(
          `${previewLabel}: state "${preview.state}" is malformed; expected ${PREVIEW_STATE_PATTERN}`,
        );
      }
      checkExactContentType(previewLabel, preview.file, "application/json");
      if (preview.file.bytes > SIZE_CAPS.previewTree) {
        violations.push(
          `${previewLabel}: preview tree exceeds ${SIZE_CAPS.previewTree} bytes (${preview.file.bytes})`,
        );
      }
    });
  });

  Arr.forEach(manifest.assets, (asset) => {
    const label = `asset "${asset.path}"`;
    checkAssetContentType(label, asset);
    if (asset.bytes > SIZE_CAPS.asset) {
      violations.push(`${label}: exceeds ${SIZE_CAPS.asset} bytes (${asset.bytes})`);
    }
  });

  return violations;
};
