import { Effect, Encoding } from "effect";

import type { PublicFileStoreError, PublicFileStoreShape } from "../storage/PublicFileStore.ts";

/**
 * Keep the inlined document safely under the 4 MiB HTML budget the Cloudflare
 * Browser Rendering screenshot action enforces.
 */
const DEFAULT_MAX_HTML_BYTES = 3_500_000;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBase64 = (bytes: Uint8Array): string => Encoding.encodeBase64(bytes);

const keyFromUrl = (url: string, prefix: string): Effect.Effect<string | null> => {
  const raw = url.slice(prefix.length).split(/[?#]/, 1)[0] ?? "";
  if (raw === "") {
    return Effect.succeed(null);
  }
  // The renderer emits `encodeURI(url)`; recover the raw object key. A malformed
  // percent-escape is treated as "not one of ours" and left untouched.
  return Effect.try({ try: () => decodeURIComponent(raw), catch: () => null }).pipe(
    Effect.catch(() => Effect.succeed(null)),
  );
};

/**
 * Rewrites every public-file-store URL (`${publicBaseUrl}/files/<key>`) inside
 * a rendered HTML document into a base64 `data:` URI read straight from the
 * store.
 *
 * Screenshot backends do not necessarily share the serving origin's network:
 * Cloudflare Browser Rendering runs remotely, so a dev worker's
 * `http://localhost:*` asset URLs are unreachable and images render blank.
 * Inlining removes the network dependency entirely — the worker reads the same
 * bytes the `GET /files/*` route would serve.
 *
 * Unknown keys are left untouched (the URL stays as-is). An image whose data
 * URI would push the document past `maxHtmlBytes` is skipped with a warning
 * rather than failing the render. A URL immediately followed by an HTML-escaped
 * query continuation (`&amp;`) is skipped too, since the match cannot span the
 * entity boundary safely.
 */
export const inlinePublicFileImages = (
  html: string,
  store: Pick<PublicFileStoreShape, "publicBaseUrl" | "getObject">,
  options?: { readonly maxHtmlBytes?: number },
): Effect.Effect<string, PublicFileStoreError> =>
  Effect.gen(function* () {
    const prefix = `${store.publicBaseUrl}/files/`;
    const maxHtmlBytes = options?.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES;
    const pattern = new RegExp(`${escapeRegExp(prefix)}[^"'()<>\\s&\\\\]*`, "g");

    const dataUris = new Map<string, string | null>();
    let out = "";
    let cursor = 0;
    let projectedBytes = html.length;

    for (const match of html.matchAll(pattern)) {
      const url = match[0];
      const start = match.index;
      const end = start + url.length;
      out += html.slice(cursor, start);
      cursor = start;

      if (html.startsWith("&amp;", end)) {
        continue;
      }

      let dataUri = dataUris.get(url);
      if (dataUri === undefined) {
        const key = yield* keyFromUrl(url, prefix);
        const object = yield* Effect.suspend(() => {
          if (key === null) return Effect.succeed(null);
          return store.getObject(key);
        });
        dataUri = null;
        if (object !== null) {
          dataUri = `data:${object.contentType ?? "image/png"};base64,${toBase64(object.body)}`;
        }
        dataUris.set(url, dataUri);
      }
      if (dataUri === null) {
        continue;
      }
      if (projectedBytes + dataUri.length - url.length > maxHtmlBytes) {
        yield* Effect.logWarning(
          `Skipping thumbnail image inline for ${url}: document would exceed ${maxHtmlBytes} bytes`,
        );
        continue;
      }

      projectedBytes += dataUri.length - url.length;
      out += dataUri;
      cursor = end;
    }

    return out + html.slice(cursor);
  });
