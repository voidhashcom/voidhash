import { ComponentCompiler } from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Effect, Layer, Schema } from "effect";

import {
  CompileCheckResponse,
  CompileExtractResponse,
} from "./CompilerProtocol.ts";

const decodeCheck = Schema.decodeUnknownEffect(CompileCheckResponse);
const decodeExtract = Schema.decodeUnknownEffect(CompileExtractResponse);

const callCompiler = <A>(
  baseUrl: string,
  mode: "check" | "extract",
  source: string,
  decode: (input: unknown) => Effect.Effect<A, unknown>,
  unavailable: A,
): Effect.Effect<A> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${baseUrl}/compile`, {
        body: JSON.stringify({ mode, source }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`compiler returned HTTP ${response.status}`);
      return response.json();
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.flatMap(decode),
    Effect.catchCause((cause) =>
      Effect.logWarning("Component compiler unavailable", { cause }).pipe(
        Effect.as(unavailable),
      ),
    ),
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
