import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpServerRequest } from "effect/unstable/http";
import { CurrentUser, DocumentAuthRpcs } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";
import { getConfig } from "../../config.ts";

const getHeader = (
  headers: Readonly<Record<string, string>>,
  name: string,
): Option.Option<string> =>
  Option.fromUndefinedOr(
    headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()],
  );

const ABSOLUTE_URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(?:[/?#].*)?$/i;

const parseAbsoluteUrl = (value: string) => {
  const match = value.match(ABSOLUTE_URL_PATTERN);
  const protocol = Option.fromUndefinedOr(match?.[1]);
  const host = Option.fromUndefinedOr(match?.[2]);
  return Option.all({ protocol, host }).pipe(
    Option.map(({ protocol, host }) => ({ protocol: protocol.toLowerCase(), host })),
  );
};

class DocumentConnectionUrlError extends Schema.TaggedErrorClass<DocumentConnectionUrlError>()(
  "DocumentConnectionUrlError",
  { message: Schema.String },
) {}

const websocketProtocol = (protocol: string): string => {
  if (protocol === "https") return "wss";
  return "ws";
};

/**
 * Builds the absolute `ws(s)://` URL a client connects to for a document, or
 * `undefined` when neither the configured base URL nor the request identifies
 * a host (a defect the caller reports).
 *
 * `publicBaseUrl` (the `MIMIC_PUBLIC_BASE_URL` config) is the primary
 * authority: requests arriving through a service-binding fetch carry no
 * `x-forwarded-*` headers and no absolute URL, so header derivation would
 * mint `ws://` URLs that https-served clients cannot open. When the base URL
 * is unset (dev on `http://localhost`), scheme/host are derived from the
 * request exactly as before, so local clients keep receiving `ws://`.
 */
export const buildDocumentConnectionUrl = (
  publicBaseUrl: Option.Option<string>,
  request: { readonly url: string; readonly headers: Readonly<Record<string, string>> },
  databaseId: string,
  collectionId: string,
  documentId: string,
): Option.Option<string> => {
  const path = `/ws/v1/databases/${encodeURIComponent(
    databaseId,
  )}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
  if (Option.isSome(publicBaseUrl)) {
    const base = parseAbsoluteUrl(publicBaseUrl.value);
    if (Option.isSome(base)) {
      return Option.some(`${websocketProtocol(base.value.protocol)}://${base.value.host}${path}`);
    }
  }
  const forwardedProto = getHeader(request.headers, "x-forwarded-proto");
  const forwardedHost = getHeader(request.headers, "x-forwarded-host");
  const host = Option.orElse(forwardedHost, () => getHeader(request.headers, "host"));
  const absoluteUrl = parseAbsoluteUrl(request.url);
  const protocol = Option.getOrElse(
    Option.orElse(
      Option.map(absoluteUrl, (url) => url.protocol),
      () => forwardedProto,
    ),
    () => "http",
  );
  const authority = Option.orElse(
    Option.map(absoluteUrl, (url) => url.host),
    () => host,
  );
  return Option.map(authority, (value) => `${websocketProtocol(protocol)}://${value}${path}`);
};

export const DocumentAuthHandlersLive = DocumentAuthRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      SetupDocumentAuthentication: ({
        collectionId,
        documentId,
        permission,
        origins,
        expiresInSeconds,
      }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          const result = yield* host.createDocumentAuthToken(
            collectionId,
            documentId,
            permission,
            origins,
            Option.fromUndefinedOr(expiresInSeconds),
          );
          const url = buildDocumentConnectionUrl(
            getConfig().publicBaseUrl,
            request,
            databaseId,
            collectionId,
            documentId,
          );
          if (Option.isNone(url)) {
            return yield* Effect.die(
              new DocumentConnectionUrlError({
                message: "Failed to determine request host for document connection URL",
              }),
            );
          }
          return { token: result.token, url: url.value };
        }),
    };
  }),
);
