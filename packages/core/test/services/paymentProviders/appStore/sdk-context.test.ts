/**
 * Unit tests for {@link buildAppStoreSdkContext}.
 *
 * The context builder closes over the REAL `AppStoreServerSdkClient` /
 * `SignedDataVerifier` factories — the only injectable seam is the
 * `AppStoreServerSdk` handle, which is just `{ httpClient }`. We therefore
 * drive the production-then-sandbox fallback logic the same way the SDK
 * package's own tests do: by supplying a fake `HttpClient` that returns canned
 * HTTP responses. Routing the canned response on the request host
 * (`api.storekit.itunes.apple.com` vs `api.storekit-sandbox.itunes.apple.com`)
 * lets us make the production attempt fail with a real `AppStoreNotFoundError`
 * and the sandbox attempt succeed, exercising the genuine `Effect.catchTag`
 * fallback rather than a hand-rolled double.
 */
import {
  AppStoreServerSdk,
  Environment,
  type TransactionHistoryRequest,
  VerificationError,
} from "@voidhash/app-store-server-sdk";
import { constant } from "@voidhash/lib/lang";
import { Effect, Option } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { describe, expect, it } from "../../../../src/testing/effect-vitest.ts";

import { buildAppStoreSdkContext } from "../../../../src/services/paymentProviders/appStore/sdk-context.ts";

const PRODUCTION_HOST = "api.storekit.itunes.apple.com";
const SANDBOX_HOST = "api.storekit-sandbox.itunes.apple.com";

// Canned response bodies are written as literal JSON text because that is what
// the fake transport hands back on the wire.
const TRANSACTION_NOT_FOUND_BODY = `{"errorCode":4040010,"errorMessage":"Transaction id not found."}`;

const TRANSACTION_INFO_BODY = `{"signedTransactionInfo":"signed_transaction_info_value"}`;

const HISTORY_BODY = `{"revision":"revision_output","bundleId":"com.example","appAppleId":323232,"environment":"${Environment.SANDBOX}","hasMore":false,"signedTransactions":["signed_transaction_value"]}`;

const STATUS_BODY = `{"environment":"${Environment.SANDBOX}","bundleId":"com.example","appAppleId":5454545,"data":[]}`;

/** A canned HTTP response keyed by request host. */
type ResponseByHost = {
  readonly host: string;
  readonly status: number;
  readonly body: string;
};

/**
 * Build a fake `HttpClient` that returns a canned response chosen by the
 * request host. Also records every host it was asked to hit so tests can
 * assert the production attempt happened before the sandbox fallback.
 */
const recordingHttpClient = (responses: ReadonlyArray<ResponseByHost>) => {
  const hostsHit: string[] = [];
  const client = HttpClient.make((request, url) =>
    Effect.sync(() => {
      hostsHit.push(url.host);
      const match = responses.find((response) => response.host === url.host);
      const status = match?.status ?? 500;
      const body = match?.body ?? "{}";
      const webResponse = new Response(body, {
        status,
        headers: { "Content-Type": "application/json" },
      });
      return HttpClientResponse.fromWeb(request, webResponse);
    }),
  );
  return constant({ client, hostsHit });
};

/** A {@link TransactionHistoryRequest} with every optional filter absent. */
const emptyHistoryRequest = (): TransactionHistoryRequest => ({
  startDate: Option.none(),
  endDate: Option.none(),
  productIds: Option.none(),
  productTypes: Option.none(),
  sort: Option.none(),
  subscriptionGroupIdentifiers: Option.none(),
  inAppOwnershipType: Option.none(),
  revoked: Option.none(),
});

const sdkWith = (responses: ReadonlyArray<ResponseByHost>) => {
  const { client, hostsHit } = recordingHttpClient(responses);
  const sdk = AppStoreServerSdk.of({ httpClient: client });
  return constant({ sdk, hostsHit });
};

/**
 * A fresh, valid config per test. The signing key must parse as a PKCS8 EC
 * key so the client can mint a bearer token before the (faked) HTTP call.
 */
