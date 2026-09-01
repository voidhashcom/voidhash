// Parts are ripped from https://github.com/pingdotgg/uploadthing/blob/main/packages/shared/src/utils.ts

import * as Result from "effect/Result";

import type { ResponseEsque } from "./types";
import * as Schema from "effect/Schema";
const effectDecodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  cause: Schema.Unknown,
  text: Schema.String,
}) {}

export async function safeParseJSON(
  input: ResponseEsque,
): Promise<Result.Result<unknown, JsonParseError>> {
  const text = await input.text();
  return Result.try({
    try: () => effectDecodeJson(text),
    catch: (cause) => new JsonParseError({ cause, text }),
  });
}

export function expoRouterWithVoidhashCallback(options: { path: string; initial: boolean }) {
  if (options.path.includes("voidhash/callback")) {
    return null;
  }

  return options.path;
}
