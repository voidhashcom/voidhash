import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import { make as makeCoreClient, type VoidhashCoreClient } from "@voidhash/generated-clients";
import {
  make as makeIngestClient,
  type VoidhashEventCaptureClient,
} from "@voidhash/generated-clients/event-capture";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { VoidhashNodeConfigurationError } from "../errors";
import { groupCoreClient, type GroupedVoidhashNodeEffectClient } from "../generated/grouped-client";
import type { VoidhashNodeClientOptions } from "../types";

type EffectError<TEffect> =
  TEffect extends Effect.Effect<infer _Success, infer Error, infer _Requirements> ? Error : never;

/**
 * Why a project-scoped call could not learn its project: the session lookup
 * failed, or the credential can use zero or several projects.
 */
export type ProjectResolutionError =
  | EffectError<ReturnType<VoidhashCoreClient["sessionGet"]>>
  | VoidhashNodeConfigurationError;

export type GeneratedVoidhashNodeEffectClient =
  GroupedVoidhashNodeEffectClient<ProjectResolutionError>;

/** The generated clients the public namespaces are layered on top of. */
export type GeneratedVoidhashNodeClients = {
  readonly core: GeneratedVoidhashNodeEffectClient;
  readonly eventCapture: VoidhashEventCaptureClient;
};

export const DEFAULT_BASE_URL = "https://api.voidhash.com";

export const DEFAULT_INGEST_URL = "https://ingest.voidhash.com";

/** The management API authenticates with `Authorization: Bearer <secret key>`. */
const AUTHORIZATION_HEADER = "authorization";

/** Event capture still authenticates with the secret key in its own header. */
const SECRET_KEY_HEADER = "x-secret-key";

const CREDENTIAL_HEADERS = [AUTHORIZATION_HEADER, SECRET_KEY_HEADER];

const credentialHeaderIn = (headers?: Record<string, string>) =>
  R.keys(headers ?? {}).find((headerName) => CREDENTIAL_HEADERS.includes(headerName.toLowerCase()));

const resolveUrl = (
  optionName: string,
  url: Option.Option<string>,
  fallback: string,
): Effect.Effect<string, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolved = yield* Effect.try({
      try: () => new URL(Option.getOrElse(url, () => fallback)),
      catch: (cause) =>
        new VoidhashNodeConfigurationError(`${optionName} must be a valid URL.`, {
          cause,
        }),
    });

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError(`${optionName} must use the http or https protocol.`),
      );
    }

    return resolved.toString();
  });

const resolveOptions = (options: VoidhashNodeClientOptions) =>
  Effect.gen(function* () {
    if (!options.secretKey.trim()) {
      return yield* Effect.fail(new VoidhashNodeConfigurationError("secretKey is required."));
    }

    if (options.projectId !== undefined && !options.projectId.trim()) {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("projectId must not be blank when it is set."),
      );
    }

    if (!P.isFunction(globalThis.fetch)) {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("globalThis.fetch must be available."),
      );
    }

    const credentialHeader = credentialHeaderIn(options.headers);
    if (credentialHeader !== undefined) {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError(
          `headers.${credentialHeader} cannot be set explicitly; the SDK sends secretKey for you.`,
        ),
      );
    }

    return {
      baseUrl: yield* resolveUrl(
        "baseUrl",
        Option.fromNullishOr(options.baseUrl),
        DEFAULT_BASE_URL,
      ),
      headers: options.headers ?? {},
      ingestUrl: yield* resolveUrl(
        "ingestUrl",
        Option.fromNullishOr(options.ingestUrl),
        DEFAULT_INGEST_URL,
      ),
      projectId: Option.fromNullishOr(options.projectId),
      secretKey: options.secretKey,
    };
  });

/**
 * The project a secret key belongs to, read from the session. A project
 * secret key can use exactly one project; any other count means the
 * credential cannot pick one, so the caller has to.
 */
const projectOfSession = (core: VoidhashCoreClient) =>
  Effect.flatMap(core.sessionGet(), (session) => {
    const [project, ...others] = session.projects;
    if (project !== undefined && Arr.isReadonlyArrayEmpty(others)) {
      return Effect.succeed(project.id);
    }

    return Effect.fail(
      new VoidhashNodeConfigurationError(
        `This key can use ${session.projects.length} projects, so the SDK cannot choose one. Set projectId when creating the client.`,
      ),
    );
  });

export const makeGeneratedClients = (
  options: VoidhashNodeClientOptions,
): Effect.Effect<GeneratedVoidhashNodeClients, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolvedOptions = yield* resolveOptions(options);
    const httpClient = yield* HttpClient.HttpClient;
    const transformClient =
      (baseUrl: string, credentialHeader: string, credential: string) =>
      (httpClient: HttpClient.HttpClient) =>
        Effect.succeed(
          httpClient.pipe(
            HttpClient.mapRequest((request) =>
              HttpClientRequest.setHeader(
                HttpClientRequest.setHeaders(
                  HttpClientRequest.prependUrl(request, baseUrl),
                  resolvedOptions.headers,
                ),
                credentialHeader,
                credential,
              ),
            ),
          ),
        );

    const core = makeCoreClient(httpClient, {
      transformClient: transformClient(
        resolvedOptions.baseUrl,
        AUTHORIZATION_HEADER,
        `Bearer ${resolvedOptions.secretKey}`,
      ),
    });

    // Resolved on the first project-scoped call, never at construction.
    // Concurrent first calls share one lookup; a failed lookup is not kept,
    // so the next call tries again.
    const projectId: Effect.Effect<string, ProjectResolutionError> = yield* Option.match(
      resolvedOptions.projectId,
      {
        onNone: () =>
          Effect.cachedWithTTL(projectOfSession(core), (exit) =>
            Exit.isSuccess(exit) ? Duration.infinity : Duration.zero,
          ),
        onSome: (configured) => Effect.succeed(Effect.succeed(configured)),
      },
    );

    return {
      core: groupCoreClient(core, projectId),
      eventCapture: makeIngestClient(httpClient, {
        transformClient: transformClient(
          resolvedOptions.ingestUrl,
          SECRET_KEY_HEADER,
          resolvedOptions.secretKey,
        ),
      }),
    };
  }).pipe(Effect.provide(FetchHttpClient.layer));
