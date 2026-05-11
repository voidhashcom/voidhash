/**
 * Header-comment helpers used by the generated `voidhash.gen.d.ts`. The
 * version hash itself is supplied by the server (`GET /api/v1/schema`,
 * `GET /api/v1/schema/version`) — there is no client-side derivation.
 */

export const VOIDHASH_VERSION_COMMENT_PREFIX = "// @voidhash:version ";
export const VOIDHASH_FETCHED_AT_COMMENT_PREFIX = "// @voidhash:fetched-at ";

/**
 * Extract the version header from a generated `.d.ts`, if present.
 * Returns null when the header is missing (e.g. the file was hand-edited).
 */
export function parseVersionFromDeclaration(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith(VOIDHASH_VERSION_COMMENT_PREFIX)) {
      return line.slice(VOIDHASH_VERSION_COMMENT_PREFIX.length).trim();
    }
  }
  return null;
}
