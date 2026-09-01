import { constant } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { unexpectedError } from "../../effect-boundary.ts";

import { type AnyAuthSession, ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  type DbError,
  type DbTransaction,
  PaywallDeployFileRole,
  PaywallDeployStatus,
  PaywallLocationShowingType,
  PaywallSource,
  ReleaseStatus,
  and,
  eq,
  inArray,
  paywallComponentVersions,
  paywallComponents,
  paywallDeployBlobs,
  paywallDeployFiles,
  paywallDeploys,
  paywallLocationShowings,
  paywallReleases,
  paywalls,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { PaywallAssetConfig } from "../paywallLocations/PaywallAssetConfig.ts";
import {
  type PaywallArtifactObject,
  PaywallArtifactStore,
  PaywallArtifactStoreError,
} from "./PaywallArtifactStore.ts";
import {
  type ComponentManifest,
  ComponentManifestDefinition,
  DEPLOY_MANIFEST_SCHEMA_VERSION,
  type ManifestComponent,
  type ManifestPaywall,
  type PaywallDeployManifest,
  PaywallDeployManifestDefinition,
  PreviewTreeDefinition,
  SIZE_CAPS,
  type ServingCopy,
  blobStorageKey,
  canonicalJsonStringify,
  collectManifestHashes,
  componentServingMetadata,
  componentServingPrefix,
  computeComponentContentHash,
  computePaywallContentHash,
  countSlotNodes,
  findDeclaredContentType,
  manifestAssetsByPath,
  manifestFileEntries,
  paywallServingHtmlKey,
  servingCopiesForComponent,
  servingCopiesForPaywall,
  sha256Hex,
  strictParseOptions,
  validateManifestConstraints,
  validateRecordedBlobCaps,
  validateUploadedBlobSize,
} from "./PaywallDeployManifest.ts";

/**
 * Catch-all service error. Wraps `DbError` (and `SqlError` from transactions)
 * and `PaywallArtifactStoreError` (and other infrastructural failures) at the
 * public-method boundary so callers see one stable error tag.
 */
export class PaywallDeployServiceError extends Schema.TaggedErrorClass<PaywallDeployServiceError>(
  "PaywallDeployServiceError",
)("PaywallDeployServiceError", { cause: Schema.String }) {}

/**
 * The manifest declares a `schemaVersion` this server build does not
 * understand (contract §4.1/§8). The API layer maps this to a `400` with an
 * "upgrade the CLI" hint — `message` already carries it.
 */
export class UnsupportedDeploySchemaVersionError extends Schema.TaggedErrorClass<UnsupportedDeploySchemaVersionError>(
  "UnsupportedDeploySchemaVersionError",
)("UnsupportedDeploySchemaVersionError", {
  schemaVersion: Schema.NullOr(Schema.Number),
  message: Schema.String,
}) {}

/**
 * The manifest (or a stored §2/§3 artifact) failed schema validation or a
 * §1.1 constraint. Maps to `422`; `violations` carries the per-item details.
 */
export class PaywallDeployValidationError extends Schema.TaggedErrorClass<PaywallDeployValidationError>(
  "PaywallDeployValidationError",
)("PaywallDeployValidationError", {
  message: Schema.String,
  violations: Schema.Array(Schema.String),
}) {}

/** Deploy row not found (or not visible to the caller's project). */
export class PaywallDeployNotFoundError extends Schema.TaggedErrorClass<PaywallDeployNotFoundError>(
  "PaywallDeployNotFoundError",
)("PaywallDeployNotFoundError", { message: Schema.String }) {}

/** Blob upload attempted against a deploy that is no longer pending. */
export class PaywallDeployNotPendingError extends Schema.TaggedErrorClass<PaywallDeployNotPendingError>(
  "PaywallDeployNotPendingError",
)("PaywallDeployNotPendingError", { message: Schema.String }) {}

/**
 * Uploaded sha256 is not declared by the deploy's manifest (contract §4.2 —
 * the API layer maps this to `404`).
 */
export class DeployBlobNotDeclaredError extends Schema.TaggedErrorClass<DeployBlobNotDeclaredError>(
  "DeployBlobNotDeclaredError",
)("DeployBlobNotDeclaredError", { sha256: Schema.String }) {}

/** Uploaded body does not hash to the declared sha256 (contract §4.2 → `422`). */
export class DeployBlobHashMismatchError extends Schema.TaggedErrorClass<DeployBlobHashMismatchError>(
  "DeployBlobHashMismatchError",
)("DeployBlobHashMismatchError", {
  expectedSha256: Schema.String,
  actualSha256: Schema.String,
}) {}

/**
 * Finalize attempted while referenced blobs are still missing (contract §4.3
 * → `409 { missing }`); the deploy stays pending and can be retried.
 */
export class IncompleteDeployError extends Schema.TaggedErrorClass<IncompleteDeployError>(
  "IncompleteDeployError",
)("IncompleteDeployError", { missing: Schema.Array(Schema.String) }) {}

/** Release row not found (setActivePaywallRelease). */
export class PaywallReleaseNotFoundError extends Schema.TaggedErrorClass<PaywallReleaseNotFoundError>(
  "PaywallReleaseNotFoundError",
)("PaywallReleaseNotFoundError", { message: Schema.String }) {}

/**
 * Resolves the project the manifest targets from the caller's session:
 * the project whose `slug` equals `manifest.project` inside an organization
 * whose `slug` equals `manifest.team` (contract §4). Returns `None` when the
 * session grants no such project — callers fail with a 403-style error.
 */
export const resolveSessionProject = (
  session: AnyAuthSession,
  team: string,
  project: string,
): Option.Option<{ readonly id: string; readonly organizationId: string }> =>
  Arr.findFirst(
    session.projects,
    (p) =>
      p.slug === project &&
      session.organizations.some((o) => o.id === p.organizationId && o.slug === team),
  ).pipe(Option.map((match) => ({ id: match.id, organizationId: match.organizationId })));

const deployStatusLabel = (status: number): "pending" | "ready" => {
  if (status === PaywallDeployStatus.ready) return "ready";
  return "pending";
};

/**
 * True when `error` (or anything on its `cause` chain — drizzle wraps the
 * driver error) is MySQL's ER_DUP_ENTRY (errno 1062), the unique-index
 * violation raised when two concurrent identical create-deploy POSTs race
 * past the idempotency read.
 */
/** Lexicographic slug comparator for stable component listing order. */
const compareSlugs = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/** Next link on an error's `cause` chain, or `undefined` when there is none. */
const causeOf = (value: unknown): unknown => {
  if (P.hasProperty(value, "cause")) return value.cause;
  return undefined;
};

const isDuplicateKeyError = (error: unknown): boolean => {
  const check = (current: unknown, depth: number): boolean => {
    if (depth >= 5 || current === undefined || current === null) {
      return false;
    }
    if (P.hasProperty(current, "errno") && current.errno === 1062) {
      return true;
    }
    if (P.hasProperty(current, "code") && current.code === "ER_DUP_ENTRY") {
      return true;
    }
    return check(causeOf(current), depth + 1);
  };
  return check(error, 0);
};

export interface CreateDeployResult {
  readonly deployId: string;
  /** Manifest file hashes the server does not have stored for this project. */
  readonly missing: ReadonlyArray<string>;
}

/**
 * Builds the finalize-time blob reader. By the time it runs, the per-project
 * blob ledger claimed every hash exists — a `null` from the store therefore
 * means ledger/store drift (e.g. the object was deleted out-of-band). The
 * fetcher deletes the stale ledger rows for exactly those hashes via
 * `deleteStaleBlobRows` before failing with {@link IncompleteDeployError}, so
 * the next createDeploy re-reports them as missing and the documented
 * "re-run deploy" retry converges. Store *errors* are not converted: they
 * keep failing through the `getObject` error channel.
 */
export const makeBlobFetcher =
  <EGet, EDelete, RGet = never, RDelete = never>(deps: {
    readonly getObject: (
      projectId: string,
      sha256: string,
    ) => Effect.Effect<Option.Option<PaywallArtifactObject>, EGet, RGet>;
    readonly deleteStaleBlobRows: (
      projectId: string,
      sha256s: ReadonlyArray<string>,
    ) => Effect.Effect<void, EDelete, RDelete>;
  }) =>
  (
    projectId: string,
    sha256: string,
  ): Effect.Effect<PaywallArtifactObject, IncompleteDeployError | EGet | EDelete, RGet | RDelete> =>
    Effect.gen(function* () {
      const object = yield* deps.getObject(projectId, sha256);
      if (Option.isNone(object)) {
        yield* deps.deleteStaleBlobRows(projectId, [sha256]);
        return yield* Effect.fail(new IncompleteDeployError({ missing: [sha256] }));
      }
      return object.value;
    });

const decodeJsonText = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);

