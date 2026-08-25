/**
 * Integration test for {@link PaywallDeployService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB; the artifact store is an in-memory stub since R2/S3 is not
 * part of the harness).
 *
 * Drives the full contract §4 deploy lifecycle end-to-end and verifies the
 * *persisted* side effects rather than just the return values:
 *  - create (§4.1) → pending `paywall_deploy` + `paywall_deploy_file` rows and
 *    the full `missing` blob list,
 *  - upload (§4.2) → hash-verified blobs in the store + `paywall_deploy_blob`
 *    ledger rows (re-create then reports nothing missing),
 *  - finalize (§4.3) → released+active `paywall_release` row (version, s3Key,
 *    s3Bucket, runtimeConfig), `paywall_component`/`paywall_component_version`
 *    rows, §5 serving-layout objects in the store, ready deploy status, and
 *    the Created/Published audit entries,
 *  - idempotent re-deploy: the same manifest returns the same deploy and a
 *    re-finalize reuses the release/component version (no new rows).
 *
 * Conventions (mirroring `PaywallLocationService.integration.test.ts`):
 *  - All junk entities live under the seeded fixture project
 *    ({@link CoreTestFixture}); the test cleans up after itself via
 *    {@link withCleanup} (an `Effect.ensuring` finalizer lazily reading the
 *    collected ids), deleting deploy/file/blob/release/paywall/component rows
 *    AND the append-only audit rows by entity id. The global sweep is only a
 *    backstop.
 *  - Fixture file contents embed a per-run tag so every sha256 is unique:
 *    leftover content-addressed blob rows from a crashed run can never make
 *    `missing` incomplete, and slugs never collide with other tests' rows.
 *  - `PaywallDeployService.layer` needs `PaywallArtifactStore` and
 *    `PaywallAssetConfig` beyond the harness services, so the test provides
 *    both itself (in-memory store, `Layer.succeed` config).
 */
import { Clock, DateTime, Effect, Layer, Schema } from "effect";
import { describe, expect } from "vitest";

import {
  PaywallArtifactStore,
  type PaywallArtifactStoreShape,
  PaywallReleaseNotFoundError,
  PaywallDeployService,
  computeComponentContentHash,
  computePaywallContentHash,
  sha256Hex,
} from "@voidhash/core/services";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  PaywallDeployStatus,
  PaywallLocationShowingType,
  PaywallSource,
  ReleaseStatus,
  and,
  auditLogs,
  eq,
  inArray,
  paywallComponentVersions,
  paywallComponents,
  paywallDeployBlobs,
  paywallDeployFiles,
  paywallDeploys,
  paywallLocationShowings,
  paywallLocations,
  paywallReleases,
  paywalls,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** CDN base for visual-editor releases (unused by code deploys, required by the config shape). */
const CDN_URL = "https://cdn.integration.test";

/** Public serving base for code-deployed releases (deploy contract §5). */
const PUBLIC_BASE_URL = "https://api.integration.test";

/** Logical bucket the in-memory store reports; recorded on release rows. */
const BUCKET_NAME = "it-mem-bucket";

const PaywallAssetConfigTest = Layer.succeed(PaywallAssetConfig, {
  cdnUrl: CDN_URL,
  publicBaseUrl: PUBLIC_BASE_URL,
});

/**
 * In-memory {@link PaywallArtifactStore} mirroring the live-adapter semantics
 * (last-write-wins puts, `null` for missing keys). The `objects` map is shared
 * between the service layer and the test body so §5 serving-layout writes can
 * be asserted directly.
 */
const makeInMemoryArtifactStore = () => {
  const objects = new Map<string, { body: Uint8Array; contentType: string | null }>();
  const shape: PaywallArtifactStoreShape = {
    bucketName: BUCKET_NAME,
    getObject: (key) => Effect.sync(() => objects.get(key) ?? null),
    head: (key) =>
      Effect.sync(() => {
        const object = objects.get(key);
        if (!object) {
          return null;
        }
        return { size: object.body.byteLength };
      }),
    putObject: ({ body, contentType, key }) =>
      Effect.sync(() => {
        objects.set(key, { body, contentType: contentType ?? null });
      }),
  };
  return { layer: Layer.succeed(PaywallArtifactStore, shape), objects };
};

