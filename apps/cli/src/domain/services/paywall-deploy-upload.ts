/**
 * The deploy upload flow (contract §4): create the deploy from the manifest,
 * upload whatever blobs the server is missing, then finalize. Transport
 * follows the CLI's API conventions — `api_url` base + `x-api-key` header from
 * the user's CLI config.
 */
import { promises as fsp } from "node:fs";
import { join } from "node:path";

import { Data, Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/unstable/http";

import type { DeployManifest } from "../schema/paywall-deploy";
import { CliConfig } from "./cli-config";

export class PaywallDeployUploadError extends Data.TaggedError("PaywallDeployUploadError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** `POST /api/v1/paywall-deploys` response (contract §4.1). */
const CreateDeployResponseSchema = Schema.Struct({
  deployId: Schema.String,
  /** Manifest file hashes the server does not already have for this project. */
  missing: Schema.Array(Schema.String),
});
export type CreateDeployResponse = typeof CreateDeployResponseSchema.Type;

const FinalizedPaywallSchema = Schema.Struct({
  id: Schema.String,
  paywallId: Schema.String,
  releaseId: Schema.String,
  version: Schema.Number,
  contentHash: Schema.String,
  url: Schema.String,
});
export type FinalizedPaywall = typeof FinalizedPaywallSchema.Type;

const FinalizedComponentSchema = Schema.Struct({
  id: Schema.String,
  componentId: Schema.String,
  version: Schema.Number,
  contentHash: Schema.String,
});
export type FinalizedComponent = typeof FinalizedComponentSchema.Type;

/** `POST /api/v1/paywall-deploys/:deployId/finalize` response (contract §4.3). */
const FinalizeResponseSchema = Schema.Struct({
  deployId: Schema.String,
  status: Schema.String,
  paywalls: Schema.Array(FinalizedPaywallSchema),
  components: Schema.Array(FinalizedComponentSchema),
});
export type FinalizeResponse = typeof FinalizeResponseSchema.Type;

/**
 * Maps every file hash in the manifest to its project-root-relative path —
 * the lookup used to satisfy the server's `missing` list.
 */
export const collectManifestFiles = (manifest: DeployManifest): Map<string, string> => {
  const files = new Map<string, string>();
  const add = (file: { readonly path: string; readonly sha256: string } | null): void => {
    if (file) {
      files.set(file.sha256, file.path);
    }
  };
  for (const paywall of manifest.paywalls) {
    add(paywall.source);
    add(paywall.artifacts.html);
    add(paywall.artifacts.js);
  }
  for (const component of manifest.components) {
    add(component.source);
    add(component.manifest);
    for (const preview of component.previews) {
      add(preview.file);
    }
    add(component.artifacts.runtime);
    add(component.artifacts.panel);
  }
  add(manifest.config);
  for (const asset of manifest.assets) {
    add(asset);
  }
  return files;
};

const tryParseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return;
  }
};

/**
 * Extracts the `missing` hash list from a finalize `409` body (contract §4.3:
 * `409 { missing: [...] }`). Returns `undefined` when the body carries no
 * such list — callers then fall back to the generic failure path.
 */
const readMissingHashes = (body: string): string[] | undefined => {
  const parsed = tryParseJson(body);
  if (typeof parsed !== "object" || parsed === null || !("missing" in parsed)) {
    return;
  }
  const missing = parsed.missing;
  if (
    !Array.isArray(missing) ||
    missing.length === 0 ||
    !missing.every((hash): hash is string => typeof hash === "string")
  ) {
    return;
  }
  return missing;
};

/** Renders a non-2xx response into an actionable message (esp. 422 details). */
const describeHttpFailure = (step: string, status: number, body: string): string => {
  const parsed = tryParseJson(body);
  const details = parsed !== undefined ? JSON.stringify(parsed, null, 2) : body.trim();
  const hint =
    status === 400
      ? " The server rejected the manifest — your CLI may be outdated; try upgrading voidhash-cli."
      : status === 401
        ? " Authentication failed. Run 'voidhash-cli auth login' and retry."
        : status === 403
          ? " Check that the team/project in voidhash.config.ts match a project you have access to."
          : status === 409
            ? " The deploy is incomplete (blobs missing server-side). Re-run deploy to retry."
            : status === 422
              ? " The server rejected the deploy contents:"
              : "";
  return `${step} failed with status ${status}.${hint}${details ? `\n${details}` : ""}`;
};

