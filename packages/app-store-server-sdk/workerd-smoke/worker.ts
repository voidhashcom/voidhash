/**
 * Workers-runtime smoke-test entry point.
 *
 * This module is bundled by `run-smoke.mjs` and executed inside a real workerd
 * instance (via miniflare) — NOT Node. It imports the actual ported verifier so
 * the smoke test proves the full crypto path (jose `compactVerify` +
 * `@peculiar/x509` chain validation + WebCrypto, including the `reflect-metadata`
 * / `tsyringe` initialization peculiar relies on) runs on Cloudflare Workers.
 */
import { Effect, Option } from "effect";
import { Environment } from "../src/schemas/index.js";
import { SignedDataVerifier } from "../src/verification/index.js";

interface VerifyRequest {
  signedTransaction: string;
  rootCertificates: string[];
  bundleId: string;
  environment: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const runtime = {
      subtle: typeof globalThis.crypto?.subtle,
      randomUUID: typeof globalThis.crypto?.randomUUID,
      hasBuffer: typeof (globalThis as { Buffer?: unknown }).Buffer !== "undefined",
    };

    try {
      const body = (await request.json()) as VerifyRequest;

      const verifier = SignedDataVerifier.make(null as never, {
        rootCertificates: body.rootCertificates,
        enableOnlineChecks: false,
        environment: body.environment as (typeof Environment)[keyof typeof Environment],
        bundleId: body.bundleId,
        appAppleId: Option.none(),
        verifyNotificationOverride: Option.none(),
      });

      const exit = await Effect.runPromiseExit(
        verifier.verifyAndDecodeTransaction(body.signedTransaction),
      );

      return Response.json({ ok: exit._tag === "Success", runtime });
    } catch (error) {
      return Response.json({ ok: false, runtime, error: String(error) }, { status: 500 });
    }
  },
};
