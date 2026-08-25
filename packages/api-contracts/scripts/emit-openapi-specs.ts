/**
 * Emits the OpenAPI documents for both public HTTP surfaces straight from the
 * contracts, with no server involved.
 *
 * `HttpApiBuilder.layer({ openapiPath })` serves exactly `OpenApi.fromApi(api)`,
 * so the documents produced here are the ones a deployed stage would serve.
 * Generating them offline means the committed specs — and every client derived
 * from them — can be refreshed in the same commit that changes a contract,
 * instead of waiting for a deploy to fetch from.
 *
 * Usage: tsx packages/api-contracts/scripts/emit-openapi-specs.ts <coreOut> <eventCaptureOut>
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Stdio } from "effect";
import { OpenApi } from "effect/unstable/httpapi";

import { VoidhashV1Api } from "../src/Api.ts";
import { EventCaptureApi } from "../src/EventCapture.ts";

const USAGE =
  "Usage: tsx packages/api-contracts/scripts/emit-openapi-specs.ts <coreOut> <eventCaptureOut>";

/** Both output paths are required; the usage line is printed before failing. */
class MissingArguments extends Data.TaggedError("MissingArguments")<{}> {}

/** Matches the compact form the fetched documents were committed in. */
const serialize = (spec: unknown): string =>
  // oxlint-disable-next-line effect/noGlobals -- the OpenAPI document is a plain JSON tree produced by the framework, not a value with a Schema codec, and this must serialize byte-identically to what the server's own handler emits.
  `${JSON.stringify(spec)}\n`;

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const stdio = yield* Stdio.Stdio;
  const [coreOut, eventCaptureOut] = (yield* stdio.args).filter((argument) => argument !== "--");

  if (coreOut === undefined || eventCaptureOut === undefined) {
    yield* Console.error(USAGE);
    return yield* new MissingArguments();
  }

  yield* fileSystem.writeFileString(coreOut, serialize(OpenApi.fromApi(VoidhashV1Api)));
  yield* fileSystem.writeFileString(eventCaptureOut, serialize(OpenApi.fromApi(EventCaptureApi)));
  yield* Console.log(`Wrote ${coreOut} and ${eventCaptureOut}`);
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
