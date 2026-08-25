import { Effect, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

/**
 * Path prefix every v1 route is mounted under. Mirrors the `.prefix("/api/v1")`
 * applied to `VoidhashV1Api`, so `Location` values line up with the routes the
 * OpenAPI document advertises.
 */
const API_V1_PREFIX = "/api/v1";

/**
 * Builds the `201 Created` response for a create endpoint: the resource encoded
 * exactly as the endpoint's declared success schema would encode it, plus a
 * `Location` header pointing at the canonical `GET` for the new resource.
 *
 * `HttpApiBuilder` only encodes a handler's return value through the success
 * schema when that value is *not* already an `HttpServerResponse` — a handler
 * may return a response directly (`HttpApiEndpoint.Handler` types the success
 * channel as `Success | HttpServerResponse`), which is the only place response
 * headers can be attached. Because that path skips the framework's encoder,
 * this helper reproduces it: encode with `schema`, serialise as JSON, and use
 * the 201 status the endpoint declares. Pass the *same* schema the endpoint
 * declares as its success, or the wire body will drift from the contract.
 *
 * `location` is the path below `/api/v1`, e.g. `/perks/${perk.id}`; it is
 * emitted as an absolute-path reference, which RFC 9110 §10.2.2 permits.
 * Encoding failures are defects, matching how the framework treats a success
 * value that does not fit its schema.
 *
 * @example
 * ```ts
 * return yield* createdResponse(Perk, perk, `/perks/${perk.id}`);
 * ```
 */
export const createdResponse = <S extends Schema.Top>(
  schema: S,
  resource: S["Type"],
  location: string,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, S["EncodingServices"]> =>
  Schema.encodeEffect(schema)(resource).pipe(
    Effect.orDie,
    Effect.map((encoded) =>
      // oxlint-disable-next-line effect/noGlobals -- must reproduce the framework's own success encoding byte for byte (`getResponseEncode`'s Json branch does exactly this), so the body is identical whether or not the handler sets a Location header.
      HttpServerResponse.text(JSON.stringify(encoded), {
        contentType: "application/json",
        status: 201,
      }).pipe(HttpServerResponse.setHeader("location", `${API_V1_PREFIX}${location}`)),
    ),
  );
