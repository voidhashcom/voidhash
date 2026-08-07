import { ComponentCompiler } from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Data, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

import {
  CompileCheckResponse,
  CompileExtractResponse,
} from "./CompilerProtocol.ts";

const decodeCheck = Schema.decodeUnknownEffect(CompileCheckResponse);
const decodeExtract = Schema.decodeUnknownEffect(CompileExtractResponse);

const encodeCompileBody = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      mode: Schema.Literals(["check", "extract"]),
      source: Schema.String,
    }),
  ),
);

/** Non-2xx response from the compiler sidecar; degraded into `unavailable`. */
class CompilerResponseError extends Data.TaggedError("CompilerResponseError")<{
  readonly message: string;
}> {}

const callCompiler = <A>(
  baseUrl: string,
  mode: "check" | "extract",
  source: string,
  decode: (input: unknown) => Effect.Effect<A, unknown>,
  unavailable: A,
): Effect.Effect<A> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.post(`${baseUrl}/compile`, {
      body: HttpBody.text(encodeCompileBody({ mode, source }), "application/json"),
    });
    if (response.status < 200 || response.status >= 300) {
      return yield* new CompilerResponseError({
        message: `compiler returned HTTP ${response.status}`,
      });
    }
    return yield* decode(yield* response.json);
  }).pipe(
    Effect.timeout("30 seconds"),
    Effect.catchCause((cause) =>
      Effect.logWarning("Component compiler unavailable", { cause }).pipe(
        Effect.as(unavailable),
      ),
    ),
    Effect.provide(FetchHttpClient.layer),
  );

/** HTTP adapter from the backend compiler port to the isolated Node sidecar. */
export const makeHttpComponentCompilerLive = (url: string): Layer.Layer<ComponentCompiler> => {
  const baseUrl = url.replace(/\/$/, "");
  return Layer.succeed(ComponentCompiler, {
    compileCheck: (source) =>
      callCompiler(baseUrl, "check", source, decodeCheck, { status: "unavailable" }),
    compileAndExtract: (source) =>
      callCompiler(baseUrl, "extract", source, decodeExtract, { status: "unavailable" }),
  });
};
