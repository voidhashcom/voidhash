import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Option, Predicate, Result, Schema } from "effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

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
  ComponentManifestSchema,
  DEPLOY_MANIFEST_SCHEMA_VERSION,
  type ManifestComponent,
  type ManifestPaywall,
  type PaywallDeployManifest,
  PaywallDeployManifestSchema,
  PreviewTreeSchema,
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
 * whose `slug` equals `manifest.team` (contract §4). Returns `null` when the
 * session grants no such project — callers fail with a 403-style error.
 */
export const resolveSessionProject = (
  session: AnyAuthSession,
  team: string,
  project: string,
): { readonly id: string; readonly organizationId: string } | null => {
  const match = session.projects.find(
    (p) =>
      p.slug === project &&
      session.organizations.some((o) => o.id === p.organizationId && o.slug === team),
  );
  if (!match) return null;
  return { id: match.id, organizationId: match.organizationId };
};

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
  if (Predicate.hasProperty(value, "cause")) return value.cause;
  return undefined;
};

const isDuplicateKeyError = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 5; depth += 1) {
    if (Predicate.hasProperty(current, "errno") && current.errno === 1062) {
      return true;
    }
    if (Predicate.hasProperty(current, "code") && current.code === "ER_DUP_ENTRY") {
      return true;
    }
    current = causeOf(current);
  }
  return false;
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
    ) => Effect.Effect<PaywallArtifactObject | null, EGet, RGet>;
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
      if (object === null) {
        yield* deps.deleteStaleBlobRows(projectId, [sha256]);
        return yield* Effect.fail(new IncompleteDeployError({ missing: [sha256] }));
      }
      return object;
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
  ): Effect.Effect<Map<string, ComponentManifest>, PaywallDeployValidationError | EFetch, RFetch> =>
    Effect.gen(function* () {
      const violations = [...validateManifestConstraints(manifest)];
      const assetsByPath = manifestAssetsByPath(manifest);

      for (const paywall of manifest.paywalls) {
        const assetSha256s: string[] = [];
        for (const assetPath of paywall.assets) {
          const asset = assetsByPath.get(assetPath);
          if (asset) {
            assetSha256s.push(asset.sha256);
          }
        }
        const recomputed = yield* computePaywallContentHash({
          assetSha256s,
          htmlSha256: paywall.artifacts.html.sha256,
          jsSha256: paywall.artifacts.js.sha256,
        });
        if (recomputed !== paywall.contentHash) {
          violations.push(
            `paywall "${paywall.id}": contentHash mismatch (declared ${paywall.contentHash}, recomputed ${recomputed})`,
          );
        }
      }

      for (const component of manifest.components) {
        const recomputed = yield* computeComponentContentHash({
          manifestSha256: component.manifest.sha256,
          panelSha256: component.artifacts.panel?.sha256 ?? null,
          previewSha256s: component.previews.map((preview) => preview.file.sha256),
          runtimeSha256: component.artifacts.runtime.sha256,
        });
        if (recomputed !== component.contentHash) {
          violations.push(
            `component "${component.id}": contentHash mismatch (declared ${component.contentHash}, recomputed ${recomputed})`,
          );
        }
      }

      if (violations.length > 0) {
        return yield* Effect.fail(
          new PaywallDeployValidationError({
            message: `Deploy failed validation: ${violations.join("; ")}`,
            violations,
          }),
        );
      }

      const componentManifests = new Map<string, ComponentManifest>();
      for (const component of manifest.components) {
        const label = `component "${component.id}" manifest`;
        const manifestObject = yield* deps.fetchBlob(projectId, component.manifest.sha256);
        const manifestJson = yield* parseJsonBlob(manifestObject.body, label);
        const componentManifest = yield* Schema.decodeUnknownEffect(
          ComponentManifestSchema,
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
        componentManifests.set(component.id, componentManifest);

        for (const preview of component.previews) {
          const previewLabel = `component "${component.id}" preview "${preview.state}"`;
          const previewObject = yield* deps.fetchBlob(projectId, preview.file.sha256);
          const previewJson = yield* parseJsonBlob(previewObject.body, previewLabel);
          const previewTree = yield* Schema.decodeUnknownEffect(
            PreviewTreeSchema,
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
        }
      }

      return componentManifests;
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
      readonly contentType: string | undefined;
    }) => Effect.Effect<void, EPut, RPut>;
  }) =>
  (
    projectId: string,
    copies: ReadonlyArray<ServingCopy>,
  ): Effect.Effect<void, EFetch | EPut, RFetch | RPut> =>
    Effect.gen(function* () {
      for (const copy of copies) {
        const blob = yield* deps.fetchBlob(projectId, copy.sha256);
        yield* deps.putObject({
          body: blob.body,
          contentType: copy.contentType,
          key: copy.targetKey,
        });
      }
    });

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
    readonly releaseId: string | null;
    readonly version: number | null;
  }>;
  readonly components: ReadonlyArray<{
    readonly slug: string;
    readonly contentHash: string;
    readonly componentId: string | null;
    readonly version: number | null;
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
  readonly title: string | null;
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
): Effect.Effect<Map<string, PaywallDeployManifest>> =>
  Effect.gen(function* () {
    const decoded = new Map<string, PaywallDeployManifest>();
    for (const row of rows) {
      const result = yield* Effect.result(
        Schema.decodeUnknownEffect(PaywallDeployManifestSchema, strictParseOptions)(row.manifest),
      );
      if (Result.isFailure(result)) {
        yield* Effect.logWarning(
          "stored paywall deploy manifest no longer decodes; omitting its component versions from the catalog",
          { deployId: row.id, error: String(result.failure) },
        );
        continue;
      }
      decoded.set(row.id, result.success);
    }
    return decoded;
  });

