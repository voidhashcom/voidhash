/**
 * Header-comment helpers used by the generated `voidhash.gen.d.ts`. The
 * version hash itself is supplied by the server (`GET /api/v1/schema`,
 * `GET /api/v1/schema/version`) — there is no client-side derivation.
 */

export const VOIDHASH_VERSION_COMMENT_PREFIX = "// @voidhash:version ";
export const VOIDHASH_FETCHED_AT_COMMENT_PREFIX = "// @voidhash:fetched-at ";

/**
 * Extract the version header from a generated `.d.ts`, if present.
 * Returns `Option.none` when the header is missing (e.g. the file was hand-edited).
 */
export const parseVersionFromDeclaration = (content: string): Option.Option<string> =>
  Arr.findFirst(content.split(/\r?\n/), (line) =>
    line.startsWith(VOIDHASH_VERSION_COMMENT_PREFIX)
      ? Option.some(line.slice(VOIDHASH_VERSION_COMMENT_PREFIX.length).trim())
      : Option.none(),
  );
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