const parseJsonBlob = (body: Uint8Array, label: string) =>
  decodeJsonText(new TextDecoder().decode(body)).pipe(
    Effect.mapError(
      () =>
        new PaywallDeployValidationError({
          message: `${label} is not valid JSON`,
          violations: [`${label} is not valid JSON`],
        }),
    ),
  );

/**
 * Builds the recomputed-hash + stored-artifact validation run ahead of the
 * finalize commit (contract §4.3 "trusts nothing"): §1.1 constraints, every
 * declared `contentHash` recomputed from the manifest-listed file hashes, and
 * the stored §2 component manifests / §3 preview trees fetched and
 * schema-validated (the blobs were hash-verified at upload, so only their
 * *content* needs validating). Each decoded preview tree must self-identify
 * as the manifest state it is filed under — without this, the same file set
 * with swapped state assignments would collide under one immutable
 * contentHash. Returns the decoded §2 manifests keyed by component id.
 */
export const makeManifestIntegrityVerifier =
  <EFetch, RFetch = never>(deps: {
    readonly fetchBlob: (
      projectId: string,
      sha256: string,
    ) => Effect.Effect<PaywallArtifactObject, EFetch, RFetch>;
  }) =>
  (
    projectId: string,
    manifest: PaywallDeployManifest,
  ): Effect.Effect<
    HashMap.HashMap<string, ComponentManifest>,
    PaywallDeployValidationError | EFetch,
    RFetch
  > =>
    Effect.gen(function* () {
      const assetsByPath = manifestAssetsByPath(manifest);
      const paywallViolations = yield* Effect.forEach(
        manifest.paywalls,
        (paywall) =>
          Effect.gen(function* () {
            const assetSha256s = Arr.flatMap(paywall.assets, (assetPath) => {
              const asset = HashMap.get(assetsByPath, assetPath);
              return Option.isSome(asset) ? [asset.value.sha256] : [];
            });
            const recomputed = yield* computePaywallContentHash({
              assetSha256s,
              htmlSha256: paywall.artifacts.html.sha256,
              jsSha256: paywall.artifacts.js.sha256,
            });
            return recomputed === paywall.contentHash
              ? []
              : [
                  `paywall "${paywall.id}": contentHash mismatch (declared ${paywall.contentHash}, recomputed ${recomputed})`,
                ];
          }),
        { concurrency: 1 },
      );
      const componentViolations = yield* Effect.forEach(
        manifest.components,
        (component) =>
          Effect.gen(function* () {
            const recomputed = yield* computeComponentContentHash({
              manifestSha256: component.manifest.sha256,
              panelSha256: Option.fromNullishOr(component.artifacts.panel?.sha256),
              previewSha256s: component.previews.map((preview) => preview.file.sha256),
              runtimeSha256: component.artifacts.runtime.sha256,
            });
            return recomputed === component.contentHash
              ? []
              : [
                  `component "${component.id}": contentHash mismatch (declared ${component.contentHash}, recomputed ${recomputed})`,
                ];
          }),
        { concurrency: 1 },
      );
      const violations = [
        ...validateManifestConstraints(manifest),
        ...Arr.flatten(paywallViolations),
        ...Arr.flatten(componentViolations),
      ];

      if (Arr.isReadonlyArrayNonEmpty(violations)) {
        return yield* Effect.fail(
          new PaywallDeployValidationError({
            message: `Deploy failed validation: ${violations.join("; ")}`,
            violations,
          }),
        );
      }

      const componentManifests = yield* Effect.forEach(
        manifest.components,
        (component) =>
          Effect.gen(function* () {
            const label = `component "${component.id}" manifest`;
            const manifestObject = yield* deps.fetchBlob(projectId, component.manifest.sha256);
            const manifestJson = yield* parseJsonBlob(manifestObject.body, label);
            const componentManifest = yield* Schema.decodeUnknownEffect(
              ComponentManifestDefinition,
              strictParseOptions,
            )(manifestJson).pipe(
              Effect.mapError(
                (error) =>
                  new PaywallDeployValidationError({
                    message: `${label} failed validation: ${error.message}`,
                    violations: [`${label}: ${error.message}`],
                  }),
              ),
            );
            yield* Effect.forEach(
              component.previews,
              (preview) =>
                Effect.gen(function* () {
                  const previewLabel = `component "${component.id}" preview "${preview.state}"`;
                  const previewObject = yield* deps.fetchBlob(projectId, preview.file.sha256);
                  const previewJson = yield* parseJsonBlob(previewObject.body, previewLabel);
                  const previewTree = yield* Schema.decodeUnknownEffect(
                    PreviewTreeDefinition,
                    strictParseOptions,
                  )(previewJson).pipe(
                    Effect.mapError(
                      (error) =>
                        new PaywallDeployValidationError({
                          message: `${previewLabel} failed validation: ${error.message}`,
                          violations: [`${previewLabel}: ${error.message}`],
                        }),
                    ),
                  );
                  if (previewTree.state !== preview.state) {
                    return yield* Effect.fail(
                      new PaywallDeployValidationError({
                        message: `${previewLabel}: preview tree state "${previewTree.state}" does not match the manifest state "${preview.state}"`,
                        violations: [
                          `${previewLabel}: preview tree state "${previewTree.state}" does not match the manifest state "${preview.state}"`,
                        ],
                      }),
                    );
                  }
                  const slotCount = countSlotNodes(previewTree.root);
                  if (slotCount > 1) {
                    return yield* Effect.fail(
                      new PaywallDeployValidationError({
                        message: `${previewLabel}: preview tree contains ${slotCount} slot nodes; at most one is allowed`,
                        violations: [
                          `${previewLabel}: preview tree contains ${slotCount} slot nodes; at most one is allowed`,
                        ],
                      }),
                    );
                  }
                }),
              { concurrency: 1, discard: true },
            );
            return [component.id, componentManifest] as const;
          }),
        { concurrency: 1 },
      );

      return HashMap.fromIterable(componentManifests);
    });

/**
 * Builds the finalize-time serving-layout copier: each {@link ServingCopy} is
 * fetched from the per-project upload layout and written to its public §5/§5.1
 * target key. Content-addressed targets make the copies idempotent and
 * retry-safe, so they run before the DB transaction and again on the
 * re-finalize-of-ready no-op path.
 */
export const makeServingLayoutCopier =
  <EFetch, EPut, RFetch = never, RPut = never>(deps: {
    readonly fetchBlob: (
      projectId: string,
      sha256: string,
    ) => Effect.Effect<PaywallArtifactObject, EFetch, RFetch>;
    readonly putObject: (input: {
      readonly key: string;
      readonly body: Uint8Array;
      readonly contentType: string;
    }) => Effect.Effect<void, EPut, RPut>;
  }) =>
  (
    projectId: string,
    copies: ReadonlyArray<ServingCopy>,
  ): Effect.Effect<void, EFetch | EPut, RFetch | RPut> =>
    Effect.forEach(
      copies,
      (copy) =>
        Effect.gen(function* () {
          const blob = yield* deps.fetchBlob(projectId, copy.sha256);
          yield* deps.putObject({
            body: blob.body,
            contentType: copy.contentType,
            key: copy.targetKey,
          });
        }),
      { concurrency: 1, discard: true },
    );

export interface FinalizedPaywallSummary {
  /** Manifest paywall id (slug). */
  readonly id: string;
  readonly paywallId: string;
  readonly releaseId: string;
  readonly version: number;
  readonly contentHash: string;
  readonly url: string;
}