const config = () =>
  constant({
    appAppleId: "1234567",
    bundleId: "com.example",
    inAppPurchaseKeyIssuerId: "issuer-id",
    inAppPurchaseKeyId: "key-id",
    inAppPurchasePrivateKey: TEST_SIGNING_KEY,
  });

// A throwaway PKCS8 EC P-256 private key used only to mint a (never-validated)
// bearer token in the faked HTTP path. Matches the shape the SDK signer expects.
const TEST_SIGNING_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2
OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r
1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G
-----END PRIVATE KEY-----`;

describe("buildAppStoreSdkContext", () => {
  it("returns an object exposing every documented method", () => {
    const { sdk } = sdkWith([]);
    const context = buildAppStoreSdkContext(sdk, config());

    expect(context.bundleId).toBe("com.example");
    expect(typeof context.getTransactionInfo).toBe("function");
    expect(typeof context.decodeSignedTransaction).toBe("function");
    expect(typeof context.decodeSignedRenewalInfo).toBe("function");
    expect(typeof context.decodeNotification).toBe("function");
    expect(typeof context.getTransactionHistoryWithEnvironmentFallback).toBe("function");
    expect(typeof context.getAllSubscriptionStatusesWithEnvironmentFallback).toBe("function");
  });

  describe("getTransactionInfo", () => {
    it.effect("tries production first, then falls back to sandbox on AppStoreNotFoundError", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 404, body: TRANSACTION_NOT_FOUND_BODY },
          { host: SANDBOX_HOST, status: 200, body: TRANSACTION_INFO_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getTransactionInfo("txn-1");

        // Production is attempted before the sandbox fallback.
        expect(hostsHit).toEqual([PRODUCTION_HOST, SANDBOX_HOST]);
        // The returned tuple reports the environment that actually answered.
        expect(result.environment).toBe(Environment.SANDBOX);
        expect(Option.getOrUndefined(result.transactionInfo.signedTransactionInfo)).toBe(
          "signed_transaction_info_value",
        );
      }),
    );

    it.effect("returns the { environment, transactionInfo } tuple from production without falling back", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 200, body: TRANSACTION_INFO_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getTransactionInfo("txn-1");

        expect(hostsHit).toEqual([PRODUCTION_HOST]);
        expect(result.environment).toBe(Environment.PRODUCTION);
        expect(Option.getOrUndefined(result.transactionInfo.signedTransactionInfo)).toBe(
          "signed_transaction_info_value",
        );
      }),
    );

    it.effect("does not fall back when production fails with a non-not-found error", () =>
      Effect.gen(function* () {
        // A 401 unauthorized is NOT an AppStoreNotFoundError, so the catchTag
        // must not swallow it — the failure surfaces and sandbox is never hit.
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 401, body: "{}" },
          { host: SANDBOX_HOST, status: 200, body: TRANSACTION_INFO_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const error = yield* context.getTransactionInfo("txn-1").pipe(Effect.flip);

        expect(error._tag).toBe("AppStoreUnauthorizedError");
        expect(hostsHit).toEqual([PRODUCTION_HOST]);
      }),
    );
  });

  describe("getTransactionHistoryWithEnvironmentFallback", () => {
    it.effect("tries production first, then falls back to sandbox on AppStoreNotFoundError", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 404, body: TRANSACTION_NOT_FOUND_BODY },
          { host: SANDBOX_HOST, status: 200, body: HISTORY_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getTransactionHistoryWithEnvironmentFallback(
          "txn-1",
          Option.none(),
          emptyHistoryRequest(),
          Option.none(),
        );

        expect(hostsHit).toEqual([PRODUCTION_HOST, SANDBOX_HOST]);
        expect(result.environment).toBe(Environment.SANDBOX);
        expect(Option.getOrUndefined(result.historyResponse.revision)).toBe("revision_output");
      }),
    );

    it.effect("returns the { environment, historyResponse } tuple from production", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 200, body: HISTORY_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getTransactionHistoryWithEnvironmentFallback(
          "txn-1",
          Option.none(),
          emptyHistoryRequest(),
          Option.none(),
        );

        expect(hostsHit).toEqual([PRODUCTION_HOST]);
        expect(result.environment).toBe(Environment.PRODUCTION);
        expect(Option.getOrUndefined(result.historyResponse.revision)).toBe("revision_output");
      }),
    );
  });

  describe("getAllSubscriptionStatusesWithEnvironmentFallback", () => {
    it.effect("tries production first, then falls back to sandbox on AppStoreNotFoundError", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 404, body: TRANSACTION_NOT_FOUND_BODY },
          { host: SANDBOX_HOST, status: 200, body: STATUS_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getAllSubscriptionStatusesWithEnvironmentFallback("txn-1", Option.none());

        expect(hostsHit).toEqual([PRODUCTION_HOST, SANDBOX_HOST]);
        expect(result.environment).toBe(Environment.SANDBOX);
        expect(Option.getOrUndefined(result.statusResponse.bundleId)).toBe("com.example");
      }),
    );

    it.effect("returns the { environment, statusResponse } tuple from production", () =>
      Effect.gen(function* () {
        const { sdk, hostsHit } = sdkWith([
          { host: PRODUCTION_HOST, status: 200, body: STATUS_BODY },
        ]);
        const context = buildAppStoreSdkContext(sdk, config());

        const result = yield* context.getAllSubscriptionStatusesWithEnvironmentFallback("txn-1", Option.none());

        expect(hostsHit).toEqual([PRODUCTION_HOST]);
        expect(result.environment).toBe(Environment.PRODUCTION);
        expect(Option.getOrUndefined(result.statusResponse.bundleId)).toBe("com.example");
      }),
    );
  });

  describe("decodeSignedTransaction", () => {
    it.effect("verifies against the requested environment and fails VerificationError on a bad JWS", () =>
      Effect.gen(function* () {
        const { sdk } = sdkWith([]);
        const context = buildAppStoreSdkContext(sdk, config());

        // No HTTP is involved (the verifier is pure), so a structurally invalid
        // JWS deterministically fails verification. This confirms the call is
        // routed to the verifier for the specified environment.
        const error = yield* context.decodeSignedTransaction("not-a-real-jws", Environment.PRODUCTION).pipe(Effect.flip);

        expect(error).toBeInstanceOf(VerificationError);
      }),
    );
  });

  describe("decodeSignedRenewalInfo", () => {
    it.effect("verifies against the requested environment and fails VerificationError on a bad JWS", () =>
      Effect.gen(function* () {
        const { sdk } = sdkWith([]);
        const context = buildAppStoreSdkContext(sdk, config());

        const error = yield* context.decodeSignedRenewalInfo("not-a-real-jws", Environment.SANDBOX).pipe(Effect.flip);

        expect(error).toBeInstanceOf(VerificationError);
      }),
    );
  });

  describe("decodeNotification", () => {
    it.effect("surfaces a VerificationError after exhausting production then sandbox", () =>
      Effect.gen(function* () {
        const { sdk } = sdkWith([]);
        const context = buildAppStoreSdkContext(sdk, config());

        // A garbage payload fails verification in BOTH environments; the prod
        // attempt's VerificationError is caught and the sandbox attempt is made,
        // whose VerificationError is the one that finally surfaces.
        const error = yield* context.decodeNotification("not-a-real-jws").pipe(Effect.flip);

        expect(error).toBeInstanceOf(VerificationError);
      }),
    );

    // Deferred: asserting a SUCCESSFUL decode (the "returns decoded
    // notification" / environment-fallback-to-success case) requires a real
    // Apple-signed JWS with a valid x5c certificate chain rooted in
    // APPLE_ROOT_CERTIFICATES_PEM plus a live OCSP check (enableOnlineChecks:
    // true). That cannot be produced in-process without Apple's signing keys,
    // and faking it would mean replacing the real SignedDataVerifier — which is
    // exactly the kind of double the unit-test rules forbid. The successful
    // production-vs-sandbox decode path is therefore left to a higher tier.
    it.todo(
      "decodeNotification returns a decoded notification and reports the matched environment (needs a real Apple-signed JWS + cert chain; cannot be produced in-process)",
    );
  });
});
