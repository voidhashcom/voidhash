import fs from "node:fs";
import { Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { exportPKCS8, generateKeyPair } from "jose";
import { Environment } from "../src/schemas/index.ts";
import { AppStoreServerSdk } from "../src/sdk.ts";
import { SignedDataVerifier } from "../src/verification/index.ts";
import { AppStoreServerSdkClient } from "../src/client/index.ts";

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Read a file from the tests/resources directory.
 */
export const readFile = (filePath: string): string => {
  const fullPath = `${process.cwd()}/${filePath}`;
  return fs.readFileSync(fullPath, "utf-8");
};

/**
 * Read a binary file from the tests/resources directory.
 */
export const readBinaryFile = (filePath: string): Buffer => {
  const fullPath = `${process.cwd()}/${filePath}`;
  return fs.readFileSync(fullPath);
};

// The unwrapped shape is structurally different from the input (every `Option`
// collapses to its value or `undefined`), so the recursion is typed loosely and
// the exported wrapper restores the caller-facing shape.
const unwrapDeep = (value: unknown): any => {
  if (Option.isOption(value)) {
    return Option.match(value, {
      onNone: () => undefined,
      onSome: (some) => unwrapDeep(some),
    });
  }
  if (Array.isArray(value)) {
    return value.map(unwrapDeep);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrapDeep(item)]));
  }
  return value;
};

/**
 * Recursively replaces every `Option` in a decoded payload with its value (or
 * `undefined`), so assertions can read plain fields.
 */
export const unwrapOptionsDeep = <T>(value: T): T => unwrapDeep(value);

/** Ephemeral ES256 signing key used only by this test process. */
export const TEST_SIGNING_KEY = await generateKeyPair("ES256", { extractable: true }).then(
  ({ privateKey }) => exportPKCS8(privateKey),
);

/**
 * Test root CA certificate 1 (base64 encoded DER format).
 * Used by testNotification, transactionInfo mock files.
 */
export const ROOT_CA_BASE64_ENCODED_1 =
  "MIIBXDCCAQICCQCfjTUGLDnR9jAKBggqhkjOPQQDAzA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMB4XDTIzMDEwNDE2MjAzMloXDTMzMDEwMTE2MjAzMlowNjELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGlubzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHPvwZfoKLKaOrX/We4qObXSna5TdWHVZ6hIRA1w0oc3QCT0Io2plyDB3/MVlk2tc4KGE8TiqW7ibQ6Zc9V64k0wCgYIKoZIzj0EAwMDSAAwRQIhAMTHhWtbAQN0hSxIXcP4CKrDCH/gsxWpx6jTZLTeZ+FPAiB35nwk5q0zcIpefvYJ0MU/yGGHSWez0bq0pDYUO/nmDw==";

/**
 * Test root CA certificate 2 (base64 encoded DER format).
 * Used by renewalInfo, wrongBundleId mock files.
 */
export const ROOT_CA_BASE64_ENCODED_2 =
  "MIIBgjCCASmgAwIBAgIJALUc5ALiH5pbMAoGCCqGSM49BAMDMDYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlDdXBlcnRpbm8wHhcNMjMwMTA1MjEzMDIyWhcNMzMwMTAyMjEzMDIyWjA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEc+/Bl+gospo6tf9Z7io5tdKdrlN1YdVnqEhEDXDShzdAJPQijamXIMHf8xWWTa1zgoYTxOKpbuJtDplz1XriTaMgMB4wDAYDVR0TBAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDRwAwRAIgemWQXnMAdTad2JDJWng9U4uBBL5mA7WI05H7oH7c6iQCIHiRqMjNfzUAyiu9h6rOU/K+iTR0I/3Y/NSWsXHX+acc";

const hasTaggedBody =(body: unknown): body is { _tag: string; body?: unknown } =>
  typeof body === "object" && body !== null && "_tag" in body;

/** Best-effort text rendering of a request body, mirroring the tagged shapes we send. */
const requestBodyString = (body: unknown): string | undefined => {
  if (!hasTaggedBody(body)) return undefined;
  if (body._tag === "Uint8Array" && body.body instanceof Uint8Array) {
    return new TextDecoder().decode(body.body);
  }
  if (body._tag === "Raw") {
    const rawBody = body.body;
    if (typeof rawBody === "string") return rawBody;
    if (rawBody instanceof Uint8Array) return new TextDecoder().decode(rawBody);
  }
  return undefined;
};

/**
 * Build a mock `HttpClient.HttpClient` that returns predefined responses.
 */
export const createMockHttpClient = (
  responseBody: string,
  statusCode: number,
  callback?: (
    path: string,
    method: string,
    body: string | undefined,
    headers: Record<string, string>,
  ) => void,
): HttpClient.HttpClient =>
  HttpClient.make((request, url, _signal, _fiber) =>
    Effect.gen(function* () {
      if (callback) {
        const bodyString = yield* Effect.try(() => requestBodyString(request.body)).pipe(
          Effect.orElseSucceed((): string | undefined => undefined),
        );

        const pathAndQuery = url.pathname + url.search;
        const headers = yield* Effect.try(() => {
          const collected: Record<string, string> = {};
          for (const [key, value] of request.headers) {
            collected[key] = value;
          }
          return collected;
        }).pipe(Effect.orElseSucceed((): Record<string, string> => ({})));
        callback(pathAndQuery, request.method, bodyString, headers);
      }

      const webRequest = new Request(url.toString());
      const webResponse = new Response(responseBody, {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });

      return HttpClientResponse.fromWeb(webRequest, webResponse);
    }),
  );

