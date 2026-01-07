// Parts are ripped from https://github.com/pingdotgg/uploadthing/blob/main/packages/shared/src/utils.ts

import type { ResponseEsque } from "./types";

export async function safeParseJSON<T>(
  input: ResponseEsque
): Promise<T | Error> {
  const text = await input.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return new Error(`Error parsing JSON, got '${text}'`);
  }
}

export function expoRouterWithVoidhashCallback(options: {
  path: string;
  initial: boolean;
}) {
  if (options.path.includes("voidhash/callback")) {
    return null;
  }

  return options.path;
}
