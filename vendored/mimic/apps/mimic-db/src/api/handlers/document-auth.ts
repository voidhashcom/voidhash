import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { CurrentUser, DocumentAuthRpcs } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";
import { getConfig } from "../../config.ts";

const getHeader = (headers: Record<string, string | undefined>, name: string) =>
  headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

const ABSOLUTE_URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(?:[/?#].*)?$/i;

const parseAbsoluteUrl = (value: string) => {
  const match = value.match(ABSOLUTE_URL_PATTERN);
  if (!match) {
    return null;
  }
  return {
    protocol: match[1]!.toLowerCase(),
    host: match[2]!,
  };
};

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
  publicBaseUrl: string | undefined,
  request: { readonly url: string; readonly headers: Record<string, string | undefined> },
  databaseId: string,
  collectionId: string,
  documentId: string,
): string | undefined => {
  const path = `/ws/v1/databases/${encodeURIComponent(
    databaseId,
  )}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
  if (publicBaseUrl) {
    const base = parseAbsoluteUrl(publicBaseUrl);
    if (base) {
      return `${websocketProtocol(base.protocol)}://${base.host}${path}`;
    }
  }
  const forwardedProto = getHeader(request.headers, "x-forwarded-proto");
  const forwardedHost = getHeader(request.headers, "x-forwarded-host");
  const host = forwardedHost ?? getHeader(request.headers, "host");
  const absoluteUrl = parseAbsoluteUrl(request.url);
  const protocol = absoluteUrl?.protocol ?? forwardedProto ?? "http";
  const authority = absoluteUrl?.host ?? host;
  if (!authority) {
    return undefined;
  }
  return `${websocketProtocol(protocol)}://${authority}${path}`;
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
            expiresInSeconds,
          );
          const url = buildDocumentConnectionUrl(
            getConfig().publicBaseUrl,
            request,
            databaseId,
            collectionId,
            documentId,
          );
          if (url === undefined) {
            return yield* Effect.die(
              new Error("Failed to determine request host for document connection URL"),
            );
          }
          return { token: result.token, url };
        }),
    };
  }),
);