const failHttp = (
  step: string,
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<never, PaywallDeployUploadError> =>
  response.text.pipe(
    Effect.orElseSucceed(() => ""),
    Effect.flatMap((body) =>
      Effect.fail(
        new PaywallDeployUploadError({
          message: describeHttpFailure(step, response.status, body),
        }),
      ),
    ),
  );

const networkFailure = (step: string) => (cause: unknown) =>
  new PaywallDeployUploadError({
    cause,
    message: `${step} failed: could not reach the Voidhash API.`,
  });

const decodeJson = <S extends Schema.Top>(
  step: string,
  schema: S,
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<S["Type"], PaywallDeployUploadError, S["DecodingServices"]> =>
  response.json.pipe(
    Effect.mapError(networkFailure(step)),
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError(
          (cause) =>
            new PaywallDeployUploadError({
              cause,
              message: `${step} returned an unexpected response shape: ${cause.message}`,
            }),
        ),
      ),
    ),
  );

export interface UploadPaywallDeployOptions {
  readonly manifest: DeployManifest;
  /** Absolute project root the manifest's relative paths resolve against. */
  readonly projectRoot: string;
  /** Progress callback, e.g. `Console.log`. */
  readonly onProgress?: (message: string) => Effect.Effect<void>;
}

export interface UploadPaywallDeployResult {
  readonly deployId: string;
  readonly finalize: FinalizeResponse;
  /** Blobs actually uploaded this run. */
  readonly uploadedCount: number;
  /** Manifest files the server already had. */
  readonly cachedCount: number;
}

/**
 * Runs the full contract-§4 deploy flow against the configured Voidhash API:
 *
 * 1. `POST /api/v1/paywall-deploys` with the manifest → `{ deployId, missing }`
 * 2. `PUT  /api/v1/paywall-deploys/:deployId/blobs/:sha256` for each missing blob
 * 3. `POST /api/v1/paywall-deploys/:deployId/finalize` → released versions/URLs
 *
 * Requires a logged-in CLI (an `x-api-key` credential in the CLI config).
 */
export const uploadPaywallDeploy = ({
  manifest,
  projectRoot,
  onProgress,
}: UploadPaywallDeployOptions): Effect.Effect<
  UploadPaywallDeployResult,
  PaywallDeployUploadError,
  HttpClient.HttpClient | CliConfig
