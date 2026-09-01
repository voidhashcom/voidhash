import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import type { PublicFileStoreError, PublicFileStoreShape } from "../storage/PublicFileStore.ts";

/**
 * Keep the inlined document safely under the 4 MiB HTML budget the Cloudflare
 * Browser Rendering screenshot action enforces.
 */
const DEFAULT_MAX_HTML_BYTES = 3_500_000;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBase64 = (bytes: Uint8Array): string => Encoding.encodeBase64(bytes);

const keyFromUrl = (url: string, prefix: string): Effect.Effect<Option.Option<string>> => {
  const raw = url.slice(prefix.length).split(/[?#]/, 1)[0] ?? "";
  if (raw === "") {
    return Effect.succeed(Option.none());
  }
  // The renderer emits `encodeURI(url)`; recover the raw object key. A malformed
  // percent-escape is treated as "not one of ours" and left untouched.
  return Effect.try(() => decodeURIComponent(raw)).pipe(Effect.option);
};

interface InlineState {
  readonly cursor: number;
  readonly dataUris: HashMap.HashMap<string, Option.Option<string>>;
  readonly out: string;
  readonly projectedBytes: number;
}

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
  Effect.fn("inlinePublicFileImages")(function* () {
    const prefix = `${store.publicBaseUrl}/files/`;
    const maxHtmlBytes = options?.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES;
    const pattern = new RegExp(`${escapeRegExp(prefix)}[^"'()<>\\s&\\\\]*`, "g");

    const finalState = yield* Effect.reduce(
      Arr.fromIterable(html.matchAll(pattern)),
      (): InlineState => ({
        cursor: 0,
        dataUris: HashMap.empty(),
        out: "",
        projectedBytes: html.length,
      }),
      Effect.fn("inlinePublicFileImages.match")(function* (
        state: InlineState,
        match: RegExpExecArray,
      ) {
        const url = match[0];
        const start = match.index;
        const end = start + url.length;
        const next: InlineState = {
          ...state,
          cursor: start,
          out: state.out + html.slice(state.cursor, start),
        };

        if (html.startsWith("&amp;", end)) return next;

        const cached = HashMap.get(state.dataUris, url);
        const dataUri = yield* Option.match(cached, {
          onSome: (value) => Effect.succeed(value),
          onNone: () =>
            keyFromUrl(url, prefix).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.succeed(Option.none<string>()),
                  onSome: (key) =>
                    store
                      .getObject(key)
                      .pipe(
                        Effect.map((object) =>
                          Option.map(
                            object,
                            (object) =>
                              `data:${Option.getOrElse(object.contentType, () => "image/png")};base64,${toBase64(object.body)}`,
                          ),
                        ),
                      ),
                }),
              ),
            ),
        });
        const nextWithCache = {
          ...next,
          dataUris: HashMap.set(next.dataUris, url, dataUri),
        };
        if (Option.isNone(dataUri)) return nextWithCache;
        if (next.projectedBytes + dataUri.value.length - url.length > maxHtmlBytes) {
          yield* Effect.logWarning(
            `Skipping thumbnail image inline for ${url}: document would exceed ${maxHtmlBytes} bytes`,
          );
          return nextWithCache;
        }

        return {
          ...nextWithCache,
          cursor: end,
          out: next.out + dataUri.value,
          projectedBytes: next.projectedBytes + dataUri.value.length - url.length,
        };
      }),
    );

    return finalState.out + html.slice(finalState.cursor);
  })();
