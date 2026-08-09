// Parts are ripped from https://github.com/pingdotgg/uploadthing/blob/main/packages/shared/src/utils.ts

import { Effect } from "effect";

import type { ResponseEsque } from "./types";

export async function safeParseJSON<T>(input: ResponseEsque): Promise<T | Error> {
  const text = await input.text();
  return Effect.runSync(
    Effect.try({
      try: () => JSON.parse(text) as T,
      catch: () => new Error(`Error parsing JSON, got '${text}'`),
    }).pipe(Effect.catch((error) => Effect.succeed(error))),
  );
}

export function expoRouterWithVoidhashCallback(options: { path: string; initial: boolean }) {
  if (options.path.includes("voidhash/callback")) {
    return null;
  }

  return options.path;
}