const artifactStore = makeInMemoryArtifactStore();

/** JSON serialization for the fixture manifest/preview blobs. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Provide the service + its extra deps, then authenticate as the fixture user. */
const provideService = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(PaywallDeployService.layer),
    Effect.provide(artifactStore.layer),
    Effect.provide(PaywallAssetConfigTest),
    CoreAuthSession.authenticate(),
  );

/** Monotonic counter so run tags stay unique even within the same millisecond. */
let seq = 0;

const encoder = new TextEncoder();

const makeBlob = (content: string) =>
  Effect.gen(function* () {
    const body = encoder.encode(content);
    const sha256 = yield* sha256Hex(body);
    return { body, sha256 };
  });

/**
 * Builds a minimal-but-complete §1 deploy fixture: one paywall (html + js +
 * one png asset), one component (§2 manifest + §3 preview + runtime), the
 * config file, and the raw blob bodies for every declared sha256. Contents
 * embed a unique run tag so all hashes/slugs are new for this run.
 * `overrides` pin the slugs (to target an existing paywall/component) and/or
 * vary the content (`contentTag`) so a second deploy of the same slug
 * produces a different contentHash.
 */
const buildDeployFixture = (overrides?: {
  readonly paywallSlug?: string;
  readonly componentSlug?: string;
  readonly contentTag?: string;
}) =>
  Effect.gen(function* () {
    const runTag = `${yield* Clock.currentTimeMillis}-${seq++}`;
    const paywallSlug = overrides?.paywallSlug ?? `it-dep-pw-${runTag}`;
    const componentSlug = overrides?.componentSlug ?? `it-dep-cmp-${runTag}`;
    const contentTag = overrides?.contentTag ?? runTag;
    const assetBasename = `hero-${contentTag}.png`;
    const assetPath = `.voidhash/.build/paywalls/${paywallSlug}/assets/${assetBasename}`;

    const html = yield* makeBlob(
      `<!doctype html><html><head><script src="./bundle.js"></script></head><body>it ${contentTag}</body></html>`,
    );
    const js = yield* makeBlob(`console.log("paywall ${contentTag}");`);
    const asset = yield* makeBlob(`png-bytes-${contentTag}`);
    const paywallSource = yield* makeBlob(`export default definePaywall(); // ${contentTag}`);
    const componentSource = yield* makeBlob(`export default defineComponent(); // ${contentTag}`);
    const runtimeJs = yield* makeBlob(`export const runtime = "${contentTag}";`);
    const config = yield* makeBlob(`export default {}; // ${contentTag}`);

    const componentManifestJson = {
      actions: { onSelect: { payload: { productId: { kind: "string" } } } },
      hostData: ["products"],
      manifestVersion: 2,
      previewStates: ["default"],
      props: {
        accentColor: { default: "#16a34a", editor: "color", kind: "string", optional: true },
        selected: { default: false, kind: "boolean", optional: true },
      },
      slot: false,
      title: "Integration Component",
    };
    const componentManifest = yield* makeBlob(encodeJson(componentManifestJson));

    const previewTreeJson = {
      root: {
        children: [{ style: { color: "#ffffff" }, text: `Yearly ${contentTag}`, type: "text" }],
        style: { flexDirection: "row", paddingTop: 16 },
        type: "view",
      },
      state: "default",
      treeVersion: 1,
    };
    const previewTree = yield* makeBlob(encodeJson(previewTreeJson));

    const paywallContentHash = yield* computePaywallContentHash({
      assetSha256s: [asset.sha256],
      htmlSha256: html.sha256,
      jsSha256: js.sha256,
    });
    const componentContentHash = yield* computeComponentContentHash({
      manifestSha256: componentManifest.sha256,
      panelSha256: null,
      previewSha256s: [previewTree.sha256],
      runtimeSha256: runtimeJs.sha256,
    });

    const variables = { accentColor: "#16a34a", showBadge: true };
    const products = ["yearly", "monthly"];

    const manifest = {
      assets: [
        {
          bytes: asset.body.byteLength,
          contentType: "image/png",
          path: assetPath,
          sha256: asset.sha256,
        },
      ],
      cliVersion: "0.0.1-it",
      components: [
        {
          artifacts: {
            panel: null,
            runtime: {
              bytes: runtimeJs.body.byteLength,
              contentType: "text/javascript; charset=utf-8",
              path: `.voidhash/.build/components/${componentSlug}/runtime.js`,
              sha256: runtimeJs.sha256,
            },
          },
          contentHash: componentContentHash,
          id: componentSlug,
          manifest: {
            bytes: componentManifest.body.byteLength,
            contentType: "application/json",
            path: `.voidhash/.build/components/${componentSlug}/manifest.json`,
            sha256: componentManifest.sha256,
          },
          previews: [
            {
              file: {
                bytes: previewTree.body.byteLength,
                contentType: "application/json",
                path: `.voidhash/.build/components/${componentSlug}/previews/default.json`,
                sha256: previewTree.sha256,
              },
              state: "default",
            },
          ],
          source: {
            bytes: componentSource.body.byteLength,
            path: `.voidhash/components/${componentSlug}.tsx`,
            sha256: componentSource.sha256,
          },
          title: "Integration Component",
        },
      ],
      config: { bytes: config.body.byteLength, path: "voidhash.config.ts", sha256: config.sha256 },
      createdAt: (yield* DateTime.nowAsDate).toISOString(),
      paywalls: [
        {
          artifacts: {
            html: {
              bytes: html.body.byteLength,
              contentType: "text/html; charset=utf-8",
              path: `.voidhash/.build/paywalls/${paywallSlug}/index.html`,
              sha256: html.sha256,
            },
            js: {
              bytes: js.body.byteLength,
              contentType: "text/javascript; charset=utf-8",
              path: `.voidhash/.build/paywalls/${paywallSlug}/bundle.js`,
              sha256: js.sha256,
            },
          },
          assets: [assetPath],
          contentHash: paywallContentHash,
          id: paywallSlug,
          products,
          source: {
            bytes: paywallSource.body.byteLength,
            path: `.voidhash/paywalls/${paywallSlug}.tsx`,
            sha256: paywallSource.sha256,
          },
          title: "Integration Deploy Paywall",
          variables,
        },
      ],
      project: CoreTestFixture.projectSlug,
      runtimeVersion: "0.0.1-it",
      schemaVersion: 2,
      team: CoreTestFixture.organizationSlug,
    };

    const blobs = [
      html,
      js,
      asset,
      paywallSource,
      componentSource,
      runtimeJs,
      config,
      componentManifest,
      previewTree,
    ];

    return {
      allHashes: [...new Set(blobs.map((blob) => blob.sha256))],
      assetBasename,
      blobs,
      componentContentHash,
      componentManifestJson,
      componentSlug,
      html,
      manifest,
      paywallContentHash,
      paywallSlug,
      products,
      variables,
    };
  });

