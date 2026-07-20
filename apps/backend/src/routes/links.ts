import {
  CreateLinkResponse,
  LinksApi,
  LinkInvalidRequestError,
  LinkRateLimitedError,
  LinkServiceUnavailableError,
  LinkUnauthorizedError,
} from "@voidhash/api-contracts/links";
import { LinkRedirectService } from "@voidhash/core/services/measurement/LinkRedirectService";
import { Effect } from "effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

const publicOrigin = (headers: Readonly<Record<string, string | undefined>>): string => {
  const host = headers["x-forwarded-host"]?.split(",")[0]?.trim() ?? headers.host?.trim();
  if (!host) return "https://links.voidhash.com";
  const protocol = headers["x-forwarded-proto"]?.split(",")[0]?.trim() ?? "https";
  return `${protocol}://${host}`;
};

const mapLinkError = (error: unknown):
  | LinkInvalidRequestError
  | LinkUnauthorizedError
  | LinkRateLimitedError
  | LinkServiceUnavailableError => {
  if (
    error instanceof LinkInvalidRequestError ||
    error instanceof LinkUnauthorizedError ||
    error instanceof LinkRateLimitedError ||
    error instanceof LinkServiceUnavailableError
  ) return error;
  return new LinkServiceUnavailableError({ code: "service_unavailable", error: "link dependency is unavailable" });
};

/** HTTP handlers for signed-link creation and deterministic deferred resolution. */
export const LinksGroupLive = HttpApiBuilder.group(LinksApi, "links", (handlers) =>
  Effect.gen(function* () {
    const service = yield* LinkRedirectService;
    return handlers
      .handle("createLink", ({ payload, request }) =>
        service.create(payload, publicOrigin(request.headers)).pipe(
          Effect.map((result) => new CreateLinkResponse(result)),
          Effect.mapError(mapLinkError),
        ),
      )
      .handle("resolveDeferredLink", ({ payload }) =>
        service.resolveDeferred(payload).pipe(Effect.mapError(mapLinkError)),
      );
  }),
);