/**
 * Build an `AppStoreServerSdk` instance backed by a mock HttpClient. Use with
 * `AppStoreServerSdkClient.make` and `SignedDataVerifier.make` in tests.
 */
export const createMockSdk = (
  httpClient: HttpClient.HttpClient,
): typeof AppStoreServerSdk.Service => AppStoreServerSdk.of({ httpClient });

/**
 * Convert base64-encoded DER certificate to PEM format.
 */
const toPem = (base64Der: string): string =>
  `-----BEGIN CERTIFICATE-----\n${base64Der}\n-----END CERTIFICATE-----`;

const noopMockSdk = createMockSdk(
  HttpClient.make(() => Effect.die("HttpClient not configured for SignedDataVerifier tests")),
);

/** Adapts the plain-value test override to the `Option`-based verifier hook. */
const toOptionOverride = (
  override:
    | ((
        bundleId: string | undefined,
        appAppleId: number | undefined,
        environment: string | undefined,
      ) => void)
    | undefined,
): Option.Option<
  (
    bundleId: Option.Option<string>,
    appAppleId: Option.Option<number>,
    environment: Option.Option<string>,
  ) => void
> => {
  if (override === undefined) return Option.none();
  return Option.some(
    (
      bundleId: Option.Option<string>,
      appAppleId: Option.Option<number>,
      environment: Option.Option<string>,
    ) =>
      override(
        Option.getOrUndefined(bundleId),
        Option.getOrUndefined(appAppleId),
        Option.getOrUndefined(environment),
      ),
  );
};

/**
 * Build a `SignedDataVerifier` instance with the test root certificates.
 *
 * The optional `verifyNotificationOverride` callback mirrors the upstream
 * library's `verifyNotification(bundleId, appAppleId, environment)` hook —
 * useful when a fixture's expected env/appAppleId differs from the verifier's
 * defaults and you only want to assert the extracted identifiers.
 */
export const getSignedPayloadVerifier = (
  environment: (typeof Environment)[keyof typeof Environment],
  bundleId: string,
  appAppleId?: number,
  verifyNotificationOverride?: (
    bundleId: string | undefined,
    appAppleId: number | undefined,
    environment: string | undefined,
  ) => void,
): SignedDataVerifier =>
  SignedDataVerifier.make(noopMockSdk, {
    rootCertificates: [toPem(ROOT_CA_BASE64_ENCODED_1), toPem(ROOT_CA_BASE64_ENCODED_2)],
    enableOnlineChecks: false,
    environment,
    bundleId,
    appAppleId: Option.fromNullishOr(appAppleId),
    verifyNotificationOverride: toOptionOverride(verifyNotificationOverride),
  });

/**
 * Build a `SignedDataVerifier` with the default test app Apple ID (1234).
 */
export const getSignedPayloadVerifierWithDefaultAppAppleId = (
  environment: (typeof Environment)[keyof typeof Environment],
  bundleId: string,
): SignedDataVerifier => getSignedPayloadVerifier(environment, bundleId, 1234);

/**
 * Build a default `SignedDataVerifier` for `LOCAL_TESTING` of `com.example`.
 */
export const getDefaultSignedPayloadVerifier = (): SignedDataVerifier =>
  getSignedPayloadVerifierWithDefaultAppAppleId(Environment.LOCAL_TESTING, "com.example");

/**
 * Create signed data from JSON for testing decoding.
 *
 * These fixtures are decoded by a verifier in `LocalTesting`/`Xcode` mode, which
 * skips both the certificate-chain and JWS signature checks. A structurally
 * valid JWS with a placeholder signature is therefore sufficient — no real
 * signing key is needed, which keeps the test helper WebCrypto-free.
 */
export const createSignedDataFromJson = (filePath: string): string => {
  const fileContents = readFile(filePath);
  const header = Buffer.from(encodeJson({ alg: "ES256" })).toString("base64url");
  const payload = Buffer.from(fileContents).toString("base64url");
  const signature = Buffer.from("unsigned-local-testing-fixture").toString("base64url");
  return `${header}.${payload}.${signature}`;
};

/**
 * Build an `AppStoreServerSdkClient` backed by a mock HTTP response loaded
 * from a file fixture.
 */
export const getClientWithMockedResponse = (
  responseFilePath: string,
  statusCode = 200,
  callback?: (
    path: string,
    method: string,
    body: string | undefined,
    headers: Record<string, string>,
  ) => void,
): AppStoreServerSdkClient => {
  const responseBody = readFile(responseFilePath);
  const sdk = createMockSdk(createMockHttpClient(responseBody, statusCode, callback));
  return AppStoreServerSdkClient.make(sdk, {
    signingKey: TEST_SIGNING_KEY,
    keyId: "keyId",
    issuerId: "issuerId",
    bundleId: "bundleId",
    environment: Environment.LOCAL_TESTING,
  });
};

/**
 * Build an `AppStoreServerSdkClient` backed by a mock HTTP response from an
 * inline body string.
 */
export const getClientWithBody = (
  responseBody: string,
  statusCode = 200,
  callback?: (
    path: string,
    method: string,
    body: string | undefined,
    headers: Record<string, string>,
  ) => void,
): AppStoreServerSdkClient => {
  const sdk = createMockSdk(createMockHttpClient(responseBody, statusCode, callback));
  return AppStoreServerSdkClient.make(sdk, {
    signingKey: TEST_SIGNING_KEY,
    keyId: "keyId",
    issuerId: "issuerId",
    bundleId: "bundleId",
    environment: Environment.LOCAL_TESTING,
  });
};
