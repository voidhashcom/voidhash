import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect, Schema } from "effect";
import { HttpApi, HttpApiEndpoint } from "effect/unstable/httpapi";

import type { GeneratedVoidhashNodeEffectClient } from "./client-types";

type RequestPartName = "headers" | "params" | "payload" | "query";

type EndpointNormalizers = Partial<
  Record<RequestPartName, (value: unknown) => Effect.Effect<unknown, Schema.SchemaError, unknown>>
>;

const endpointNormalizers = new Map<string, EndpointNormalizers>();

const endpointKey = (group: string, endpoint: string) => `${group}.${endpoint}`;

const getPayloadSchema = (endpoint: HttpApiEndpoint.AnyWithProps) => {
  const schemas = Array.from(endpoint.payload.values()).flatMap((value) => value.schemas);

  if (schemas.length === 0) {
    return undefined;
  }

  return schemas.length === 1 ? schemas[0] : Schema.Union(schemas);
};

HttpApi.reflect(VoidhashV1Api, {
  onGroup: () => {},
  onEndpoint: ({ endpoint, group }) => {
    const normalizers: EndpointNormalizers = {};

    if (endpoint.params) {
      normalizers.params = Schema.decodeUnknownEffect(endpoint.params);
    }

    if (endpoint.query) {
      normalizers.query = Schema.decodeUnknownEffect(endpoint.query);
    }

    if (endpoint.headers) {
      normalizers.headers = Schema.decodeUnknownEffect(endpoint.headers);
    }

    const payloadSchema = getPayloadSchema(endpoint);
    if (payloadSchema) {
      normalizers.payload = Schema.decodeUnknownEffect(payloadSchema);
    }

    endpointNormalizers.set(endpointKey(group.identifier, endpoint.name), normalizers);
  },
});

const normalizeRequest = (
  normalizers: EndpointNormalizers,
  request: Record<string, unknown> | undefined
) =>
  Effect.gen(function*() {
    if (request === undefined) {
      return undefined;
    }

    const normalized = {
      ...request,
    };

    if (normalizers.params && "params" in request) {
      normalized.params = yield* normalizers.params(request.params);
    }

    if (normalizers.query && "query" in request) {
      normalized.query = yield* normalizers.query(request.query);
    }

    if (normalizers.headers && "headers" in request) {
      normalized.headers = yield* normalizers.headers(request.headers);
    }

    if (normalizers.payload && "payload" in request) {
      normalized.payload = yield* normalizers.payload(request.payload);
    }

    return normalized;
  });

export const normalizeGeneratedClient = (
  client: GeneratedVoidhashNodeEffectClient
): GeneratedVoidhashNodeEffectClient =>
  Object.fromEntries(
    Object.entries(client).map(([groupName, groupValue]) => {
      if (!groupValue || typeof groupValue !== "object") {
        return [groupName, groupValue];
      }

      const normalizedGroup = Object.fromEntries(
        Object.entries(groupValue).map(([endpointName, endpoint]) => {
          if (typeof endpoint !== "function") {
            return [endpointName, endpoint];
          }

          const normalizers = endpointNormalizers.get(endpointKey(groupName, endpointName));

          if (!normalizers) {
            return [endpointName, endpoint];
          }

          return [
            endpointName,
            (request?: Record<string, unknown>) =>
              Effect.flatMap(normalizeRequest(normalizers, request), (normalized) =>
                Reflect.apply(
                  endpoint as (request?: unknown) => Effect.Effect<unknown>,
                  groupValue,
                  [normalized]
                )
              ),
          ];
        })
      );

      return [groupName, normalizedGroup];
    })
  ) as GeneratedVoidhashNodeEffectClient;
