import { createHash } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { constant } from "@voidhash/lib/lang";
import { Effect, FileSystem, Path, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

import {
  type DeployManifest,
  DeployManifestSchema,
} from "../../../src/domain/schema/paywall-deploy";
import { CliConfig } from "../../../src/domain/services/cli-config";
import {
  type PaywallDeployUploadError,
  type UploadPaywallDeployResult,
  uploadPaywallDeploy,
} from "../../../src/domain/services/paywall-deploy-upload";

const sha256Hex = (data: string): string => createHash("sha256").update(data).digest("hex");

/** Serializes a stub response body exactly as the server would. */
const jsonBody = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

const FILES = constant({
  config: { contents: "export default {};\n", path: "voidhash.config.ts" },
  html: {
    contents: "<!doctype html>\n",
    path: ".voidhash/.build/paywalls/onboarding/index.html",
  },
  js: {
    contents: "console.log('paywall');\n",
    path: ".voidhash/.build/paywalls/onboarding/bundle.js",
  },
  source: {
    contents: "export default null;\n",
    path: ".voidhash/paywalls/onboarding.tsx",
  },
});

const hashOf = (file: { contents: string }): string => sha256Hex(file.contents);

const fileEntry = (file: { contents: string; path: string }) => ({
  bytes: file.contents.length,
  path: file.path,
  sha256: hashOf(file),
});

const buildManifest = (): DeployManifest =>
  Schema.decodeUnknownSync(DeployManifestSchema)({
    assets: [],
    cliVersion: "0.0.1",
    components: [],
    config: fileEntry(FILES.config),
    createdAt: "2026-06-11T10:00:00.000Z",
    paywalls: [
      {
        artifacts: {
          html: {
            ...fileEntry(FILES.html),
            contentType: "text/html; charset=utf-8",
          },
          js: {
            ...fileEntry(FILES.js),
            contentType: "text/javascript; charset=utf-8",
          },
        },
        assets: [],
        contentHash: "0".repeat(64),
        id: "onboarding",
        products: [],
        source: fileEntry(FILES.source),
        title: "Onboarding",
        variables: {},
      },
    ],
    project: "dev-proj",
    runtimeVersion: "0.0.1",
    schemaVersion: 2,
    team: "voidhash-dev-sro",
  });

const manifest: DeployManifest = buildManifest();

interface RecordedRequest {
  readonly method: string;
  readonly path: string;
}

/** Scripted HTTP stub: routes requests, records calls, counts finalizes. */
const makeStubClient = (options: {
  /** `missing` returned by create-deploy. */
  createMissing: ReadonlyArray<string>;
  /** Per-attempt finalize responses (status + JSON body), consumed in order. */
  finalizeResponses: ReadonlyArray<{ status: number; body: unknown }>;
  requests: RecordedRequest[];
}): HttpClient.HttpClient =>
  HttpClient.make((request) => {
    const path = new URL(request.url).pathname;
    options.requests.push({ method: request.method, path });

    const respond = (status: number, body: unknown) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(jsonBody(body), {
            headers: { "content-type": "application/json" },
            status,
          }),
        ),
      );

    if (request.method === "POST" && path === "/api/v1/paywall-deploys") {
      return respond(201, {
        deployId: "pw_dep_test",
        missing: options.createMissing,
      });
    }
    if (request.method === "PUT" && path.includes("/blobs/")) {
      return respond(200, {});
    }
    if (request.method === "POST" && path.endsWith("/finalize")) {
      const attempt = options.requests.filter(
        (r) => r.method === "POST" && r.path.endsWith("/finalize"),
      ).length;
      const scripted =
        options.finalizeResponses[attempt - 1] ??
        options.finalizeResponses[options.finalizeResponses.length - 1];
      return respond(scripted?.status ?? 500, scripted?.body ?? {});
    }
    return respond(404, {});
  });

const cliConfigStub: typeof CliConfig.Service = {
  readConfig: () =>
    Effect.succeed({
      api_key: "vh_sk_test",
      api_url: "https://api.voidhash.test",
      web_url: "https://voidhash.test",
    }),
  resetConfig: () => Effect.void,
  writeToConfig: () => Effect.void,
};

/**
 * Runs `use` against a fresh temporary project holding the manifest's files,
 * removed again once the test finishes — the fixture lifecycle
 * `beforeAll`/`afterAll` used to own.
 */