export interface FinalizedComponentSummary {
  /** Manifest component id (slug). */
  readonly id: string;
  readonly componentId: string;
  readonly version: number;
  readonly contentHash: string;
}

/** Contract §4.3 finalize response shape. */
export interface FinalizeDeployResult {
  readonly deployId: string;
  readonly status: "ready";
  readonly paywalls: ReadonlyArray<FinalizedPaywallSummary>;
  readonly components: ReadonlyArray<FinalizedComponentSummary>;
}

export interface PaywallDeployListItem {
  readonly id: string;
  readonly status: "pending" | "ready";
  readonly schemaVersion: number;
  readonly cliVersion: string;
  readonly runtimeVersion: string;
  readonly createdByName: string;
  readonly createdAt: Date;
  readonly paywalls: ReadonlyArray<{
    readonly slug: string;
    readonly contentHash: string;
    readonly releaseId: Option.Option<string>;
    readonly version: Option.Option<number>;
  }>;
  readonly components: ReadonlyArray<{
    readonly slug: string;
    readonly contentHash: string;
    readonly componentId: Option.Option<string>;
    readonly version: Option.Option<number>;
  }>;
}

/**
 * One component version with the read-time catalog detail the editor needs.
 * `hasPanel` and `previewStates` derive from the MINTING deploy's manifest
 * (versionRow.deployId → `paywall_deploys.manifest` → `components[]` entry
 * matched by contentHash) — the §2 `manifest` column stays raw and its
 * optional `previewStates` field is never consulted, since only the deploy
 * manifest's `previews[]` reflects what was actually copied to serving.
 */
export interface PaywallComponentVersionDetail {
  /** Component slug (manifest `components[].id`). */
  readonly slug: string;
  readonly version: number;
  readonly contentHash: string;
  /** Raw §2 component manifest JSON, exactly as stored at finalize. */
  readonly manifest: unknown;
  readonly hasPanel: boolean;
  readonly previewStates: ReadonlyArray<string>;
  /** `{publicBaseUrl}/c/<contentHash>` — base of the §5.1 serving layout. */
  readonly artifactBaseUrl: string;
  readonly createdAt: Date;
}

export interface PaywallComponentVersionSummary {
  readonly version: number;
  readonly contentHash: string;
  readonly createdAt: Date;
}

export interface PaywallComponentListItem {
  readonly componentId: string;
  readonly slug: string;
  readonly title: Option.Option<string>;
  readonly latestVersion: number;
  /** Full detail for the latest version (library/insertion). */
  readonly latest: PaywallComponentVersionDetail;
  /** Older versions, newest first — summaries only. */
  readonly previousVersions: ReadonlyArray<PaywallComponentVersionSummary>;
}

/**
 * Decodes stored (validated-at-create) deploy-manifest rows for the catalog
 * read path, keyed by deploy id. Catalog reads degrade per row: a manifest
 * that no longer decodes (e.g. written by a newer schema) is skipped with a
 * warning instead of failing the whole read, so one drifted row cannot take
 * down the component catalog.
 */
export const decodeStoredDeployManifestRows = (
  rows: ReadonlyArray<{ readonly id: string; readonly manifest: unknown }>,
): Effect.Effect<HashMap.HashMap<string, PaywallDeployManifest>> =>
  Effect.gen(function* () {
    const decoded = yield* Effect.forEach(
      rows,
      (row) =>
        Effect.gen(function* () {
          const result = yield* Effect.result(
            Schema.decodeUnknownEffect(
              PaywallDeployManifestDefinition,
              strictParseOptions,
            )(row.manifest),
          );
          if (Result.isFailure(result)) {
            yield* Effect.logWarning(
              "stored paywall deploy manifest no longer decodes; omitting its component versions from the catalog",
              { deployId: row.id, error: String(result.failure) },
            );
            return Option.none<readonly [string, PaywallDeployManifest]>();
          }
          return Option.some([row.id, result.success] as const);
        }),
      { concurrency: 1 },
    );
    const emptyEntries: ReadonlyArray<readonly [string, PaywallDeployManifest]> = [];
    const entries = Arr.reduce(decoded, emptyEntries, (result, entry) =>
      Option.match(entry, {
        onNone: () => result,
        onSome: (value) => [...result, value],
      }),
    );
    return HashMap.fromIterable(entries);
  });

/**
 * Builds the catalog detail resolver for one component version row. The row's
 * `deployId` always points at the MINTING deploy (the contentHash-reuse
 * branch never inserts), so `hasPanel`/`previewStates` derive from that
 * deploy's manifest entry matched by contentHash. A version whose metadata no
 * longer resolves — manifest row missing/undecodable, or no `components[]`
 * entry carrying the contentHash — degrades to `None` with a warning, and
 * callers omit it instead of failing the whole catalog read.
 */
export const makeComponentVersionDetailBuilder =
  (deps: { readonly publicBaseUrl: string }) =>
  (input: {
    readonly slug: string;
    readonly row: {
      readonly version: number;
      readonly contentHash: string;
      readonly deployId: string;
      readonly manifest: unknown;
      readonly createdAt: Date;
    };
    readonly deployManifests: HashMap.HashMap<string, PaywallDeployManifest>;
  }): Effect.Effect<Option.Option<PaywallComponentVersionDetail>> =>
    Effect.gen(function* () {
      const metadata = HashMap.get(input.deployManifests, input.row.deployId).pipe(
        Option.flatMap((deployManifest) =>
          componentServingMetadata(deployManifest, input.row.contentHash),
        ),
      );
      if (Option.isNone(metadata)) {
        yield* Effect.logWarning(
          "paywall component version no longer resolves against its minting deploy manifest; omitting from the catalog",
          {
            contentHash: input.row.contentHash,
            deployId: input.row.deployId,
            slug: input.slug,
            version: input.row.version,
          },
        );
        return Option.none();
      }
      return Option.some({
        artifactBaseUrl: `${deps.publicBaseUrl}/${componentServingPrefix(input.row.contentHash)}`,
        contentHash: input.row.contentHash,
        createdAt: input.row.createdAt,
        hasPanel: metadata.value.hasPanel,
        manifest: input.row.manifest,
        previewStates: metadata.value.previewStates,
        slug: input.slug,
        version: input.row.version,
      } satisfies PaywallComponentVersionDetail);
    });

/**
 * `PaywallDeployService` orchestrates paywall code deploys (contract §4):
 *
 * - `createDeploy` — validate + register a §1 manifest, return missing blobs
 * - `uploadBlob` — hash-verified, content-addressed blob ingestion
 * - `finalizeDeploy` — the immutable commit point: re-validate everything,
 *   publish releases/components, copy blobs into the §5/§5.1 serving layouts
 * - `listDeploys` — dashboard read-side
 * - `listComponents` / `getComponentVersions` — editor component catalog;
 *   reads degrade per row, omitting (with a warning) versions whose stored
 *   deploy manifest no longer decodes or no longer carries their contentHash
 * - `setActivePaywallRelease` — rollback/rollforward within one paywall
 *
 * `AuditLogPort`, `PaywallArtifactStore`, `PaywallAssetConfig`, `Db`, and
 * `AuthSession` are provided by the application root.
 */
