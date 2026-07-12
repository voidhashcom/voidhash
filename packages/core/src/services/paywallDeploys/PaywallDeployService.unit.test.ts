import { Effect, Layer, Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { AnyAuthSession } from "../../domain/auth/Auth.ts";
import {
  PaywallArtifactStore,
  PaywallArtifactStoreError,
  type PaywallArtifactStoreShape,
} from "./PaywallArtifactStore.ts";
import {
  IncompleteDeployError,
  PaywallDeployValidationError,
  decodeStoredDeployManifestRows,
  makeBlobFetcher,
  makeComponentVersionDetailBuilder,
  makeManifestIntegrityVerifier,
  makeServingLayoutCopier,
  resolveSessionProject,
} from "./PaywallDeployService.ts";
import {
  PaywallDeployManifestSchema,
  blobStorageKey,
  computeComponentContentHash,
  servingCopiesForComponent,
  sha256Hex,
  strictParseOptions,
} from "./PaywallDeployManifest.ts";

// ---------------------------------------------------------------------------
// resolveSessionProject (contract §4 team/project slug authorization)
// ---------------------------------------------------------------------------

const makeSession = (input: {
  readonly organizations: ReadonlyArray<{ readonly id: string; readonly slug: string }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly organizationId: string;
  }>;
}): AnyAuthSession => ({
  cookie: null,
  method: "secret-key",
  name: "ci-key",
  organizations: input.organizations.map((organization) => ({
    id: organization.id,
    logo: null,
    name: organization.slug,
    permissions: ["project:all"],
    slug: organization.slug,
    workosOrganizationId: null,
  })),
  person: null,
  projects: input.projects.map((project) => ({
    id: project.id,
    logo: null,
    name: project.slug,
    organizationId: project.organizationId,
    permissions: ["project:all"],
    slug: project.slug,
  })),
  user: null,
});