/** Ids the test created, collected as it runs and read lazily by the finalizer. */
interface CreatedIds {
  readonly deployIds: string[];
  readonly paywallIds: string[];
  readonly componentIds: string[];
  readonly blobSha256s: string[];
  readonly locationIds: string[];
}

/**
 * Delete every row the test created: deploy files + blobs + the deploy rows,
 * releases + paywalls, component versions + components, and the append-only
 * audit rows recorded against the deploy entities. Each delete is `ignore`d
 * so a missing row never turns the finalizer into a failure.
 */
const cleanupCreated = (ids: CreatedIds) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const deployIds = [...ids.deployIds];
    const paywallIds = [...ids.paywallIds];
    const componentIds = [...ids.componentIds];
    const blobSha256s = [...ids.blobSha256s];
    const locationIds = [...ids.locationIds];

    if (locationIds.length > 0) {
      yield* db
        .delete(paywallLocationShowings)
        .where(inArray(paywallLocationShowings.paywallLocationId, locationIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(paywallLocations)
        .where(inArray(paywallLocations.id, locationIds))
        .pipe(Effect.ignore);
    }
    if (deployIds.length > 0) {
      yield* db
        .delete(paywallDeployFiles)
        .where(inArray(paywallDeployFiles.deployId, deployIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, AuditLogEntityType.PaywallDeploy),
            inArray(auditLogs.entityId, deployIds),
          ),
        )
        .pipe(Effect.ignore);
    }
    if (paywallIds.length > 0) {
      yield* db
        .delete(paywallReleases)
        .where(inArray(paywallReleases.paywallId, paywallIds))
        .pipe(Effect.ignore);
      yield* db.delete(paywalls).where(inArray(paywalls.id, paywallIds)).pipe(Effect.ignore);
    }
    if (componentIds.length > 0) {
      yield* db
        .delete(paywallComponentVersions)
        .where(inArray(paywallComponentVersions.componentId, componentIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(paywallComponents)
        .where(inArray(paywallComponents.id, componentIds))
        .pipe(Effect.ignore);
    }
    if (blobSha256s.length > 0) {
      yield* db
        .delete(paywallDeployBlobs)
        .where(
          and(
            eq(paywallDeployBlobs.projectId, projectId),
            inArray(paywallDeployBlobs.sha256, blobSha256s),
          ),
        )
        .pipe(Effect.ignore);
    }
    if (deployIds.length > 0) {
      yield* db
        .delete(paywallDeploys)
        .where(inArray(paywallDeploys.id, deployIds))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap the test body so everything it creates is removed afterward regardless
 * of how it exits. The body pushes ids into the shared {@link CreatedIds}
 * collector; cleanup reads them lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withCleanup = <E, R>(
  body: (ids: CreatedIds) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const ids: CreatedIds = {
    blobSha256s: [],
    componentIds: [],
    deployIds: [],
    locationIds: [],
    paywallIds: [],
  };
  return body(ids).pipe(Effect.ensuring(cleanupCreated(ids)));
};

const findDeployRow = (deployId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paywallDeploys.findFirst({ where: { id: deployId } });
  });

const findReleaseRows = (paywallId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(paywallReleases).where(eq(paywallReleases.paywallId, paywallId));
  });

const findComponentVersionRows = (componentId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(paywallComponentVersions)
      .where(eq(paywallComponentVersions.componentId, componentId));
  });

const findDeployAuditEntries = (deployId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.PaywallDeploy),
          eq(auditLogs.entityId, deployId),
        ),
      );
  });