export class PaywallDeployService extends Context.Service<PaywallDeployService>()(
  "PaywallDeployService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const store = yield* PaywallArtifactStore;
      const assetConfig = yield* PaywallAssetConfig;
      const db = yield* Db;

      // Code releases are served from the content-addressed public layout
      // (contract §5): `{publicBaseUrl}/p/<contentHash>/index.html`. The CDN
      // base (`cdnUrl`) stays reserved for visual-editor releases.
      const releaseUrl = (contentHash: string): string =>
        `${assetConfig.publicBaseUrl}/${paywallServingHtmlKey(contentHash)}`;

      /** Decodes a stored (already-validated-at-create) manifest row; failure is an invariant break. */
      const decodeStoredManifest = (manifest: unknown) =>
        Schema.decodeUnknownEffect(
          PaywallDeployManifestDefinition,
          strictParseOptions,
        )(manifest).pipe(
          Effect.mapError(
            (error) =>
              new PaywallDeployServiceError({
                cause: `stored deploy manifest no longer decodes: ${error.message}`,
              }),
          ),
        );

      /** Manifest hashes minus the blob rows this project already has. */
      const computeMissing = Effect.fn("PaywallDeployService.computeMissing")(function* (
        projectId: string,
        hashes: ReadonlyArray<string>,
      ) {
        const unique = [...HashSet.fromIterable(hashes)];
        if (Arr.isReadonlyArrayEmpty(unique)) {
          return [];
        }
        const rows = yield* db.query.paywallDeployBlobs.findMany({
          where: { projectId, sha256: { in: unique } },
        });
        const present = HashSet.fromIterable(rows.map((row) => row.sha256));
        return unique.filter((hash) => !HashSet.has(present, hash));
      });

      const deleteStaleBlobRows = Effect.fn("PaywallDeployService.deleteStaleBlobRows")(function* (
        projectId: string,
        sha256s: ReadonlyArray<string>,
      ) {
        yield* db
          .delete(paywallDeployBlobs)
          .where(
            and(
              eq(paywallDeployBlobs.projectId, projectId),
              inArray(paywallDeployBlobs.sha256, [...sha256s]),
            ),
          );
      });

      /** Reads an uploaded blob; absence at this point means ledger/store drift (see {@link makeBlobFetcher}). */
      const fetchBlob = makeBlobFetcher({
        deleteStaleBlobRows,
        getObject: (projectId, sha256) =>
          store.getObject(blobStorageKey(projectId, sha256)),
      });

      /**
       * Propagates a newly-activated CODE-source release to open showings
       * (contract §4.3): every open `paywallRelease` showing of this paywall
       * that still pins a different release is ended and replaced by a new
       * open showing pinning `newReleaseId` (same location/type/paywall).
       * Runs inside the caller's transaction so activation and propagation
       * commit atomically.
       */
      const propagateActiveReleaseToOpenShowings = Effect.fn(
        "PaywallDeployService.propagateActiveReleaseToOpenShowings",
      )(function* (
        tx: DbTransaction,
        input: {
          readonly paywallId: string;
          readonly newReleaseId: string;
          readonly now: Date;
          readonly createdByUserId: Option.Option<string>;
        },
      ) {
        const db = tx;
        const openShowings = yield* db.query.paywallLocationShowings.findMany({
          where: {
            paywallId: input.paywallId,
            type: PaywallLocationShowingType.paywallRelease,
            endedAt: { isNull: true },
          },
        });
        const stale = openShowings.filter(
          (showing) => showing.paywallReleaseId !== input.newReleaseId,
        );
        if (Arr.isReadonlyArrayEmpty(stale)) {
          return;
        }
        yield* db
          .update(paywallLocationShowings)
          .set({ endedAt: input.now })
          .where(
            inArray(
              paywallLocationShowings.id,
              stale.map((showing) => showing.id),
            ),
          );
        yield* db.insert(paywallLocationShowings).values(
          stale.map((showing) => ({
            createdByUserId: Option.getOrNull(input.createdByUserId),
            featureFlagId: null,
            id: generateId("paywallLocationShowing"),
            paywallId: showing.paywallId,
            paywallLocationId: showing.paywallLocationId,
            paywallReleaseId: input.newReleaseId,
            projectId: showing.projectId,
            startedAt: input.now,
            type: showing.type,
          })),
        );
      });

      const annotateSession = Effect.fn("PaywallDeployService.annotateSession")(function* (
        session: AnyAuthSession,
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session.user?.id) {
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        }
        if (session.organizations[0]?.id) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        }
      });

      const createDeploy = Effect.fn("createDeploy")(
        function* (input: { readonly manifest: unknown }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);

          // Peek the version before full validation so an old/new CLI gets a
          // dedicated "upgrade" error instead of a generic schema failure.
          const peeked = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ schemaVersion: Schema.Number }),
          )(input.manifest).pipe(Effect.option);
          const peekedVersion = Option.getOrNull(
            Option.map(peeked, (value) => value.schemaVersion),
          );
          if (peekedVersion !== DEPLOY_MANIFEST_SCHEMA_VERSION) {
            return yield* Effect.fail(
              new UnsupportedDeploySchemaVersionError({
                message: `Unsupported deploy manifest schemaVersion ${String(peekedVersion)}; this server expects ${DEPLOY_MANIFEST_SCHEMA_VERSION}. Upgrade voidhash-cli and re-run the deploy.`,
                schemaVersion: peekedVersion,
              }),
            );
          }

          const manifest = yield* Schema.decodeUnknownEffect(
            PaywallDeployManifestDefinition,
            strictParseOptions,
          )(input.manifest).pipe(
            Effect.mapError(
              (error) =>
                new PaywallDeployValidationError({
                  message: `Deploy manifest failed validation: ${error.message}`,
                  violations: [error.message],
                }),
            ),
          );

          const projectOption = resolveSessionProject(session, manifest.team, manifest.project);
          if (Option.isNone(projectOption)) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: `Session has no access to project "${manifest.project}" in team "${manifest.team}"`,
              }),
            );
          }
          const project = projectOption.value;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);
          yield* checkProjectPermission(
            project.id,
            "project:all",
            `User ${session?.user?.id} is not authorized to create paywall deploys for project ${project.id}`,
          );

          // §1.1 manifest body cap, enforced before the row is stored.
          const canonical = canonicalJsonStringify(manifest);
          const manifestBytes = new TextEncoder().encode(canonical).byteLength;
          if (manifestBytes > SIZE_CAPS.deployManifest) {
            return yield* Effect.fail(
              new PaywallDeployValidationError({
                message: `Deploy manifest exceeds ${SIZE_CAPS.deployManifest} bytes (${manifestBytes})`,
                violations: [
                  `manifest body exceeds ${SIZE_CAPS.deployManifest} bytes (${manifestBytes})`,
                ],
              }),
            );
          }

          const manifestHash = yield* sha256Hex(canonical);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.manifest_hash", manifestHash);

          const allHashes = collectManifestHashes(manifest);

          // Idempotent re-POST (contract §4.1): the unique
          // (projectId, manifestHash) row is returned regardless of status —
          // a pending deploy resumes uploading, a ready one re-finalizes as a
          // no-op.
          const existing = yield* db.query.paywallDeploys.findFirst({
            where: { projectId: project.id, manifestHash },
          });
          if (existing) {
            yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.id", existing.id);
            const missing = yield* computeMissing(project.id, allHashes);
            return { deployId: existing.id, missing } satisfies CreateDeployResult;
          }

          const deployId = generateId("paywallDeploy");
          yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.id", deployId);
          const fileEntries = manifestFileEntries(manifest);

          // The only duplicate-key source in this transaction is the unique
          // (projectId, manifestHash) index — paywallDeployFiles only has a
          // generated-id PK — so an ER_DUP_ENTRY means a concurrent identical
          // POST won the race and its row is the idempotent deploy (§4.1).
          const inserted = yield* db
            .transaction(
              Effect.fn("PaywallDeployService.createDeployTransaction")(function* (tx) {
                yield* tx.insert(paywallDeploys).values({
                  cliVersion: manifest.cliVersion,
                  createdByName: session.name,
                  id: deployId,
                  manifest,
                  manifestHash,
                  projectId: project.id,
                  runtimeVersion: manifest.runtimeVersion,
                  schemaVersion: manifest.schemaVersion,
                  status: PaywallDeployStatus.pending,
                });
                if (Arr.isReadonlyArrayNonEmpty(fileEntries)) {
                  yield* tx.insert(paywallDeployFiles).values(
                    fileEntries.map((entry) => ({
                      deployId,
                      id: generateId("paywallDeployFile"),
                      logicalPath: entry.logicalPath,
                      role: PaywallDeployFileRole[entry.role],
                      sha256: entry.sha256,
                    })),
                  );
                }
              }),
            )
            .pipe(
              Effect.as(true),
              Effect.catchIf(
                (error) => isDuplicateKeyError(error),
                () => Effect.succeed(false),
              ),
            );
          if (!inserted) {
            const winner = yield* db.query.paywallDeploys.findFirst({
              where: { projectId: project.id, manifestHash },
            });
            if (!winner) {
              return yield* Effect.fail(
                new PaywallDeployServiceError({
                  cause: `deploy insert hit the (projectId, manifestHash) unique index for project ${project.id} but no row was found on re-read`,
                }),
              );
            }
            yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.id", winner.id);
            const missing = yield* computeMissing(project.id, allHashes);
            return { deployId: winner.id, missing } satisfies CreateDeployResult;
          }

          yield* auditLog.append({
            action: AuditLogAction.Created,
            changes: {
              cliVersion: manifest.cliVersion,
              componentCount: manifest.components.length,
              manifestHash,
              paywallCount: manifest.paywalls.length,
            },
            entityId: deployId,
            entityType: AuditLogEntityType.PaywallDeploy,
            projectId: project.id,
          });

          const missing = yield* computeMissing(project.id, allHashes);
          yield* Effect.annotateCurrentSpan(
            "voidhash.paywall_deploy.missing_count",
            missing.length,
          );
          yield* Effect.log(`Created paywall deploy ${deployId} for project ${project.id}`);
          return { deployId, missing } satisfies CreateDeployResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
              SqlError: (error: SqlError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const uploadBlob = Effect.fn("uploadBlob")(
        function* (input: {
          readonly deployId: string;
          readonly sha256: string;
          readonly body: Uint8Array;
          readonly contentType?: string;
        }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.id", input.deployId);
          const sha256 = input.sha256.toLowerCase();

          const deploy = yield* db.query.paywallDeploys.findFirst({
            where: { id: input.deployId },
          });
          if (!deploy) {
            return yield* Effect.fail(
              new PaywallDeployNotFoundError({
                message: `Paywall deploy not found: ${input.deployId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", deploy.projectId);
          yield* checkProjectPermission(
            deploy.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to upload blobs for deploy ${input.deployId}`,
          );
          if (deploy.status !== PaywallDeployStatus.pending) {
            return yield* Effect.fail(
              new PaywallDeployNotPendingError({
                message: `Deploy ${input.deployId} is not pending; blobs can no longer be uploaded`,
              }),
            );
          }

          const declared = yield* db.query.paywallDeployFiles.findFirst({
            where: { deployId: deploy.id, sha256 },
          });
          if (!declared) {
            return yield* Effect.fail(new DeployBlobNotDeclaredError({ sha256 }));
          }

          const actualSha256 = yield* sha256Hex(input.body);
          if (actualSha256 !== sha256) {
            return yield* Effect.fail(
              new DeployBlobHashMismatchError({ actualSha256, expectedSha256: sha256 }),
            );
          }

          const manifest = yield* decodeStoredManifest(deploy.manifest);

          // §1.1 enforced on ACTUAL bytes before anything is stored: the body
          // must match every declared `bytes` for this hash and respect the
          // role-appropriate size cap.
          const declaredEntries = manifestFileEntries(manifest).filter(
            (entry) => entry.sha256 === sha256,
          );
          const sizeViolations = validateUploadedBlobSize(declaredEntries, input.body.byteLength);
          if (Arr.isReadonlyArrayNonEmpty(sizeViolations)) {
            return yield* Effect.fail(
              new PaywallDeployValidationError({
                message: `Blob ${sha256} failed size validation: ${sizeViolations.join("; ")}`,
                violations: sizeViolations,
              }),
            );
          }

          const contentType = Option.fromNullishOr(input.contentType).pipe(
            Option.orElse(() => findDeclaredContentType(manifest, sha256)),
          );
          const storageKey = blobStorageKey(deploy.projectId, sha256);
          yield* store.putObject({
            body: input.body,
            contentType,
            key: storageKey,
          });

          // Insert-if-absent: re-uploads are a no-op. ON CONFLICT DO NOTHING
          // keeps the surviving row.
          yield* db
            .insert(paywallDeployBlobs)
            .values({
              bytes: input.body.byteLength,
              contentType: Option.getOrNull(contentType),
              id: generateId("paywallDeployBlob"),
              projectId: deploy.projectId,
              sha256,
              storageKey,
            })
            .onConflictDoNothing({
              target: [paywallDeployBlobs.projectId, paywallDeployBlobs.sha256],
            });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
              PaywallArtifactStoreError: (error: PaywallArtifactStoreError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: error.message })),
            }),
          ),
      );

      /** Recomputed-hash + stored-artifact validation ahead of the commit (see {@link makeManifestIntegrityVerifier}). */
      const verifyManifestIntegrity = makeManifestIntegrityVerifier({ fetchBlob });

      /** Copies blobs into the public §5/§5.1 serving layouts (see {@link makeServingLayoutCopier}). */
      const copyToServingLayout = makeServingLayoutCopier({
        fetchBlob,
        putObject: (input) =>
          store.putObject({ ...input, contentType: Option.some(input.contentType) }),
      });

      /** §4.3 per-paywall commit: upsert paywall, publish/reuse the release. */
      const commitPaywall = Effect.fn("PaywallDeployService.commitPaywall")(function* (
        tx: DbTransaction,
        input: {
          readonly deployId: string;
          readonly projectId: string;
          readonly manifestSchemaVersion: number;
          readonly manifestPaywall: ManifestPaywall;
          readonly publishedBy: string;
          readonly createdByUserId: Option.Option<string>;
          readonly now: Date;
        },
      ) {
        const { manifestPaywall } = input;
        const db = tx;
        const existingPaywall = yield* db.query.paywalls.findFirst({
          where: { projectId: input.projectId, slug: manifestPaywall.id },
        });
        const paywallId = existingPaywall?.id ?? generateId("paywall");
        if (existingPaywall) {
          yield* db
            .update(paywalls)
            .set({ name: manifestPaywall.title, source: PaywallSource.code })
            .where(eq(paywalls.id, paywallId));
        } else {
          yield* db.insert(paywalls).values({
            id: paywallId,
            name: manifestPaywall.title,
            projectId: input.projectId,
            slug: manifestPaywall.id,
            source: PaywallSource.code,
          });
        }

        const latestReleased = yield* db.query.paywallReleases.findFirst({
          orderBy: { version: "desc" },
          where: { paywallId, status: ReleaseStatus.released },
        });

        // Same content as the latest released version → reuse it, no new
        // version (contract §4.3.2). Deploying expresses "make this code
        // live", so a reused-but-rolled-back release is re-activated.
        if (latestReleased && latestReleased.contentHash === manifestPaywall.contentHash) {
          if (!latestReleased.isActive) {
            yield* db
              .update(paywallReleases)
              .set({ isActive: false })
              .where(
                and(eq(paywallReleases.paywallId, paywallId), eq(paywallReleases.isActive, true)),
              );
            yield* db
              .update(paywallReleases)
              .set({ isActive: true })
              .where(eq(paywallReleases.id, latestReleased.id));
            yield* propagateActiveReleaseToOpenShowings(tx, {
              createdByUserId: input.createdByUserId,
              newReleaseId: latestReleased.id,
              now: input.now,
              paywallId,
            });
          }
          return {
            contentHash: manifestPaywall.contentHash,
            id: manifestPaywall.id,
            paywallId,
            releaseId: latestReleased.id,
            url: releaseUrl(manifestPaywall.contentHash),
            version: latestReleased.version,
          } satisfies FinalizedPaywallSummary;
        }

        const latest = yield* db.query.paywallReleases.findFirst({
          orderBy: { version: "desc" },
          where: { paywallId },
        });
        const version = (latest?.version ?? 0) + 1;
        const releaseId = generateId("paywallRelease");
        yield* db
          .update(paywallReleases)
          .set({ isActive: false })
          .where(and(eq(paywallReleases.paywallId, paywallId), eq(paywallReleases.isActive, true)));
        yield* db.insert(paywallReleases).values({
          contentHash: manifestPaywall.contentHash,
          deployId: input.deployId,
          id: releaseId,
          isActive: true,
          paywallId,
          publishedAt: input.now,
          publishedBy: input.publishedBy,
          runtimeConfig: {
            productSlugs: [...manifestPaywall.products],
            variables: { ...manifestPaywall.variables },
          },
          s3Bucket: store.bucketName,
          s3Key: paywallServingHtmlKey(manifestPaywall.contentHash),
          schemaVersion: input.manifestSchemaVersion,
          status: ReleaseStatus.released,
          version,
        });
        yield* propagateActiveReleaseToOpenShowings(tx, {
          createdByUserId: input.createdByUserId,
          newReleaseId: releaseId,
          now: input.now,
          paywallId,
        });
        return {
          contentHash: manifestPaywall.contentHash,
          id: manifestPaywall.id,
          paywallId,
          releaseId,
          url: releaseUrl(manifestPaywall.contentHash),
          version,
        } satisfies FinalizedPaywallSummary;
      });

      /** §4.3 per-component commit: upsert component, version when content changed. */
      const commitComponent = Effect.fn("PaywallDeployService.commitComponent")(function* (
        tx: DbTransaction,
        input: {
          readonly deployId: string;
          readonly projectId: string;
          readonly manifestComponent: ManifestComponent;
          readonly componentManifest: ComponentManifest;
        },
      ) {
        const { manifestComponent } = input;
        const db = tx;
        const existingComponent = yield* db.query.paywallComponents.findFirst({
          where: { projectId: input.projectId, slug: manifestComponent.id },
        });
        const componentId = existingComponent?.id ?? generateId("paywallComponent");
        if (existingComponent) {
          yield* db
            .update(paywallComponents)
            .set({ title: manifestComponent.title ?? null })
            .where(eq(paywallComponents.id, componentId));
        } else {
          yield* db.insert(paywallComponents).values({
            id: componentId,
            projectId: input.projectId,
            slug: manifestComponent.id,
            title: manifestComponent.title ?? null,
          });
        }

        const latestVersion = yield* db.query.paywallComponentVersions.findFirst({
          orderBy: { version: "desc" },
          where: { componentId },
        });
        if (latestVersion && latestVersion.contentHash === manifestComponent.contentHash) {
          return {
            componentId,
            contentHash: manifestComponent.contentHash,
            id: manifestComponent.id,
            version: latestVersion.version,
          } satisfies FinalizedComponentSummary;
        }

        const version = (latestVersion?.version ?? 0) + 1;
        yield* db.insert(paywallComponentVersions).values({
          componentId,
          contentHash: manifestComponent.contentHash,
          deployId: input.deployId,
          id: generateId("paywallComponentVersion"),
          manifest: input.componentManifest,
          version,
        });
        return {
          componentId,
          contentHash: manifestComponent.contentHash,
          id: manifestComponent.id,
          version,
        } satisfies FinalizedComponentSummary;
      });

      const finalizeDeploy = Effect.fn("finalizeDeploy")(
        function* (input: { readonly deployId: string }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.id", input.deployId);

          const deploy = yield* db.query.paywallDeploys.findFirst({
            where: { id: input.deployId },
          });
          if (!deploy) {
            return yield* Effect.fail(
              new PaywallDeployNotFoundError({
                message: `Paywall deploy not found: ${input.deployId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", deploy.projectId);
          yield* checkProjectPermission(
            deploy.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to finalize deploy ${input.deployId}`,
          );

          const manifest = yield* decodeStoredManifest(deploy.manifest);

          const allHashes = collectManifestHashes(manifest);
          const uniqueHashes = [...HashSet.fromIterable(allHashes)];
          const blobRows = Arr.isReadonlyArrayNonEmpty(uniqueHashes)
            ? yield* db.query.paywallDeployBlobs.findMany({
                where: { projectId: deploy.projectId, sha256: { in: uniqueHashes } },
              })
            : [];
          const present = HashSet.fromIterable(blobRows.map((row) => row.sha256));
          const missing = allHashes.filter((hash) => !HashSet.has(present, hash));
          if (Arr.isReadonlyArrayNonEmpty(missing)) {
            return yield* Effect.fail(new IncompleteDeployError({ missing }));
          }

          // §1.1 caps re-verified against the bytes recorded at upload time
          // (defense in depth: rows written by older server code may predate
          // the upload-time enforcement).
          const capViolations = validateRecordedBlobCaps(
            manifest,
            HashMap.fromIterable(blobRows.map((row) => [row.sha256, row.bytes])),
          );
          if (Arr.isReadonlyArrayNonEmpty(capViolations)) {
            return yield* Effect.fail(
              new PaywallDeployValidationError({
                message: `Deploy failed validation: ${capViolations.join("; ")}`,
                violations: capViolations,
              }),
            );
          }

          const componentManifests = yield* verifyManifestIntegrity(deploy.projectId, manifest);

          // Copy into the public serving layouts before the DB commit: the
          // copies are content-addressed and idempotent, so a failed commit
          // leaves no broken state — finalize just retries.
          const assetsByPath = manifestAssetsByPath(manifest);
          yield* Effect.forEach(
            manifest.paywalls,
            (manifestPaywall) =>
              copyToServingLayout(
                deploy.projectId,
                servingCopiesForPaywall(manifestPaywall, assetsByPath),
              ),
            { concurrency: 1, discard: true },
          );
          yield* Effect.forEach(
            manifest.components,
            (manifestComponent) =>
              copyToServingLayout(deploy.projectId, servingCopiesForComponent(manifestComponent)),
            { concurrency: 1, discard: true },
          );

          const now = yield* DateTime.nowAsDate;
          const committed = yield* db.transaction(
            Effect.fn("PaywallDeployService.finalizeDeployTransaction")(function* (tx) {
              const paywallSummaries = yield* Effect.forEach(
                manifest.paywalls,
                (manifestPaywall) =>
                  commitPaywall(tx, {
                    createdByUserId: Option.fromNullishOr(session.user?.id),
                    deployId: deploy.id,
                    manifestPaywall,
                    manifestSchemaVersion: manifest.schemaVersion,
                    now,
                    projectId: deploy.projectId,
                    publishedBy: session.name,
                  }),
                { concurrency: 1 },
              );

              const componentSummaries = yield* Effect.forEach(
                manifest.components,
                Effect.fn("PaywallDeployService.commitManifestComponent")(
                  function* (manifestComponent) {
                    const componentManifest = HashMap.get(componentManifests, manifestComponent.id);
                    if (Option.isNone(componentManifest)) {
                      // verifyManifestIntegrity registers every component; a miss
                      // here is a programming error, not a user input problem.
                      return yield* Effect.die(
                        unexpectedError(
                          `component manifest missing for "${manifestComponent.id}" after validation`,
                        ),
                      );
                    }
                    return yield* commitComponent(tx, {
                      componentManifest: componentManifest.value,
                      deployId: deploy.id,
                      manifestComponent,
                      projectId: deploy.projectId,
                    });
                  },
                ),
                { concurrency: 1 },
              );

              yield* tx
                .update(paywallDeploys)
                .set({ status: PaywallDeployStatus.ready })
                .where(eq(paywallDeploys.id, deploy.id));

              return { componentSummaries, paywallSummaries };
            }),
          );

          yield* auditLog.append({
            action: AuditLogAction.Published,
            changes: {
              components: committed.componentSummaries,
              paywalls: committed.paywallSummaries,
            },
            entityId: deploy.id,
            entityType: AuditLogEntityType.PaywallDeploy,
            projectId: deploy.projectId,
          });

          yield* Effect.log(
            `Finalized paywall deploy ${deploy.id} for project ${deploy.projectId}`,
          );
          return {
            components: committed.componentSummaries,
            deployId: deploy.id,
            paywalls: committed.paywallSummaries,
            status: "ready",
          } satisfies FinalizeDeployResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
              SqlError: (error: SqlError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
              PaywallArtifactStoreError: (error: PaywallArtifactStoreError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: error.message })),
            }),
          ),
      );

      const listDeploys = Effect.fn("listDeploys")(
        function* (input: { readonly projectId: string }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list paywall deploys for project ${input.projectId}`,
          );

          const deploys = yield* db.query.paywallDeploys.findMany({
            orderBy: { createdAt: "desc" },
            where: { projectId: input.projectId },
          });
          yield* Effect.annotateCurrentSpan("voidhash.paywall_deploy.count", deploys.length);
          if (Arr.isReadonlyArrayEmpty(deploys)) {
            return [] satisfies ReadonlyArray<PaywallDeployListItem>;
          }

          // Stored manifests were schema-validated at create; a row that no
          // longer decodes (e.g. written by a newer schema) degrades to
          // empty summaries instead of failing the whole list — but loudly,
          // so schema drift is observable.
          const decodedDeploys = yield* Effect.forEach(
            deploys,
            Effect.fn("PaywallDeployService.decodeDeployListItem")(function* (deploy) {
              const decodeResult = yield* Effect.result(
                Schema.decodeUnknownEffect(
                  PaywallDeployManifestDefinition,
                  strictParseOptions,
                )(deploy.manifest),
              );
              if (Result.isFailure(decodeResult)) {
                yield* Effect.logWarning(
                  "paywall deploy manifest no longer decodes; rendering empty summaries",
                  { deployId: deploy.id, error: String(decodeResult.failure) },
                );
              }
              return {
                decoded: Result.isSuccess(decodeResult)
                  ? Option.some(decodeResult.success)
                  : Option.none<PaywallDeployManifest>(),
                deploy,
              };
            }),
            { concurrency: 1 },
          );

          // The §4.3 reuse branch keeps the ORIGINAL deployId on a reused
          // release/component-version row, so a later deploy whose content
          // matched gets no row carrying its own deployId. Resolve the
          // paywall/component rows by (projectId, slug) up front so the
          // summaries below can fall back to content matching.
          const paywallSlugs = HashSet.fromIterable(
            Arr.flatMap(decodedDeploys, ({ decoded }) =>
              Option.match(decoded, {
                onNone: () => [],
                onSome: (manifest) => manifest.paywalls.map((paywall) => paywall.id),
              }),
            ),
          );
          const componentSlugs = HashSet.fromIterable(
            Arr.flatMap(decodedDeploys, ({ decoded }) =>
              Option.match(decoded, {
                onNone: () => [],
                onSome: (manifest) => manifest.components.map((component) => component.id),
              }),
            ),
          );
          const paywallRows =
            HashSet.size(paywallSlugs) > 0
              ? yield* db.query.paywalls.findMany({
                  where: { projectId: input.projectId, slug: { in: [...paywallSlugs] } },
                })
              : [];
          const paywallIdBySlug = HashMap.fromIterable(
            paywallRows.map((row) => [row.slug, row.id]),
          );
          const componentRows =
            HashSet.size(componentSlugs) > 0
              ? yield* db.query.paywallComponents.findMany({
                  where: { projectId: input.projectId, slug: { in: [...componentSlugs] } },
                })
              : [];
          const componentIdBySlug = HashMap.fromIterable(
            componentRows.map((row) => [row.slug, row.id]),
          );

          const deployIds = deploys.map((deploy) => deploy.id);
          const releaseFilters: Array<Record<string, unknown>> = Arr.isReadonlyArrayNonEmpty(
            paywallRows,
          )
            ? [
                { deployId: { in: deployIds } },
                { paywallId: { in: paywallRows.map((row) => row.id) } },
              ]
            : [{ deployId: { in: deployIds } }];
          const releases = yield* db.query.paywallReleases.findMany({
            where: { OR: releaseFilters },
          });
          const versionFilters: Array<Record<string, unknown>> = Arr.isReadonlyArrayNonEmpty(
            componentRows,
          )
            ? [
                { deployId: { in: deployIds } },
                { componentId: { in: componentRows.map((row) => row.id) } },
              ]
            : [{ deployId: { in: deployIds } }];
          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            where: { OR: versionFilters },
          });

          /** Latest released release of `paywallId` carrying `contentHash` (deterministic: max version). */
          const latestReleaseByContent = (paywallId: Option.Option<string>, contentHash: string) =>
            Arr.reduce(releases, Option.none<(typeof releases)[number]>(), (best, row) => {
              if (
                !Option.exists(paywallId, (id) => row.paywallId === id) ||
                row.contentHash !== contentHash ||
                row.status !== ReleaseStatus.released
              ) {
                return best;
              }
              return Option.isNone(best) || row.version > best.value.version
                ? Option.some(row)
                : best;
            });
          /** Latest component version of `componentId` carrying `contentHash` (deterministic: max version). */
          const latestVersionByContent = (
            componentId: Option.Option<string>,
            contentHash: string,
          ) =>
            Arr.reduce(versionRows, Option.none<(typeof versionRows)[number]>(), (best, row) => {
              if (
                !Option.exists(componentId, (id) => row.componentId === id) ||
                row.contentHash !== contentHash
              ) {
                return best;
              }
              return Option.isNone(best) || row.version > best.value.version
                ? Option.some(row)
                : best;
            });

          return decodedDeploys.map(({ decoded, deploy }) => ({
            cliVersion: deploy.cliVersion,
            components: Option.match(decoded, {
              onNone: () => [],
              onSome: (manifest) =>
                manifest.components.map((component) => {
                  const versionRow = Option.orElse(
                    Arr.findFirst(
                      versionRows,
                      (row) =>
                        row.deployId === deploy.id && row.contentHash === component.contentHash,
                    ),
                    () =>
                      latestVersionByContent(
                        HashMap.get(componentIdBySlug, component.id),
                        component.contentHash,
                      ),
                  );
                  return {
                    componentId: Option.map(versionRow, (row) => row.componentId),
                    contentHash: component.contentHash,
                    slug: component.id,
                    version: Option.map(versionRow, (row) => row.version),
                  };
                }),
            }),
            createdAt: deploy.createdAt,
            createdByName: deploy.createdByName,
            id: deploy.id,
            paywalls: Option.match(decoded, {
              onNone: () => [],
              onSome: (manifest) =>
                manifest.paywalls.map((paywall) => {
                  const release = Option.orElse(
                    Arr.findFirst(
                      releases,
                      (row) =>
                        row.deployId === deploy.id && row.contentHash === paywall.contentHash,
                    ),
                    () =>
                      latestReleaseByContent(
                        HashMap.get(paywallIdBySlug, paywall.id),
                        paywall.contentHash,
                      ),
                  );
                  return {
                    contentHash: paywall.contentHash,
                    releaseId: Option.map(release, (row) => row.id),
                    slug: paywall.id,
                    version: Option.map(release, (row) => row.version),
                  };
                }),
            }),
            runtimeVersion: deploy.runtimeVersion,
            schemaVersion: deploy.schemaVersion,
            status: deployStatusLabel(deploy.status),
          })) satisfies ReadonlyArray<PaywallDeployListItem>;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * Stored deploy manifests for the given ids, decoded once and keyed by
       * deploy id; rows that no longer decode are skipped with a warning (see
       * {@link decodeStoredDeployManifestRows}).
       */
      const loadDeployManifests = Effect.fn("PaywallDeployService.loadDeployManifests")(function* (
        deployIds: ReadonlyArray<string>,
      ) {
        const unique = [...HashSet.fromIterable(deployIds)];
        if (Arr.isReadonlyArrayEmpty(unique)) {
          return HashMap.empty<string, PaywallDeployManifest>();
        }
        const rows = yield* db.query.paywallDeploys.findMany({
          where: { id: { in: unique } },
        });
        return yield* decodeStoredDeployManifestRows(rows);
      });

      /** Catalog detail for one version row, `None` on drift (see {@link makeComponentVersionDetailBuilder}). */
      const buildVersionDetail = makeComponentVersionDetailBuilder({
        publicBaseUrl: assetConfig.publicBaseUrl,
      });

      const listComponents = Effect.fn("listPaywallComponents")(
        function* (input: { readonly projectId: string }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list paywall components for project ${input.projectId}`,
          );

          const components = yield* db.query.paywallComponents.findMany({
            where: { projectId: input.projectId },
          });
          yield* Effect.annotateCurrentSpan("voidhash.paywall_component.count", components.length);
          if (Arr.isReadonlyArrayEmpty(components)) {
            return [] satisfies ReadonlyArray<PaywallComponentListItem>;
          }

          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            orderBy: { version: "desc" },
            where: { componentId: { in: components.map((component) => component.id) } },
          });
          const versionsByComponentId = Arr.reduce(
            versionRows,
            HashMap.empty<string, typeof versionRows>(),
            (groups, row) =>
              HashMap.set(groups, row.componentId, [
                ...Option.getOrElse(HashMap.get(groups, row.componentId), () => []),
                row,
              ]),
          );

          // Only the latest version per component needs the deploy-manifest
          // join — previous versions are summaries.
          const deployManifests = yield* loadDeployManifests(
            components.flatMap((component) => {
              return HashMap.get(versionsByComponentId, component.id).pipe(
                Option.flatMap(Arr.head),
                Option.map((latest) => latest.deployId),
                Arr.fromOption,
              );
            }),
          );

          const componentOrder = Order.make<(typeof components)[number]>((self, that) => {
            const comparison = compareSlugs(self.slug, that.slug);
            return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
          });
          const itemOptions = yield* Effect.forEach(
            Arr.sort(components, componentOrder),
            Effect.fn("PaywallDeployService.buildComponentListItem")(function* (component) {
              const versions = Option.getOrElse(
                HashMap.get(versionsByComponentId, component.id),
                () => [],
              );
              const latest = Arr.head(versions);
              if (Option.isNone(latest)) {
                // Finalize inserts the component and its first version in one
                // transaction; a versionless component is observable drift, not
                // a list failure.
                yield* Effect.logWarning(
                  `paywall component ${component.id} has no versions; omitting from the catalog`,
                );
                return Option.none<PaywallComponentListItem>();
              }
              const latestDetail = yield* buildVersionDetail({
                deployManifests,
                row: latest.value,
                slug: component.slug,
              });
              if (Option.isNone(latestDetail)) {
                return Option.none<PaywallComponentListItem>();
              }
              return Option.some({
                componentId: component.id,
                latest: latestDetail.value,
                latestVersion: latest.value.version,
                previousVersions: versions.slice(1).map((row) => ({
                  contentHash: row.contentHash,
                  createdAt: row.createdAt,
                  version: row.version,
                })),
                slug: component.slug,
                title: Option.fromNullishOr(component.title),
              });
            }),
            { concurrency: 1 },
          );
          return Arr.flatMap(
            itemOptions,
            Arr.fromOption,
          ) satisfies ReadonlyArray<PaywallComponentListItem>;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getComponentVersions = Effect.fn("getPaywallComponentVersions")(
        function* (input: {
          readonly projectId: string;
          readonly refs: ReadonlyArray<{ readonly slug: string; readonly version: number }>;
        }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to read paywall components for project ${input.projectId}`,
          );

          // Dedupe while preserving first-occurrence order; unknown refs are
          // simply absent from the result (the editor flags them as
          // missing-from-catalog).
          const emptyRefs: ReadonlyArray<{ readonly slug: string; readonly version: number }> = [];
          const deduplicated = Arr.reduce(
            input.refs,
            {
              refs: emptyRefs,
              seenRefs: HashSet.empty<string>(),
            },
            (state, ref) => {
              const key = `${ref.slug}@${ref.version}`;
              return HashSet.has(state.seenRefs, key)
                ? state
                : {
                    refs: [...state.refs, ref],
                    seenRefs: HashSet.add(state.seenRefs, key),
                  };
            },
          );
          const refs = deduplicated.refs;
          if (Arr.isReadonlyArrayEmpty(refs)) {
            return [] satisfies ReadonlyArray<PaywallComponentVersionDetail>;
          }

          const components = yield* db.query.paywallComponents.findMany({
            where: {
              projectId: input.projectId,
              slug: { in: [...HashSet.fromIterable(refs.map((ref) => ref.slug))] },
            },
          });
          if (Arr.isReadonlyArrayEmpty(components)) {
            return [] satisfies ReadonlyArray<PaywallComponentVersionDetail>;
          }
          const componentBySlug = HashMap.fromIterable(
            components.map((component) => [component.slug, component]),
          );

          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            where: { componentId: { in: components.map((component) => component.id) } },
          });
          const rowByRef = HashMap.fromIterable(
            versionRows.map((row) => [`${row.componentId}@${row.version}`, row]),
          );

          const matched: ReadonlyArray<{
            readonly slug: string;
            readonly row: (typeof versionRows)[number];
          }> = Arr.flatMap(refs, (ref) =>
            HashMap.get(componentBySlug, ref.slug).pipe(
              Option.flatMap((component) =>
                HashMap.get(rowByRef, `${component.id}@${ref.version}`),
              ),
              Option.map((row) => ({ row, slug: ref.slug })),
              Arr.fromOption,
            ),
          );

          const deployManifests = yield* loadDeployManifests(
            matched.map((entry) => entry.row.deployId),
          );
          const details = yield* Effect.forEach(
            matched,
            (entry) =>
              buildVersionDetail({
                deployManifests,
                row: entry.row,
                slug: entry.slug,
              }),
            { concurrency: 1 },
          );
          return Arr.flatMap(
            details,
            Arr.fromOption,
          ) satisfies ReadonlyArray<PaywallComponentVersionDetail>;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const setActivePaywallRelease = Effect.fn("setActivePaywallRelease")(
        function* (input: { readonly paywallId?: string; readonly releaseId: string }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_release.id", input.releaseId);

          const releaseWhere: { id: string; paywallId?: string } = { id: input.releaseId };
          if (input.paywallId !== undefined) releaseWhere.paywallId = input.paywallId;
          const release = yield* db.query.paywallReleases.findFirst({ where: releaseWhere });
          if (!release) {
            return yield* Effect.fail(
              new PaywallReleaseNotFoundError({
                message: `Paywall release not found: ${input.releaseId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.paywall.id", release.paywallId);
          const paywall = yield* db.query.paywalls.findFirst({
            where: { id: release.paywallId },
          });
          if (!paywall) {
            return yield* Effect.fail(
              new PaywallReleaseNotFoundError({
                message: `Paywall not found for release: ${input.releaseId}`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);
          yield* checkProjectPermission(
            paywall.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to activate release ${input.releaseId}`,
          );
          if (release.status !== ReleaseStatus.released) {
            return yield* Effect.fail(
              new PaywallDeployValidationError({
                message: `Release ${input.releaseId} is not released and cannot be activated`,
                violations: [`release ${input.releaseId} has status ${release.status}`],
              }),
            );
          }

          yield* db.transaction(
            Effect.fn("PaywallDeployService.setActiveReleaseTransaction")(function* (tx) {
              yield* tx
                .update(paywallReleases)
                .set({ isActive: false })
                .where(
                  and(
                    eq(paywallReleases.paywallId, release.paywallId),
                    eq(paywallReleases.isActive, true),
                  ),
                );
              yield* tx
                .update(paywallReleases)
                .set({ isActive: true })
                .where(eq(paywallReleases.id, release.id));
              // Activation pins open showings to the newly-active release
              // for CODE-source paywalls (contract §4.3); visual-editor
              // paywalls keep their explicitly-assigned showings.
              if (paywall.source === PaywallSource.code) {
                yield* propagateActiveReleaseToOpenShowings(tx, {
                  createdByUserId: Option.fromNullishOr(session.user?.id),
                  newReleaseId: release.id,
                  now: yield* DateTime.nowAsDate,
                  paywallId: release.paywallId,
                });
              }
            }),
          );

          yield* auditLog.append({
            action: AuditLogAction.Updated,
            changes: { isActive: true, version: release.version },
            entityId: release.id,
            entityType: AuditLogEntityType.PaywallRelease,
            parentEntityId: release.paywallId,
            projectId: paywall.projectId,
          });

          return { id: release.id, version: release.version };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error: DbError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
              SqlError: (error: SqlError) =>
                Effect.fail(new PaywallDeployServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({
        createDeploy,
        finalizeDeploy,
        getComponentVersions,
        listComponents,
        listDeploys,
        setActivePaywallRelease,
        uploadBlob,
      });
    }),
  },
) {
  static layer = Layer.effect(PaywallDeployService)(PaywallDeployService.make);
}