> =>
  Effect.gen(function* uploadPaywallDeploy() {
    const httpClient = yield* HttpClient.HttpClient;
    const cliConfig = yield* CliConfig;

    const config = yield* cliConfig.readConfig().pipe(
      Effect.mapError(
        (cause) =>
          new PaywallDeployUploadError({
            cause,
            message: "Failed to read the CLI config.",
          }),
      ),
    );
    if (!config.api_key) {
      return yield* Effect.fail(
        new PaywallDeployUploadError({
          message: "You must be logged in to deploy. Run 'voidhash-cli auth login' first.",
        }),
      );
    }
    const apiKey = config.api_key;

    const send = (
      step: string,
      request: HttpClientRequest.HttpClientRequest,
    ): Effect.Effect<HttpClientResponse.HttpClientResponse, PaywallDeployUploadError> =>
      httpClient
        .execute(
          request.pipe(
            HttpClientRequest.prependUrl(config.api_url),
            HttpClientRequest.setHeaders({ "x-api-key": apiKey }),
          ),
        )
        .pipe(Effect.mapError(networkFailure(step)));

    const report = (message: string): Effect.Effect<void> =>
      onProgress ? onProgress(message) : Effect.void;

    // 1. Create the deploy from the manifest.
    const createStep = "Creating the deploy";
    const createResponse = yield* send(
      createStep,
      HttpClientRequest.post("/api/v1/paywall-deploys").pipe(
        HttpClientRequest.bodyJsonUnsafe(manifest),
      ),
    );
    if (createResponse.status < 200 || createResponse.status >= 300) {
      return yield* failHttp(createStep, createResponse);
    }
    const created = yield* decodeJson(createStep, CreateDeployResponseSchema, createResponse);

    // 2. Upload every blob the server is missing.
    const filesByHash = collectManifestFiles(manifest);

    const uploadBlob = (sha256: string): Effect.Effect<void, PaywallDeployUploadError> =>
      Effect.gen(function* uploadBlob() {
        const relPath = filesByHash.get(sha256);
        if (relPath === undefined) {
          return yield* Effect.fail(
            new PaywallDeployUploadError({
              message:
                `The server requested blob ${sha256}, which is not part of the ` +
                "manifest. Re-run the build and deploy again.",
            }),
          );
        }
        const bytes = yield* Effect.tryPromise({
          try: () => fsp.readFile(join(projectRoot, relPath)),
          catch: (cause) =>
            new PaywallDeployUploadError({
              cause,
              message: `Failed to read ${relPath} for upload.`,
            }),
        });
        const uploadStep = `Uploading ${relPath}`;
        const uploadResponse = yield* send(
          uploadStep,
          HttpClientRequest.put(`/api/v1/paywall-deploys/${created.deployId}/blobs/${sha256}`).pipe(
            HttpClientRequest.bodyUint8Array(bytes, "application/octet-stream"),
          ),
        );
        if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
          return yield* failHttp(uploadStep, uploadResponse);
        }
      });

    yield* report(
      `Uploading ${created.missing.length} blob(s) ` +
        `(${filesByHash.size - created.missing.length} already on the server)…`,
    );

    for (const sha256 of created.missing) {
      yield* uploadBlob(sha256);
    }

    // 3. Finalize — the immutable commit point. A 409 with a `missing` list
    // (e.g. a blob lost server-side between create and finalize) is retried
    // ONCE after re-uploading exactly those blobs; a second failure surfaces
    // the server's readable error, hashes included.
    const finalizeStep = "Finalizing the deploy";
    const requestFinalize = (): Effect.Effect<
      HttpClientResponse.HttpClientResponse,
      PaywallDeployUploadError
    > =>
      send(
        finalizeStep,
        HttpClientRequest.post(`/api/v1/paywall-deploys/${created.deployId}/finalize`),
      );

    let finalizeResponse = yield* requestFinalize();
    let retriedUploadCount = 0;

    if (finalizeResponse.status === 409) {
      const body = yield* finalizeResponse.text.pipe(Effect.orElseSucceed(() => ""));
      const missingOnFinalize = readMissingHashes(body);
      if (
        missingOnFinalize === undefined ||
        missingOnFinalize.some((sha256) => !filesByHash.has(sha256))
      ) {
        return yield* Effect.fail(
          new PaywallDeployUploadError({
            message: describeHttpFailure(finalizeStep, 409, body),
          }),
        );
      }

      yield* report(
        `Finalize reported ${missingOnFinalize.length} missing blob(s); ` +
          "re-uploading and retrying once…",
      );
      for (const sha256 of missingOnFinalize) {
        yield* uploadBlob(sha256);
        retriedUploadCount += 1;
      }
      finalizeResponse = yield* requestFinalize();
    }

    if (finalizeResponse.status < 200 || finalizeResponse.status >= 300) {
      return yield* failHttp(finalizeStep, finalizeResponse);
    }
    const finalize = yield* decodeJson(finalizeStep, FinalizeResponseSchema, finalizeResponse);

    return {
      cachedCount: filesByHash.size - created.missing.length,
      deployId: created.deployId,
      finalize,
      uploadedCount: created.missing.length + retriedUploadCount,
    };
  });