describe("PaywallDeployService deploy lifecycle", () => {
  test(
    "create → upload → finalize publishes the release/component into the serving layout; re-deploying the same manifest is idempotent",
    withCleanup((ids) =>
      Effect.gen(function* () {
        const svc = yield* PaywallDeployService;
        const db = yield* Db;
        const fixture = yield* buildDeployFixture();
        ids.blobSha256s.push(...fixture.allHashes);

        // -- §4.1 create: pending deploy, every declared blob missing --------
        const created = yield* svc.createDeploy({ manifest: fixture.manifest });
        ids.deployIds.push(created.deployId);
        expect(created.deployId.startsWith("pw_dep_")).toBe(true);
        expect([...created.missing].sort()).toEqual([...fixture.allHashes].sort());

        const pendingRow = yield* findDeployRow(created.deployId);
        expect(pendingRow?.status).toBe(PaywallDeployStatus.pending);
        expect(pendingRow?.projectId).toBe(projectId);
        expect(pendingRow?.schemaVersion).toBe(2);

        // Every manifest file is declared as a paywall_deploy_file row.
        const fileRows = yield* db
          .select()
          .from(paywallDeployFiles)
          .where(eq(paywallDeployFiles.deployId, created.deployId));
        expect(new Set(fileRows.map((row) => row.sha256))).toEqual(new Set(fixture.allHashes));

        // -- §4.2 upload every declared blob ---------------------------------
        for (const blob of fixture.blobs) {
          yield* svc.uploadBlob({
            body: blob.body,
            deployId: created.deployId,
            sha256: blob.sha256,
          });
        }
        // Blobs land in the content-addressed upload layout...
        expect(artifactStore.objects.has(`blobs/${projectId}/${fixture.html.sha256}`)).toBe(true);
        // ...and in the per-project blob ledger.
        const blobRows = yield* db
          .select()
          .from(paywallDeployBlobs)
          .where(
            and(
              eq(paywallDeployBlobs.projectId, projectId),
              inArray(paywallDeployBlobs.sha256, [...fixture.allHashes]),
            ),
          );
        expect(blobRows.length).toBe(fixture.allHashes.length);

        // Re-POSTing the same manifest returns the same deploy, now complete.
        const recheck = yield* svc.createDeploy({ manifest: fixture.manifest });
        expect(recheck.deployId).toBe(created.deployId);
        expect(recheck.missing).toEqual([]);

        // -- §4.3 finalize ----------------------------------------------------
        const finalized = yield* svc.finalizeDeploy({ deployId: created.deployId });
        expect(finalized.deployId).toBe(created.deployId);
        expect(finalized.status).toBe("ready");
        const paywallSummary = finalized.paywalls[0];
        const componentSummary = finalized.components[0];
        expect(paywallSummary).toBeDefined();
        expect(componentSummary).toBeDefined();
        if (!paywallSummary || !componentSummary) return;
        ids.paywallIds.push(paywallSummary.paywallId);
        ids.componentIds.push(componentSummary.componentId);

        expect(paywallSummary.id).toBe(fixture.paywallSlug);
        expect(paywallSummary.version).toBe(1);
        expect(paywallSummary.contentHash).toBe(fixture.paywallContentHash);
        expect(paywallSummary.url).toBe(
          `${PUBLIC_BASE_URL}/p/${fixture.paywallContentHash}/index.html`,
        );
        expect(componentSummary.id).toBe(fixture.componentSlug);
        expect(componentSummary.version).toBe(1);
        expect(componentSummary.contentHash).toBe(fixture.componentContentHash);

        const readyRow = yield* findDeployRow(created.deployId);
        expect(readyRow?.status).toBe(PaywallDeployStatus.ready);

        // Paywall upserted by (projectId, slug) with source=code.
        const paywallRow = yield* db.query.paywalls.findFirst({
          where: { id: paywallSummary.paywallId },
        });
        expect(paywallRow?.slug).toBe(fixture.paywallSlug);
        expect(paywallRow?.projectId).toBe(projectId);
        expect(paywallRow?.source).toBe(PaywallSource.code);
        expect(paywallRow?.name).toBe("Integration Deploy Paywall");

        // Released + active release row carrying the §4.3 fields.
        const releaseRows = yield* findReleaseRows(paywallSummary.paywallId);
        expect(releaseRows.length).toBe(1);
        const release = releaseRows[0];
        expect(release?.id).toBe(paywallSummary.releaseId);
        expect(release?.version).toBe(1);
        expect(release?.s3Key).toBe(`p/${fixture.paywallContentHash}/index.html`);
        expect(release?.s3Bucket).toBe(BUCKET_NAME);
        expect(release?.isActive).toBe(true);
        expect(release?.status).toBe(ReleaseStatus.released);
        expect(release?.deployId).toBe(created.deployId);
        expect(release?.contentHash).toBe(fixture.paywallContentHash);
        expect(release?.runtimeConfig).toEqual({
          productSlugs: fixture.products,
          variables: fixture.variables,
        });
        expect(release?.publishedBy).toBe(
          `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
        );

        // Component + immutable version row storing the validated §2 manifest.
        const componentRow = yield* db.query.paywallComponents.findFirst({
          where: { id: componentSummary.componentId },
        });
        expect(componentRow?.slug).toBe(fixture.componentSlug);
        expect(componentRow?.projectId).toBe(projectId);
        expect(componentRow?.title).toBe("Integration Component");

        const versionRows = yield* findComponentVersionRows(componentSummary.componentId);
        expect(versionRows.length).toBe(1);
        const componentVersion = versionRows[0];
        expect(componentVersion?.version).toBe(1);
        expect(componentVersion?.contentHash).toBe(fixture.componentContentHash);
        expect(componentVersion?.deployId).toBe(created.deployId);
        expect(componentVersion?.manifest).toEqual(fixture.componentManifestJson);

        // §5 serving layout: html/js/asset copied under p/<contentHash>/.
        const servedHtml = artifactStore.objects.get(`p/${fixture.paywallContentHash}/index.html`);
        expect(servedHtml).toBeDefined();
        expect(servedHtml?.contentType).toBe("text/html; charset=utf-8");
        expect(new TextDecoder().decode(servedHtml?.body)).toBe(
          new TextDecoder().decode(fixture.html.body),
        );
        expect(
          artifactStore.objects.get(`p/${fixture.paywallContentHash}/bundle.js`)?.contentType,
        ).toBe("text/javascript; charset=utf-8");
        expect(
          artifactStore.objects.get(
            `p/${fixture.paywallContentHash}/assets/${fixture.assetBasename}`,
          )?.contentType,
        ).toBe("image/png");

        // Audit trail: Created at create, Published at finalize.
        const auditEntries = yield* findDeployAuditEntries(created.deployId);
        expect(auditEntries.some((entry) => entry.action === AuditLogAction.Created)).toBe(true);
        const publishedEntry = auditEntries.find(
          (entry) => entry.action === AuditLogAction.Published,
        );
        expect(publishedEntry).toBeDefined();
        expect(publishedEntry?.projectId).toBe(projectId);

        // -- idempotent re-deploy ---------------------------------------------
        // Same manifest → same deploy row; re-finalize reuses the release and
        // the component version (same content) instead of minting new ones.
        const again = yield* svc.createDeploy({ manifest: fixture.manifest });
        expect(again.deployId).toBe(created.deployId);
        expect(again.missing).toEqual([]);

        const refinalized = yield* svc.finalizeDeploy({ deployId: created.deployId });
        expect(refinalized.paywalls[0]?.releaseId).toBe(paywallSummary.releaseId);
        expect(refinalized.paywalls[0]?.version).toBe(1);
        expect(refinalized.components[0]?.componentId).toBe(componentSummary.componentId);
        expect(refinalized.components[0]?.version).toBe(1);

        const releasesAfter = yield* findReleaseRows(paywallSummary.paywallId);
        expect(releasesAfter.length).toBe(1);
        expect(releasesAfter[0]?.isActive).toBe(true);
        const versionsAfter = yield* findComponentVersionRows(componentSummary.componentId);
        expect(versionsAfter.length).toBe(1);
      }),
    ).pipe(provideService),
  );

  test(
    "release activation propagates to open showings: a second deploy repins them, and setActivePaywallRelease rolls them back",
    withCleanup((ids) =>
      Effect.gen(function* () {
        const svc = yield* PaywallDeployService;
        const db = yield* Db;

        // -- deploy v1 --------------------------------------------------------
        const v1 = yield* buildDeployFixture();
        ids.blobSha256s.push(...v1.allHashes);
        const createdV1 = yield* svc.createDeploy({ manifest: v1.manifest });
        ids.deployIds.push(createdV1.deployId);
        for (const blob of v1.blobs) {
          yield* svc.uploadBlob({
            body: blob.body,
            deployId: createdV1.deployId,
            sha256: blob.sha256,
          });
        }
        const finalizedV1 = yield* svc.finalizeDeploy({ deployId: createdV1.deployId });
        const summaryV1 = finalizedV1.paywalls[0];
        expect(summaryV1).toBeDefined();
        if (!summaryV1) return;
        ids.paywallIds.push(summaryV1.paywallId);
        const componentIdV1 = finalizedV1.components[0]?.componentId;
        if (componentIdV1) {
          ids.componentIds.push(componentIdV1);
        }

        // -- assign an open showing pinned to the v1 release ------------------
        const locationId = `it_dep_loc_${yield* Clock.currentTimeMillis}-${seq++}`;
        ids.locationIds.push(locationId);
        yield* db.insert(paywallLocations).values({
          id: locationId,
          name: "Deploy Propagation Location",
          projectId,
          slug: locationId,
        });
        const showingId = `it_dep_show_${yield* Clock.currentTimeMillis}-${seq++}`;
        yield* db.insert(paywallLocationShowings).values({
          createdByUserId: CoreTestFixture.userId,
          featureFlagId: null,
          id: showingId,
          paywallId: summaryV1.paywallId,
          paywallLocationId: locationId,
          paywallReleaseId: summaryV1.releaseId,
          projectId,
          startedAt: yield* DateTime.nowAsDate,
          type: PaywallLocationShowingType.paywallRelease,
        });

        const findOpenShowings = db.query.paywallLocationShowings.findMany({
          where: {
            paywallLocationId: locationId,
            endedAt: { isNull: true },
          },
        });

        // -- deploy v2: same slug, changed content -----------------------------
        const v2 = yield* buildDeployFixture({
          componentSlug: v1.componentSlug,
          contentTag: `${yield* Clock.currentTimeMillis}-${seq++}-v2`,
          paywallSlug: v1.paywallSlug,
        });
        ids.blobSha256s.push(...v2.allHashes);
        expect(v2.paywallContentHash).not.toBe(v1.paywallContentHash);
        const createdV2 = yield* svc.createDeploy({ manifest: v2.manifest });
        ids.deployIds.push(createdV2.deployId);
        for (const blob of v2.blobs) {
          yield* svc.uploadBlob({
            body: blob.body,
            deployId: createdV2.deployId,
            sha256: blob.sha256,
          });
        }
        const finalizedV2 = yield* svc.finalizeDeploy({ deployId: createdV2.deployId });
        const summaryV2 = finalizedV2.paywalls[0];
        expect(summaryV2).toBeDefined();
        if (!summaryV2) return;
        expect(summaryV2.paywallId).toBe(summaryV1.paywallId);
        expect(summaryV2.releaseId).not.toBe(summaryV1.releaseId);
        expect(summaryV2.version).toBe(2);

        // The open showing now pins the v2 release; the v1 showing was ended.
        const openAfterDeploy = yield* findOpenShowings;
        expect(openAfterDeploy.length).toBe(1);
        expect(openAfterDeploy[0]?.paywallReleaseId).toBe(summaryV2.releaseId);
        expect(openAfterDeploy[0]?.paywallId).toBe(summaryV1.paywallId);
        const endedOriginal = yield* db.query.paywallLocationShowings.findFirst({
          where: { id: showingId },
        });
        expect(endedOriginal?.endedAt).not.toBeNull();

        const unrelatedPaywallId = `it_dep_pw_${yield* Clock.currentTimeMillis}-${seq++}`;
        ids.paywallIds.push(unrelatedPaywallId);
        yield* db.insert(paywalls).values({
          id: unrelatedPaywallId,
          name: "Unrelated Paywall",
          projectId,
          slug: unrelatedPaywallId,
          source: PaywallSource.code,
        });
        const wrongParentError = yield* Effect.flip(
          svc.setActivePaywallRelease({
            paywallId: unrelatedPaywallId,
            releaseId: summaryV1.releaseId,
          }),
        );
        expect(wrongParentError).toBeInstanceOf(PaywallReleaseNotFoundError);
        const releasesAfterWrongParent = yield* findReleaseRows(summaryV1.paywallId);
        expect(
          releasesAfterWrongParent.find((row) => row.id === summaryV1.releaseId)?.isActive,
        ).toBe(false);
        expect(
          releasesAfterWrongParent.find((row) => row.id === summaryV2.releaseId)?.isActive,
        ).toBe(true);

        // -- roll back: activating v1 repins the open showing again ------------
        yield* svc.setActivePaywallRelease({
          paywallId: summaryV1.paywallId,
          releaseId: summaryV1.releaseId,
        });
        const openAfterRollback = yield* findOpenShowings;
        expect(openAfterRollback.length).toBe(1);
        expect(openAfterRollback[0]?.paywallReleaseId).toBe(summaryV1.releaseId);
        expect(openAfterRollback[0]?.createdByUserId).toBe(CoreTestFixture.userId);
      }),
    ).pipe(provideService),
  );
});
