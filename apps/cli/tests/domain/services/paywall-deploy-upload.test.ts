import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

let projectRoot: string;
let manifest: DeployManifest;

const sha256Hex = (data: string): string =>
  createHash("sha256").update(data).digest("hex");

const FILES = {
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
} as const;

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
          new Response(JSON.stringify(body), {
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

const runUpload = (
  client: HttpClient.HttpClient,
): Promise<UploadPaywallDeployResult> =>
  Effect.runPromise(
    uploadPaywallDeploy({ manifest, projectRoot }).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(CliConfig, cliConfigStub),
    ),
  );

const runUploadError = (
  client: HttpClient.HttpClient,
): Promise<PaywallDeployUploadError> =>
  Effect.runPromise(
    uploadPaywallDeploy({ manifest, projectRoot }).pipe(
      Effect.flip,
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(CliConfig, cliConfigStub),
    ),
  );

const readyFinalizeBody = {
  components: [],
  deployId: "pw_dep_test",
  paywalls: [],
  status: "ready",
};

beforeAll(async () => {
  projectRoot = await fsp.mkdtemp(join(tmpdir(), "voidhash-deploy-upload-"));
  for (const file of Object.values(FILES)) {
    const abs = join(projectRoot, file.path);
    await fsp.mkdir(join(abs, ".."), { recursive: true });
    await fsp.writeFile(abs, file.contents);
  }
  manifest = buildManifest();
});

afterAll(async () => {
  await fsp.rm(projectRoot, { force: true, recursive: true });
});

describe("uploadPaywallDeploy finalize-409 retry", () => {
  it("uploads the 409 missing blobs and retries finalize once", async () => {
    const requests: RecordedRequest[] = [];
    const result = await runUpload(
      makeStubClient({
        createMissing: [hashOf(FILES.js)],
        finalizeResponses: [
          { body: { missing: [hashOf(FILES.html)] }, status: 409 },
          { body: readyFinalizeBody, status: 200 },
        ],
        requests,
      }),
    );

    expect(result.finalize.status).toBe("ready");
    // One blob from create's missing list + one re-uploaded after the 409.
    expect(result.uploadedCount).toBe(2);
    const puts = requests.filter((r) => r.method === "PUT");
    expect(puts.map((r) => r.path)).toEqual([
      `/api/v1/paywall-deploys/pw_dep_test/blobs/${hashOf(FILES.js)}`,
      `/api/v1/paywall-deploys/pw_dep_test/blobs/${hashOf(FILES.html)}`,
    ]);
    expect(
      requests.filter((r) => r.path.endsWith("/finalize")),
    ).toHaveLength(2);
  });

  it("retries at most once and fails readably when finalize stays 409", async () => {
    const requests: RecordedRequest[] = [];
    const error = await runUploadError(
      makeStubClient({
        createMissing: [],
        finalizeResponses: [
          { body: { missing: [hashOf(FILES.html)] }, status: 409 },
          { body: { missing: [hashOf(FILES.html)] }, status: 409 },
        ],
        requests,
      }),
    );

    expect(error._tag).toBe("PaywallDeployUploadError");
    expect(error.message).toContain("Finalizing the deploy failed");
    expect(error.message).toContain(hashOf(FILES.html));
    expect(
      requests.filter((r) => r.path.endsWith("/finalize")),
    ).toHaveLength(2);
  });

  it("fails without retrying when the 409 carries no usable missing list", async () => {
    const requests: RecordedRequest[] = [];
    const error = await runUploadError(
      makeStubClient({
        createMissing: [],
        finalizeResponses: [{ body: { error: "incomplete" }, status: 409 }],
        requests,
      }),
    );

    expect(error._tag).toBe("PaywallDeployUploadError");
    expect(
      requests.filter((r) => r.path.endsWith("/finalize")),
    ).toHaveLength(1);
    expect(requests.filter((r) => r.method === "PUT")).toHaveLength(0);
  });

  it("fails without retrying when a 409 hash is not part of the manifest", async () => {
    const requests: RecordedRequest[] = [];
    const error = await runUploadError(
      makeStubClient({
        createMissing: [],
        finalizeResponses: [
          { body: { missing: ["f".repeat(64)] }, status: 409 },
        ],
        requests,
      }),
    );

    expect(error._tag).toBe("PaywallDeployUploadError");
    expect(error.message).toContain("f".repeat(64));
    expect(
      requests.filter((r) => r.path.endsWith("/finalize")),
    ).toHaveLength(1);
  });
});
