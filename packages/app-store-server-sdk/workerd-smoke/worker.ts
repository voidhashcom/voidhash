/**
 * Workers-runtime smoke-test entry point.
 *
 * This module is bundled by `run-smoke.mjs` and executed inside a real workerd
 * instance (via miniflare) — NOT Node. It imports the actual ported verifier so
 * the smoke test proves the full crypto path (jose `compactVerify` +
 * `@peculiar/x509` chain validation + WebCrypto, including the `reflect-metadata`
 * / `tsyringe` initialization peculiar relies on) runs on Cloudflare Workers.
 */
import { Cause, Effect, Option, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";
import { EnvironmentSchema } from "../src/schemas/index.js";
import { AppStoreServerSdk } from "../src/sdk.js";
import { SignedDataVerifier } from "../src/verification/index.js";

const VerifyRequestSchema = Schema.Struct({
  signedTransaction: Schema.String,
  rootCertificates: Schema.Array(Schema.String),
  bundleId: Schema.String,
  environment: EnvironmentSchema,
});

/**
 * The verifier is pure (no HTTP), so the SDK handle it accepts for API symmetry
 * is backed by a client that dies if anything ever calls it.
 */
const smokeSdk = AppStoreServerSdk.of({
  httpClient: HttpClient.make(() => Effect.die("HttpClient not configured for the workerd smoke test")),
});

export default {
  fetch: (request: Request): Promise<Response> => {
    const runtime = {
      subtle: typeof globalThis.crypto?.subtle,
      randomUUID: typeof globalThis.crypto?.randomUUID,
      hasBuffer: "Buffer" in globalThis,
    };

    return Effect.runPromise(
      Effect.gen(function* () {
        const json = yield* Effect.tryPromise(() => request.json());
        const body = yield* Schema.decodeUnknownEffect(VerifyRequestSchema)(json);

        const verifier = SignedDataVerifier.make(smokeSdk, {
          rootCertificates: [...body.rootCertificates],
          enableOnlineChecks: false,
          environment: body.environment,
          bundleId: body.bundleId,
          appAppleId: Option.none(),
          verifyNotificationOverride: Option.none(),
        });

        const exit = yield* Effect.exit(
          verifier.verifyAndDecodeTransaction(body.signedTransaction),
        );

        return Response.json({ ok: exit._tag === "Success", runtime });
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.succeed(
            Response.json({ ok: false, runtime, error: Cause.pretty(cause) }, { status: 500 }),
          ),
        ),
      ),
    );
  },
};