/**
 * Builds the catalog detail resolver for one component version row. The row's
 * `deployId` always points at the MINTING deploy (the contentHash-reuse
 * branch never inserts), so `hasPanel`/`previewStates` derive from that
 * deploy's manifest entry matched by contentHash. A version whose metadata no
 * longer resolves — manifest row missing/undecodable, or no `components[]`
 * entry carrying the contentHash — degrades to `null` with a warning, and
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
    readonly deployManifests: ReadonlyMap<string, PaywallDeployManifest>;
  }): Effect.Effect<PaywallComponentVersionDetail | null> =>
    Effect.gen(function* () {
      const deployManifest = input.deployManifests.get(input.row.deployId);
      let metadata: ReturnType<typeof componentServingMetadata> | null = null;
      if (deployManifest) {
        metadata = componentServingMetadata(deployManifest, input.row.contentHash);
      }
      if (!metadata) {
        yield* Effect.logWarning(
          "paywall component version no longer resolves against its minting deploy manifest; omitting from the catalog",
          {
            contentHash: input.row.contentHash,
            deployId: input.row.deployId,
            slug: input.slug,
            version: input.row.version,
          },
        );
        return null;
      }
      return {
        artifactBaseUrl: `${deps.publicBaseUrl}/${componentServingPrefix(input.row.contentHash)}`,
        contentHash: input.row.contentHash,
        createdAt: input.row.createdAt,
        hasPanel: metadata.hasPanel,
        manifest: input.row.manifest,
        previewStates: metadata.previewStates,
        slug: input.slug,
        version: input.row.version,
      } satisfies PaywallComponentVersionDetail;
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
          PaywallDeployManifestSchema,
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
      const computeMissing = (projectId: string, hashes: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const unique = [...new Set(hashes)];
          if (unique.length === 0) {
            return [];
          }
          const rows = yield* db.query.paywallDeployBlobs.findMany({
            where: { projectId, sha256: { in: unique } },
          });
          const present = new Set(rows.map((row) => row.sha256));
          return unique.filter((hash) => !present.has(hash));
        });

      /** Reads an uploaded blob; absence at this point means ledger/store drift (see {@link makeBlobFetcher}). */
      const fetchBlob = makeBlobFetcher({
        deleteStaleBlobRows: (projectId, sha256s) =>
          Effect.gen(function* () {
            yield* db
              .delete(paywallDeployBlobs)
              .where(
                and(
                  eq(paywallDeployBlobs.projectId, projectId),
                  inArray(paywallDeployBlobs.sha256, [...sha256s]),
                ),
              );
          }),
        getObject: (projectId, sha256) => store.getObject(blobStorageKey(projectId, sha256)),
      });

      /**
       * Propagates a newly-activated CODE-source release to open showings
       * (contract §4.3): every open `paywallRelease` showing of this paywall
       * that still pins a different release is ended and replaced by a new
       * open showing pinning `newReleaseId` (same location/type/paywall).
       * Runs inside the caller's transaction so activation and propagation
       * commit atomically.
       */
      const propagateActiveReleaseToOpenShowings = (
        tx: DbTransaction,
        input: {
          readonly paywallId: string;
          readonly newReleaseId: string;
          readonly now: Date;
          readonly createdByUserId: string | null;
        },
      ) =>
        Effect.gen(function* () {
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
          if (stale.length === 0) {
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
              createdByUserId: input.createdByUserId,
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

      const annotateSession = (session: AnyAuthSession) =>
        Effect.gen(function* () {
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
          const peekedVersion = Option.match(peeked, {
            onNone: (): number | null => null,
            onSome: (value) => value.schemaVersion,
          });
          if (peekedVersion !== DEPLOY_MANIFEST_SCHEMA_VERSION) {
            return yield* Effect.fail(
              new UnsupportedDeploySchemaVersionError({
                message: `Unsupported deploy manifest schemaVersion ${String(peekedVersion)}; this server expects ${DEPLOY_MANIFEST_SCHEMA_VERSION}. Upgrade voidhash-cli and re-run the deploy.`,
                schemaVersion: peekedVersion,
              }),
            );
          }

          const manifest = yield* Schema.decodeUnknownEffect(
            PaywallDeployManifestSchema,
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

          const project = resolveSessionProject(session, manifest.team, manifest.project);
          if (!project) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: `Session has no access to project "${manifest.project}" in team "${manifest.team}"`,
              }),
            );
          }
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
            .transaction((tx) =>
              Effect.gen(function* () {
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
                if (fileEntries.length > 0) {
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
          if (sizeViolations.length > 0) {
            return yield* Effect.fail(
              new PaywallDeployValidationError({
                message: `Blob ${sha256} failed size validation: ${sizeViolations.join("; ")}`,
                violations: sizeViolations,
              }),
            );
          }

          const contentType = input.contentType ?? findDeclaredContentType(manifest, sha256);
          const storageKey = blobStorageKey(deploy.projectId, sha256);
          yield* store.putObject({
            body: input.body,
            contentType: contentType ?? undefined,
            key: storageKey,
          });

          // Insert-if-absent: re-uploads are a no-op. ON CONFLICT DO NOTHING
          // keeps the surviving row.
          yield* db
            .insert(paywallDeployBlobs)
            .values({
              bytes: input.body.byteLength,
              contentType,
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
        putObject: store.putObject,
      });

      /** §4.3 per-paywall commit: upsert paywall, publish/reuse the release. */
      const commitPaywall = (
        tx: DbTransaction,
        input: {
          readonly deployId: string;
          readonly projectId: string;
          readonly manifestSchemaVersion: number;
          readonly manifestPaywall: ManifestPaywall;
          readonly publishedBy: string;
          readonly createdByUserId: string | null;
          readonly now: Date;
        },
      ) =>
        Effect.gen(function* () {
          const { manifestPaywall } = input;
          const db = tx;
          const existingPaywall = yield* db.query.paywalls.findFirst({
            where: { projectId: input.projectId, slug: manifestPaywall.id },
          });
          let paywallId: string;
          if (existingPaywall) {
            paywallId = existingPaywall.id;
            yield* db
              .update(paywalls)
              .set({ name: manifestPaywall.title, source: PaywallSource.code })
              .where(eq(paywalls.id, paywallId));
          } else {
            paywallId = generateId("paywall");
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
            .where(
              and(eq(paywallReleases.paywallId, paywallId), eq(paywallReleases.isActive, true)),
            );
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
      const commitComponent = (
        tx: DbTransaction,
        input: {
          readonly deployId: string;
          readonly projectId: string;
          readonly manifestComponent: ManifestComponent;
          readonly componentManifest: ComponentManifest;
        },
      ) =>
        Effect.gen(function* () {
          const { manifestComponent } = input;
          const db = tx;
          const existingComponent = yield* db.query.paywallComponents.findFirst({
            where: { projectId: input.projectId, slug: manifestComponent.id },
          });
          let componentId: string;
          if (existingComponent) {
            componentId = existingComponent.id;
            yield* db
              .update(paywallComponents)
              .set({ title: manifestComponent.title ?? null })
              .where(eq(paywallComponents.id, componentId));
          } else {
            componentId = generateId("paywallComponent");
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
          const uniqueHashes = [...new Set(allHashes)];
          let blobRows: Array<{ readonly sha256: string; readonly bytes: number }> = [];
          if (uniqueHashes.length > 0) {
            blobRows = yield* db.query.paywallDeployBlobs.findMany({
              where: { projectId: deploy.projectId, sha256: { in: uniqueHashes } },
            });
          }
          const present = new Set(blobRows.map((row) => row.sha256));
          const missing = allHashes.filter((hash) => !present.has(hash));
          if (missing.length > 0) {
            return yield* Effect.fail(new IncompleteDeployError({ missing }));
          }

          // §1.1 caps re-verified against the bytes recorded at upload time
          // (defense in depth: rows written by older server code may predate
          // the upload-time enforcement).
          const capViolations = validateRecordedBlobCaps(
            manifest,
            new Map(blobRows.map((row) => [row.sha256, row.bytes])),
          );
          if (capViolations.length > 0) {
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
          for (const manifestPaywall of manifest.paywalls) {
            yield* copyToServingLayout(
              deploy.projectId,
              servingCopiesForPaywall(manifestPaywall, assetsByPath),
            );
          }
          for (const manifestComponent of manifest.components) {
            yield* copyToServingLayout(
              deploy.projectId,
              servingCopiesForComponent(manifestComponent),
            );
          }

          const now = yield* DateTime.nowAsDate;
          const committed = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const paywallSummaries: FinalizedPaywallSummary[] = [];
              for (const manifestPaywall of manifest.paywalls) {
                paywallSummaries.push(
                  yield* commitPaywall(tx, {
                    createdByUserId: session.user?.id ?? null,
                    deployId: deploy.id,
                    manifestPaywall,
                    manifestSchemaVersion: manifest.schemaVersion,
                    now,
                    projectId: deploy.projectId,
                    publishedBy: session.name,
                  }),
                );
              }

              const componentSummaries: FinalizedComponentSummary[] = [];
              for (const manifestComponent of manifest.components) {
                const componentManifest = componentManifests.get(manifestComponent.id);
                if (!componentManifest) {
                  // verifyManifestIntegrity registers every component; a miss
                  // here is a programming error, not a user input problem.
                  return yield* Effect.die(
                    new Error(
                      `component manifest missing for "${manifestComponent.id}" after validation`,
                    ),
                  );
                }
                componentSummaries.push(
                  yield* commitComponent(tx, {
                    componentManifest,
                    deployId: deploy.id,
                    manifestComponent,
                    projectId: deploy.projectId,
                  }),
                );
              }

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
          if (deploys.length === 0) {
            return [] satisfies ReadonlyArray<PaywallDeployListItem>;
          }

          // Stored manifests were schema-validated at create; a row that no
          // longer decodes (e.g. written by a newer schema) degrades to
          // empty summaries instead of failing the whole list — but loudly,
          // so schema drift is observable.
          const decodedDeploys: Array<{
            readonly deploy: (typeof deploys)[number];
            readonly decoded: PaywallDeployManifest | undefined;
          }> = [];
          for (const deploy of deploys) {
            const decodeResult = yield* Effect.result(
              Schema.decodeUnknownEffect(
                PaywallDeployManifestSchema,
                strictParseOptions,
              )(deploy.manifest),
            );
            if (Result.isFailure(decodeResult)) {
              yield* Effect.logWarning(
                "paywall deploy manifest no longer decodes; rendering empty summaries",
                { deployId: deploy.id, error: String(decodeResult.failure) },
              );
            }
            decodedDeploys.push({ decoded: Result.getOrUndefined(decodeResult), deploy });
          }

          // The §4.3 reuse branch keeps the ORIGINAL deployId on a reused
          // release/component-version row, so a later deploy whose content
          // matched gets no row carrying its own deployId. Resolve the
          // paywall/component rows by (projectId, slug) up front so the
          // summaries below can fall back to content matching.
          const paywallSlugs = new Set<string>();
          const componentSlugs = new Set<string>();
          for (const { decoded } of decodedDeploys) {
            for (const paywall of decoded?.paywalls ?? []) {
              paywallSlugs.add(paywall.id);
            }
            for (const component of decoded?.components ?? []) {
              componentSlugs.add(component.id);
            }
          }
          let paywallRows: Array<{ readonly slug: string; readonly id: string }> = [];
          if (paywallSlugs.size > 0) {
            paywallRows = yield* db.query.paywalls.findMany({
              where: { projectId: input.projectId, slug: { in: [...paywallSlugs] } },
            });
          }
          const paywallIdBySlug = new Map(paywallRows.map((row) => [row.slug, row.id]));
          let componentRows: Array<{ readonly slug: string; readonly id: string }> = [];
          if (componentSlugs.size > 0) {
            componentRows = yield* db.query.paywallComponents.findMany({
              where: { projectId: input.projectId, slug: { in: [...componentSlugs] } },
            });
          }
          const componentIdBySlug = new Map(componentRows.map((row) => [row.slug, row.id]));

          const deployIds = deploys.map((deploy) => deploy.id);
          const releaseFilters: Array<Record<string, unknown>> = [{ deployId: { in: deployIds } }];
          if (paywallRows.length > 0) {
            releaseFilters.push({ paywallId: { in: paywallRows.map((row) => row.id) } });
          }
          const releases = yield* db.query.paywallReleases.findMany({
            where: { OR: releaseFilters },
          });
          const versionFilters: Array<Record<string, unknown>> = [{ deployId: { in: deployIds } }];
          if (componentRows.length > 0) {
            versionFilters.push({ componentId: { in: componentRows.map((row) => row.id) } });
          }
          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            where: { OR: versionFilters },
          });

          /** Latest released release of `paywallId` carrying `contentHash` (deterministic: max version). */
          const latestReleaseByContent = (paywallId: string | undefined, contentHash: string) => {
            let best: (typeof releases)[number] | undefined;
            for (const row of releases) {
              if (
                row.paywallId !== paywallId ||
                row.contentHash !== contentHash ||
                row.status !== ReleaseStatus.released
              ) {
                continue;
              }
              if (best === undefined || row.version > best.version) {
                best = row;
              }
            }
            return best;
          };
          /** Latest component version of `componentId` carrying `contentHash` (deterministic: max version). */
          const latestVersionByContent = (componentId: string | undefined, contentHash: string) => {
            let best: (typeof versionRows)[number] | undefined;
            for (const row of versionRows) {
              if (row.componentId !== componentId || row.contentHash !== contentHash) {
                continue;
              }
              if (best === undefined || row.version > best.version) {
                best = row;
              }
            }
            return best;
          };

          const items: PaywallDeployListItem[] = [];
          for (const { decoded, deploy } of decodedDeploys) {
            items.push({
              cliVersion: deploy.cliVersion,
              components:
                decoded?.components.map((component) => {
                  const versionRow =
                    versionRows.find(
                      (row) =>
                        row.deployId === deploy.id && row.contentHash === component.contentHash,
                    ) ??
                    latestVersionByContent(
                      componentIdBySlug.get(component.id),
                      component.contentHash,
                    );
                  return {
                    componentId: versionRow?.componentId ?? null,
                    contentHash: component.contentHash,
                    slug: component.id,
                    version: versionRow?.version ?? null,
                  };
                }) ?? [],
              createdAt: deploy.createdAt,
              createdByName: deploy.createdByName,
              id: deploy.id,
              paywalls:
                decoded?.paywalls.map((paywall) => {
                  const release =
                    releases.find(
                      (row) =>
                        row.deployId === deploy.id && row.contentHash === paywall.contentHash,
                    ) ??
                    latestReleaseByContent(paywallIdBySlug.get(paywall.id), paywall.contentHash);
                  return {
                    contentHash: paywall.contentHash,
                    releaseId: release?.id ?? null,
                    slug: paywall.id,
                    version: release?.version ?? null,
                  };
                }) ?? [],
              runtimeVersion: deploy.runtimeVersion,
              schemaVersion: deploy.schemaVersion,
              status: deployStatusLabel(deploy.status),
            });
          }
          return items satisfies ReadonlyArray<PaywallDeployListItem>;
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
      const loadDeployManifests = (deployIds: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const unique = [...new Set(deployIds)];
          if (unique.length === 0) {
            return new Map<string, PaywallDeployManifest>();
          }
          const rows = yield* db.query.paywallDeploys.findMany({
            where: { id: { in: unique } },
          });
          return yield* decodeStoredDeployManifestRows(rows);
        });

      /** Catalog detail for one version row, `null` on drift (see {@link makeComponentVersionDetailBuilder}). */
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
          if (components.length === 0) {
            return [] satisfies ReadonlyArray<PaywallComponentListItem>;
          }

          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            orderBy: { version: "desc" },
            where: { componentId: { in: components.map((component) => component.id) } },
          });
          const versionsByComponentId = new Map<string, typeof versionRows>();
          for (const row of versionRows) {
            const group = versionsByComponentId.get(row.componentId);
            if (group) {
              group.push(row);
            } else {
              versionsByComponentId.set(row.componentId, [row]);
            }
          }

          // Only the latest version per component needs the deploy-manifest
          // join — previous versions are summaries.
          const deployManifests = yield* loadDeployManifests(
            components.flatMap((component) => {
              const latest = versionsByComponentId.get(component.id)?.[0];
              if (!latest) return [];
              return [latest.deployId];
            }),
          );

          const items: PaywallComponentListItem[] = [];
          for (const component of [...components].sort((a, b) => compareSlugs(a.slug, b.slug))) {
            const versions = versionsByComponentId.get(component.id) ?? [];
            const latest = versions[0];
            if (!latest) {
              // Finalize inserts the component and its first version in one
              // transaction; a versionless component is observable drift, not
              // a list failure.
              yield* Effect.logWarning(
                `paywall component ${component.id} has no versions; omitting from the catalog`,
              );
              continue;
            }
            const latestDetail = yield* buildVersionDetail({
              deployManifests,
              row: latest,
              slug: component.slug,
            });
            if (!latestDetail) {
              continue;
            }
            items.push({
              componentId: component.id,
              latest: latestDetail,
              latestVersion: latest.version,
              previousVersions: versions.slice(1).map((row) => ({
                contentHash: row.contentHash,
                createdAt: row.createdAt,
                version: row.version,
              })),
              slug: component.slug,
              title: component.title,
            });
          }
          return items satisfies ReadonlyArray<PaywallComponentListItem>;
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
          const refs: Array<{ readonly slug: string; readonly version: number }> = [];
          const seenRefs = new Set<string>();
          for (const ref of input.refs) {
            const key = `${ref.slug}@${ref.version}`;
            if (!seenRefs.has(key)) {
              seenRefs.add(key);
              refs.push(ref);
            }
          }
          if (refs.length === 0) {
            return [] satisfies ReadonlyArray<PaywallComponentVersionDetail>;
          }

          const components = yield* db.query.paywallComponents.findMany({
            where: {
              projectId: input.projectId,
              slug: { in: [...new Set(refs.map((ref) => ref.slug))] },
            },
          });
          if (components.length === 0) {
            return [] satisfies ReadonlyArray<PaywallComponentVersionDetail>;
          }
          const componentBySlug = new Map(
            components.map((component) => [component.slug, component]),
          );

          const versionRows = yield* db.query.paywallComponentVersions.findMany({
            where: { componentId: { in: components.map((component) => component.id) } },
          });
          const rowByRef = new Map<string, (typeof versionRows)[number]>();
          for (const row of versionRows) {
            rowByRef.set(`${row.componentId}@${row.version}`, row);
          }

          const matched: Array<{
            readonly slug: string;
            readonly row: (typeof versionRows)[number];
          }> = [];
          for (const ref of refs) {
            const component = componentBySlug.get(ref.slug);
            let row: (typeof versionRows)[number] | undefined;
            if (component) {
              row = rowByRef.get(`${component.id}@${ref.version}`);
            }
            if (row) {
              matched.push({ row, slug: ref.slug });
            }
          }

          const deployManifests = yield* loadDeployManifests(
            matched.map((entry) => entry.row.deployId),
          );
          const details: PaywallComponentVersionDetail[] = [];
          for (const entry of matched) {
            const detail = yield* buildVersionDetail({
              deployManifests,
              row: entry.row,
              slug: entry.slug,
            });
            // Drifted rows are omitted like unknown refs — the editor already
            // flags absent refs as missing-from-catalog.
            if (detail) {
              details.push(detail);
            }
          }
          return details satisfies ReadonlyArray<PaywallComponentVersionDetail>;
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
        function* (input: { readonly releaseId: string }) {
          const session = yield* AuthSession;
          yield* annotateSession(session);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_release.id", input.releaseId);

          const release = yield* db.query.paywallReleases.findFirst({
            where: { id: input.releaseId },
          });
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

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
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
                  createdByUserId: session.user?.id ?? null,
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