const withProjectRoot = <A, E>(
  use: (projectRoot: string) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
): Promise<A> =>
  Effect.gen(function* withProjectRoot() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const projectRoot = yield* fs
      .makeTempDirectory({ prefix: "voidhash-deploy-upload-" })
      .pipe(Effect.orDie);

    return yield* Effect.gen(function* runFixture() {
      for (const file of Object.values(FILES)) {
        const abs = path.join(projectRoot, file.path);
        yield* fs.makeDirectory(path.dirname(abs), { recursive: true }).pipe(Effect.orDie);
        yield* fs.writeFileString(abs, file.contents).pipe(Effect.orDie);
      }
      return yield* use(projectRoot);
    }).pipe(
      Effect.ensuring(fs.remove(projectRoot, { force: true, recursive: true }).pipe(Effect.orDie)),
    );
  }).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const runUpload = (
  client: HttpClient.HttpClient,
  projectRoot: string,
): Effect.Effect<UploadPaywallDeployResult, never, FileSystem.FileSystem | Path.Path> =>
  uploadPaywallDeploy({ manifest, projectRoot }).pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(CliConfig, cliConfigStub),
    Effect.orDie,
  );

const runUploadError = (
  client: HttpClient.HttpClient,
  projectRoot: string,
): Effect.Effect<PaywallDeployUploadError, never, FileSystem.FileSystem | Path.Path> =>
  uploadPaywallDeploy({ manifest, projectRoot }).pipe(
    Effect.flip,
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(CliConfig, cliConfigStub),
    Effect.orDie,
  );

const readyFinalizeBody = {
  components: [],
  deployId: "pw_dep_test",
  paywalls: [],
  status: "ready",
};

describe("uploadPaywallDeploy finalize-409 retry", () => {
  it("uploads the 409 missing blobs and retries finalize once", () =>
    withProjectRoot((projectRoot) =>
      Effect.gen(function* retriesFinalizeOnce() {
        const requests: RecordedRequest[] = [];
        const result = yield* runUpload(
          makeStubClient({
            createMissing: [hashOf(FILES.js)],
            finalizeResponses: [
              { body: { missing: [hashOf(FILES.html)] }, status: 409 },
              { body: readyFinalizeBody, status: 200 },
            ],
            requests,
          }),
          projectRoot,
        );

        expect(result.finalize.status).toBe("ready");
        // One blob from create's missing list + one re-uploaded after the 409.
        expect(result.uploadedCount).toBe(2);
        const puts = requests.filter((r) => r.method === "PUT");
        expect(puts.map((r) => r.path)).toEqual([
          `/api/v1/paywall-deploys/pw_dep_test/blobs/${hashOf(FILES.js)}`,
          `/api/v1/paywall-deploys/pw_dep_test/blobs/${hashOf(FILES.html)}`,
        ]);
        expect(requests.filter((r) => r.path.endsWith("/finalize"))).toHaveLength(2);
      }),
    ));

  it("retries at most once and fails readably when finalize stays 409", () =>
    withProjectRoot((projectRoot) =>
      Effect.gen(function* failsAfterOneRetry() {
        const requests: RecordedRequest[] = [];
        const error = yield* runUploadError(
          makeStubClient({
            createMissing: [],
            finalizeResponses: [
              { body: { missing: [hashOf(FILES.html)] }, status: 409 },
              { body: { missing: [hashOf(FILES.html)] }, status: 409 },
            ],
            requests,
          }),
          projectRoot,
        );

        expect(error._tag).toBe("PaywallDeployUploadError");
        expect(error.message).toContain("Finalizing the deploy failed");
        expect(error.message).toContain(hashOf(FILES.html));
        expect(requests.filter((r) => r.path.endsWith("/finalize"))).toHaveLength(2);
      }),
    ));

  it("fails without retrying when the 409 carries no usable missing list", () =>
    withProjectRoot((projectRoot) =>
      Effect.gen(function* failsWithoutUsableMissingList() {
        const requests: RecordedRequest[] = [];
        const error = yield* runUploadError(
          makeStubClient({
            createMissing: [],
            finalizeResponses: [{ body: { error: "incomplete" }, status: 409 }],
            requests,
          }),
          projectRoot,
        );

        expect(error._tag).toBe("PaywallDeployUploadError");
        expect(requests.filter((r) => r.path.endsWith("/finalize"))).toHaveLength(1);
        expect(requests.filter((r) => r.method === "PUT")).toHaveLength(0);
      }),
    ));

  it("fails without retrying when a 409 hash is not part of the manifest", () =>
    withProjectRoot((projectRoot) =>
      Effect.gen(function* failsOnForeignHash() {
        const requests: RecordedRequest[] = [];
        const error = yield* runUploadError(
          makeStubClient({
            createMissing: [],
            finalizeResponses: [{ body: { missing: ["f".repeat(64)] }, status: 409 }],
            requests,
          }),
          projectRoot,
        );

        expect(error._tag).toBe("PaywallDeployUploadError");
        expect(error.message).toContain("f".repeat(64));
        expect(requests.filter((r) => r.path.endsWith("/finalize"))).toHaveLength(1);
      }),
    ));
});