describe("resolveSessionProject", () => {
  const session = makeSession({
    organizations: [
      { id: "org_1", slug: "acme" },
      { id: "org_2", slug: "globex" },
    ],
    projects: [
      { id: "proj_1", organizationId: "org_1", slug: "app" },
      { id: "proj_2", organizationId: "org_2", slug: "app" },
      { id: "proj_3", organizationId: "org_1", slug: "site" },
    ],
  });

  it("matches the project by (team slug, project slug)", () => {
    expect(resolveSessionProject(session, "acme", "app")).toEqual({
      id: "proj_1",
      organizationId: "org_1",
    });
  });

  it("disambiguates identical project slugs by team", () => {
    expect(resolveSessionProject(session, "globex", "app")).toEqual({
      id: "proj_2",
      organizationId: "org_2",
    });
  });

  it("returns null for an unknown project slug", () => {
    expect(resolveSessionProject(session, "acme", "nope")).toBeNull();
  });

  it("returns null when the project exists in a different team", () => {
    expect(resolveSessionProject(session, "globex", "site")).toBeNull();
  });

  it("returns null for an unknown team slug", () => {
    expect(resolveSessionProject(session, "initech", "app")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// In-memory PaywallArtifactStore stub
// ---------------------------------------------------------------------------

/**
 * Reference in-memory implementation of the {@link PaywallArtifactStore} port
 * contract, usable as a layer in Db-free service tests. Mirrors the semantics
 * live adapters must provide: last-write-wins puts, `null` for missing keys.
 */
const makeInMemoryArtifactStore = (bucketName = "test-bucket") => {
  const objects = new Map<string, { body: Uint8Array; contentType: string | null }>();
  const shape: PaywallArtifactStoreShape = {
    bucketName,
    getObject: (key) => Effect.sync(() => objects.get(key) ?? null),
    head: (key) =>
      Effect.sync(() => {
        const object = objects.get(key);
        return object ? { size: object.body.byteLength } : null;
      }),
    putObject: ({ body, contentType, key }) =>
      Effect.sync(() => {
        objects.set(key, { body, contentType: contentType ?? null });
      }),
  };
  return { layer: Layer.succeed(PaywallArtifactStore, shape), objects, shape };
};

describe("in-memory PaywallArtifactStore stub", () => {
  it("round-trips put/get/head through the port tag", async () => {
    const stub = makeInMemoryArtifactStore();
    const program = Effect.gen(function* () {
      const store = yield* PaywallArtifactStore;
      expect(store.bucketName).toBe("test-bucket");
      yield* store.putObject({
        body: new TextEncoder().encode("<html></html>"),
        contentType: "text/html",
        key: "blobs/proj_1/abc",
      });
      const found = yield* store.getObject("blobs/proj_1/abc");
      const missing = yield* store.getObject("blobs/proj_1/missing");
      const foundHead = yield* store.head("blobs/proj_1/abc");
      const missingHead = yield* store.head("blobs/proj_1/missing");
      return { found, foundHead, missing, missingHead };
    }).pipe(Effect.provide(stub.layer));

    const result = await Effect.runPromise(program);
    expect(result.found?.contentType).toBe("text/html");
    expect(new TextDecoder().decode(result.found?.body)).toBe("<html></html>");
    expect(result.foundHead).toEqual({ size: 13 });
    expect(result.missing).toBeNull();
    expect(result.missingHead).toBeNull();
  });

  it("treats puts as idempotent overwrites", async () => {
    const stub = makeInMemoryArtifactStore();
    const program = Effect.gen(function* () {
      const store = yield* PaywallArtifactStore;
      yield* store.putObject({
        body: new TextEncoder().encode("one"),
        contentType: undefined,
        key: "k",
      });
      yield* store.putObject({
        body: new TextEncoder().encode("one"),
        contentType: undefined,
        key: "k",
      });
      return yield* store.head("k");
    }).pipe(Effect.provide(stub.layer));
    expect(await Effect.runPromise(program)).toEqual({ size: 3 });
  });
});

// ---------------------------------------------------------------------------
// makeBlobFetcher (finalize-time ledger/store drift convergence)
// ---------------------------------------------------------------------------

describe("makeBlobFetcher", () => {
  const PROJECT_ID = "proj_1";
  const SHA = "a".repeat(64);

  /** Fetcher backed by the in-memory store stub plus a recording ledger delete. */
  const makeFetcher = () => {
    const stub = makeInMemoryArtifactStore();
    const deletedHashes: Array<{ projectId: string; sha256s: ReadonlyArray<string> }> = [];
    const fetchBlob = makeBlobFetcher({
      deleteStaleBlobRows: (projectId, sha256s) =>
        Effect.sync(() => {
          deletedHashes.push({ projectId, sha256s });
        }),
      getObject: (projectId, sha256) => stub.shape.getObject(blobStorageKey(projectId, sha256)),
    });
    return { deletedHashes, fetchBlob, stub };
  };

  it("returns the stored object without touching the ledger", async () => {
    const { deletedHashes, fetchBlob, stub } = makeFetcher();
    stub.objects.set(blobStorageKey(PROJECT_ID, SHA), {
      body: new TextEncoder().encode("payload"),
      contentType: "text/html",
    });

    const object = await Effect.runPromise(fetchBlob(PROJECT_ID, SHA));

    expect(new TextDecoder().decode(object.body)).toBe("payload");
    expect(deletedHashes).toEqual([]);
  });

  it("deletes the stale ledger row for exactly the missing hash before failing incomplete", async () => {
    const { deletedHashes, fetchBlob } = makeFetcher();

    const result = await Effect.runPromise(Effect.result(fetchBlob(PROJECT_ID, SHA)));

    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(IncompleteDeployError);
    if (failure instanceof IncompleteDeployError) {
      expect(failure.missing).toEqual([SHA]);
    }
    expect(deletedHashes).toEqual([{ projectId: PROJECT_ID, sha256s: [SHA] }]);
  });

  it("propagates store errors as errors without deleting ledger rows", async () => {
    const deletedHashes: Array<ReadonlyArray<string>> = [];
    const fetchBlob = makeBlobFetcher({
      deleteStaleBlobRows: (_projectId, sha256s) =>
        Effect.sync(() => {
          deletedHashes.push(sha256s);
        }),
      getObject: () =>
        Effect.fail(new PaywallArtifactStoreError({ cause: "boom", message: "store down" })),
    });

    const result = await Effect.runPromise(Effect.result(fetchBlob(PROJECT_ID, SHA)));

    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(PaywallArtifactStoreError);
    expect(deletedHashes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Component-only deploy fixture with REAL hashes (verifier recomputes them)
// ---------------------------------------------------------------------------

const FIXTURE_PROJECT_ID = "proj_fixture";
const COMPONENT_SLUG = "product-option";

const encoder = new TextEncoder();

const makeBlob = (content: string) =>
  Effect.gen(function* () {
    const body = encoder.encode(content);
    const sha256 = yield* sha256Hex(body);
    return { body, sha256 };
  });

/**
 * Builds a minimal component-only §1 deploy manifest whose declared sha256s
 * and contentHash are genuinely computed from the fixture blob bodies, plus
 * those bodies — so `makeManifestIntegrityVerifier` (which recomputes every
 * hash) accepts it unless an option intentionally breaks an invariant.
 */
const buildComponentDeployFixture = (options?: {
  readonly panel?: boolean;
  readonly previewState?: string;
  readonly treeState?: string;
  readonly omitPreviews?: boolean;
}) =>
  Effect.gen(function* () {
    const previewState = options?.previewState ?? "default";
    const treeState = options?.treeState ?? previewState;

    const componentManifestJson = {
      actions: {},
      manifestVersion: 2,
      props: {},
    };
    const manifestBlob = yield* makeBlob(JSON.stringify(componentManifestJson));
    const previewBlob = yield* makeBlob(
      JSON.stringify({
        root: { children: [], style: {}, type: "view" },
        state: treeState,
        treeVersion: 1,
      }),
    );
    const runtimeBlob = yield* makeBlob('export const runtime = "unit";');
    const panelBlob = options?.panel ? yield* makeBlob('export const panel = "unit";') : null;

    const contentHash = yield* computeComponentContentHash({
      manifestSha256: manifestBlob.sha256,
      panelSha256: panelBlob?.sha256 ?? null,
      previewSha256s: options?.omitPreviews ? [] : [previewBlob.sha256],
      runtimeSha256: runtimeBlob.sha256,
    });

    const sourceBlob = yield* makeBlob("export default defineComponent();");
    const configBlob = yield* makeBlob("export default {};");

    const manifest = yield* Schema.decodeUnknownEffect(
      PaywallDeployManifestSchema,
      strictParseOptions,
    )({
      assets: [],
      cliVersion: "0.0.1-unit",
      components: [
        {
          artifacts: {
            panel: panelBlob
              ? {
                  bytes: panelBlob.body.byteLength,
                  contentType: "text/javascript; charset=utf-8",
                  path: `.voidhash/.build/components/${COMPONENT_SLUG}/panel.js`,
                  sha256: panelBlob.sha256,
                }
              : null,
            runtime: {
              bytes: runtimeBlob.body.byteLength,
              contentType: "text/javascript; charset=utf-8",
              path: `.voidhash/.build/components/${COMPONENT_SLUG}/runtime.js`,
              sha256: runtimeBlob.sha256,
            },
          },
          contentHash,
          id: COMPONENT_SLUG,
          manifest: {
            bytes: manifestBlob.body.byteLength,
            contentType: "application/json",
            path: `.voidhash/.build/components/${COMPONENT_SLUG}/manifest.json`,
            sha256: manifestBlob.sha256,
          },
          previews: options?.omitPreviews
            ? []
            : [
                {
                  file: {
                    bytes: previewBlob.body.byteLength,
                    contentType: "application/json",
                    path: `.voidhash/.build/components/${COMPONENT_SLUG}/previews/${previewState}.json`,
                    sha256: previewBlob.sha256,
                  },
                  state: previewState,
                },
              ],
          source: {
            bytes: sourceBlob.body.byteLength,
            path: `.voidhash/components/${COMPONENT_SLUG}.tsx`,
            sha256: sourceBlob.sha256,
          },
          title: "Product Option",
        },
      ],
      config: {
        bytes: configBlob.body.byteLength,
        path: "voidhash.config.ts",
        sha256: configBlob.sha256,
      },
      createdAt: "2026-06-11T10:00:00.000Z",
      paywalls: [],
      project: "dev-proj",
      runtimeVersion: "0.0.1-unit",
      schemaVersion: 2,
      team: "voidhash-dev-sro",
    });

    const blobs = [manifestBlob, previewBlob, runtimeBlob, ...(panelBlob ? [panelBlob] : [])];
    return { blobs, componentManifestJson, contentHash, manifest };
  });

/** In-memory store pre-seeded with the fixture blobs at their upload keys. */
const makeSeededHarness = (blobs: ReadonlyArray<{ body: Uint8Array; sha256: string }>) => {
  const stub = makeInMemoryArtifactStore();
  for (const blob of blobs) {
    stub.objects.set(blobStorageKey(FIXTURE_PROJECT_ID, blob.sha256), {
      body: blob.body,
      contentType: null,
    });
  }
  const fetchBlob = makeBlobFetcher({
    deleteStaleBlobRows: () => Effect.void,
    getObject: (projectId, sha256) => stub.shape.getObject(blobStorageKey(projectId, sha256)),
  });
  return { fetchBlob, stub };
};

// ---------------------------------------------------------------------------
// makeManifestIntegrityVerifier (finalize validation, §4.3 "trusts nothing")
// ---------------------------------------------------------------------------

describe("makeManifestIntegrityVerifier", () => {
  it("returns the decoded §2 manifests for a valid component-only deploy", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* buildComponentDeployFixture();
        const { fetchBlob } = makeSeededHarness(fixture.blobs);
        const verify = makeManifestIntegrityVerifier({ fetchBlob });
        return yield* verify(FIXTURE_PROJECT_ID, fixture.manifest);
      }),
    );
    expect([...result.keys()]).toEqual([COMPONENT_SLUG]);
    // v2 dropped the manifest `id`; the map is keyed by the deploy slug and the
    // decoded value is the id-less §2 manifest.
    expect(result.get(COMPONENT_SLUG)?.manifestVersion).toBe(2);
  });

  it("rejects a preview tree whose state does not match its manifest entry", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const fixture = yield* buildComponentDeployFixture({ treeState: "trial" });
          const { fetchBlob } = makeSeededHarness(fixture.blobs);
          const verify = makeManifestIntegrityVerifier({ fetchBlob });
          return yield* verify(FIXTURE_PROJECT_ID, fixture.manifest);
        }),
      ),
    );
    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(PaywallDeployValidationError);
    if (failure instanceof PaywallDeployValidationError) {
      expect(failure.message).toContain('preview tree state "trial"');
      expect(failure.message).toContain('does not match the manifest state "default"');
    }
  });

  it("rejects a component with no previews", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const fixture = yield* buildComponentDeployFixture({ omitPreviews: true });
          const { fetchBlob } = makeSeededHarness(fixture.blobs);
          const verify = makeManifestIntegrityVerifier({ fetchBlob });
          return yield* verify(FIXTURE_PROJECT_ID, fixture.manifest);
        }),
      ),
    );
    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(PaywallDeployValidationError);
    if (failure instanceof PaywallDeployValidationError) {
      expect(failure.violations.some((v) => v.includes("previews must not be empty"))).toBe(true);
    }
  });

  it("rejects preview state names containing a path separator", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const fixture = yield* buildComponentDeployFixture({ previewState: "de/fault" });
          const { fetchBlob } = makeSeededHarness(fixture.blobs);
          const verify = makeManifestIntegrityVerifier({ fetchBlob });
          return yield* verify(FIXTURE_PROJECT_ID, fixture.manifest);
        }),
      ),
    );
    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(PaywallDeployValidationError);
    if (failure instanceof PaywallDeployValidationError) {
      expect(failure.violations.some((v) => v.includes('state "de/fault" is malformed'))).toBe(
        true,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Catalog-read degradation (listComponents / getComponentVersions)
// ---------------------------------------------------------------------------

describe("catalog reads degrade per row on manifest drift", () => {
  const PUBLIC_BASE_URL = "https://assets.example";

  it("skips an undecodable stored manifest row and keeps decoding the healthy ones", async () => {
    const decoded = await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* buildComponentDeployFixture();
        return yield* decodeStoredDeployManifestRows([
          { id: "dep_good", manifest: fixture.manifest },
          { id: "dep_drifted", manifest: { schemaVersion: 99, unexpected: true } },
        ]);
      }),
    );
    expect([...decoded.keys()]).toEqual(["dep_good"]);
    expect(decoded.get("dep_good")?.components[0]?.id).toBe(COMPONENT_SLUG);
  });

  it("resolves the detail for a healthy version row and omits drifted ones", async () => {
    const { details, fixture } = await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* buildComponentDeployFixture({ panel: true });
        const deployManifests = yield* decodeStoredDeployManifestRows([
          { id: "dep_good", manifest: fixture.manifest },
          { id: "dep_drifted", manifest: { schemaVersion: 99 } },
        ]);
        const buildVersionDetail = makeComponentVersionDetailBuilder({
          publicBaseUrl: PUBLIC_BASE_URL,
        });
        const rowBase = {
          createdAt: new Date("2026-06-11T10:00:00.000Z"),
          manifest: fixture.componentManifestJson,
        };
        const healthy = yield* buildVersionDetail({
          deployManifests,
          row: { ...rowBase, contentHash: fixture.contentHash, deployId: "dep_good", version: 2 },
          slug: COMPONENT_SLUG,
        });
        // Minting deploy's manifest row no longer decodes (skipped above).
        const driftedManifest = yield* buildVersionDetail({
          deployManifests,
          row: {
            ...rowBase,
            contentHash: fixture.contentHash,
            deployId: "dep_drifted",
            version: 1,
          },
          slug: COMPONENT_SLUG,
        });
        // Manifest decodes, but carries no components[] entry for the hash.
        const driftedHash = yield* buildVersionDetail({
          deployManifests,
          row: { ...rowBase, contentHash: "f".repeat(64), deployId: "dep_good", version: 3 },
          slug: COMPONENT_SLUG,
        });
        return { details: { driftedHash, driftedManifest, healthy }, fixture };
      }),
    );
    expect(details.healthy).toMatchObject({
      artifactBaseUrl: `${PUBLIC_BASE_URL}/c/${fixture.contentHash}`,
      contentHash: fixture.contentHash,
      hasPanel: true,
      previewStates: ["default"],
      slug: COMPONENT_SLUG,
      version: 2,
    });
    expect(details.driftedManifest).toBeNull();
    expect(details.driftedHash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// makeServingLayoutCopier (§5.1 component copies)
// ---------------------------------------------------------------------------

describe("makeServingLayoutCopier", () => {
  it("copies component artifacts under c/<contentHash>/ without panel.js when none is declared", async () => {
    const { keys, manifestObject } = await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* buildComponentDeployFixture();
        const { fetchBlob, stub } = makeSeededHarness(fixture.blobs);
        const copy = makeServingLayoutCopier({ fetchBlob, putObject: stub.shape.putObject });
        yield* copy(FIXTURE_PROJECT_ID, servingCopiesForComponent(fixture.manifest.components[0]!));
        return {
          keys: [...stub.objects.keys()].filter((key) => key.startsWith("c/")),
          manifestObject: stub.objects.get(`c/${fixture.contentHash}/manifest.json`),
        };
      }),
    );
    expect(keys.map((key) => key.slice(key.indexOf("/", 2) + 1)).sort()).toEqual([
      "manifest.json",
      "previews/default.json",
      "runtime.js",
    ]);
    expect(manifestObject?.contentType).toBe("application/json");
  });

  it("copies panel.js when declared and re-copies idempotently (re-finalize no-op path)", async () => {
    const { firstPass, secondPass } = await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* buildComponentDeployFixture({ panel: true });
        const { fetchBlob, stub } = makeSeededHarness(fixture.blobs);
        const copy = makeServingLayoutCopier({ fetchBlob, putObject: stub.shape.putObject });
        const copies = servingCopiesForComponent(fixture.manifest.components[0]!);
        yield* copy(FIXTURE_PROJECT_ID, copies);
        const firstPass = new Map(stub.objects);
        yield* copy(FIXTURE_PROJECT_ID, copies);
        return { firstPass, secondPass: stub.objects };
      }),
    );
    expect([...firstPass.keys()].some((key) => key.endsWith("/panel.js"))).toBe(true);
    expect([...secondPass.keys()].sort()).toEqual([...firstPass.keys()].sort());
  });

  it("fails with IncompleteDeployError when a referenced blob is missing", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const fixture = yield* buildComponentDeployFixture();
          const runtimeSha = fixture.manifest.components[0]!.artifacts.runtime.sha256;
          const { fetchBlob, stub } = makeSeededHarness(
            fixture.blobs.filter((blob) => blob.sha256 !== runtimeSha),
          );
          const copy = makeServingLayoutCopier({ fetchBlob, putObject: stub.shape.putObject });
          yield* copy(
            FIXTURE_PROJECT_ID,
            servingCopiesForComponent(fixture.manifest.components[0]!),
          );
          return runtimeSha;
        }),
      ),
    );
    const failure = Result.isFailure(result) ? result.failure : null;
    expect(failure).toBeInstanceOf(IncompleteDeployError);
  });
});
