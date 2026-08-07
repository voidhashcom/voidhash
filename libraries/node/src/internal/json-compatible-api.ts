import { Schema } from "effect";
import type { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const cloneWithPrototype = <T extends object>(value: T, properties: Record<string, unknown>): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, properties);

const mapOptionalSchema = (schema: Schema.Top | undefined) => {
  if (schema === undefined) {
    return undefined;
  }

  return Schema.toCodecJson(schema);
};

const mapPayloadSchemas = (payload: HttpApiEndpoint.PayloadMap): HttpApiEndpoint.PayloadMap =>
  new Map(
    Array.from(payload.entries(), ([contentType, value]) => {
      const [first, ...rest] = value.schemas;
      const schemas: [Schema.Top, ...Array<Schema.Top>] = [
        Schema.toCodecJson(first),
        ...rest.map((schema) => Schema.toCodecJson(schema)),
      ];

      return [
        contentType,
        {
          ...value,
          schemas,
        },
      ];
    }),
  );

const mapEndpoint = <TEndpoint extends HttpApiEndpoint.Top>(endpoint: TEndpoint): TEndpoint =>
  cloneWithPrototype(endpoint, {
    error: new Set(Array.from(endpoint.error, (schema) => Schema.toCodecJson(schema))),
    headers: mapOptionalSchema(endpoint.headers),
    params: mapOptionalSchema(endpoint.params),
    payload: mapPayloadSchemas(endpoint.payload),
    query: mapOptionalSchema(endpoint.query),
    success: new Set(Array.from(endpoint.success, (schema) => Schema.toCodecJson(schema))),
  });

const mapGroup = <TGroup extends HttpApiGroup.Top>(group: TGroup): TGroup =>
  cloneWithPrototype(group, {
    endpoints: Object.fromEntries(
      Object.entries(group.endpoints).map(([endpointName, endpoint]) => [
        endpointName,
        mapEndpoint(endpoint),
      ]),
    ),
  });

/**
 * Deep-clones an `HttpApi`, replacing every endpoint schema with its
 * JSON-compatible codec so the API can be served or consumed over transports
 * that only carry JSON. Prototypes are preserved, so the clone keeps behaving
 * like the original `HttpApi`, group, and endpoint instances.
 */
export const toJsonCompatibleApi = <TApi extends HttpApi.Top>(api: TApi): TApi =>
  cloneWithPrototype(api, {
    groups: Object.fromEntries(
      Object.entries(api.groups).map(([groupName, group]) => [groupName, mapGroup(group)]),
    ),
  });
