import fs from "node:fs";
import path from "node:path";
import { Effect, Option } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { exportPKCS8, generateKeyPair } from "jose";
import { Environment } from "../src/schemas/index.ts";
import { AppStoreServerSdk } from "../src/sdk.ts";
import { SignedDataVerifier } from "../src/verification/index.ts";
import { AppStoreServerSdkClient } from "../src/client/index.ts";

/**
 * Read a file from the tests/resources directory.
 */
export const readFile = (filePath: string): string => {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.readFileSync(fullPath, "utf-8");
};

/**
 * Read a binary file from the tests/resources directory.
 */
export const readBinaryFile = (filePath: string): Buffer => {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.readFileSync(fullPath);
};

export const unwrapOptionsDeep = <T>(value: T): T => {
  if (Option.isOption(value)) {
    return Option.match(value, {
      onNone: () => undefined as T,
      onSome: (some) => unwrapOptionsDeep(some) as T,
    });
  }
  if (Array.isArray(value)) {
    return value.map(unwrapOptionsDeep) as T;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, unwrapOptionsDeep(item)]),
    ) as T;
  }
  return value;
};

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
    Effect.sync(() => {
      if (callback) {
        let bodyString: string | undefined;
        try {
          if (request.body && "_tag" in request.body) {
            const body = request.body as { _tag: string; body?: unknown };
            if (body._tag === "Uint8Array" && body.body instanceof Uint8Array) {
              bodyString = new TextDecoder().decode(body.body);
            } else if (body._tag === "Raw") {
              const rawBody = body.body;
              if (typeof rawBody === "string") {
                bodyString = rawBody;
              } else if (rawBody instanceof Uint8Array) {
                bodyString = new TextDecoder().decode(rawBody);
              }
            }
          }
        } catch {}

        const pathAndQuery = url.pathname + url.search;
        const headers: Record<string, string> = {};
        try {
          for (const [key, value] of request.headers) {
            headers[key] = value;
          }
        } catch {}
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
    verifyNotificationOverride: Option.fromNullishOr(
      verifyNotificationOverride
        ? (
            bundleId: Option.Option<string>,
            appAppleId: Option.Option<number>,
            environment: Option.Option<string>,
          ) =>
            verifyNotificationOverride(
              Option.getOrUndefined(bundleId),
              Option.getOrUndefined(appAppleId),
              Option.getOrUndefined(environment),
            )
        : undefined,
    ),
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
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
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
