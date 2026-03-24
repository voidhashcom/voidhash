import { Schema } from "effect";
import type { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const cloneWithPrototype = <T extends object>(
  value: T,
  properties: Record<string, unknown>
): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, properties) as T;

const mapPayloadSchemas = (
  payload: HttpApiEndpoint.AnyWithProps["payload"]
): HttpApiEndpoint.AnyWithProps["payload"] =>
  new Map(
    Array.from(payload.entries(), ([contentType, value]) => [
      contentType,
      {
        ...value,
        schemas: value.schemas.map((schema) => Schema.toCodecJson(schema)) as typeof value.schemas,
      },
    ])
  );

const mapEndpoint = <TEndpoint extends HttpApiEndpoint.AnyWithProps>(
  endpoint: TEndpoint
): TEndpoint =>
  cloneWithPrototype(endpoint, {
    error: new Set(
      Array.from(endpoint.error, (schema) => Schema.toCodecJson(schema))
    ) as TEndpoint["error"],
    headers: endpoint.headers ? Schema.toCodecJson(endpoint.headers) : undefined,
    params: endpoint.params ? Schema.toCodecJson(endpoint.params) : undefined,
    payload: mapPayloadSchemas(endpoint.payload) as TEndpoint["payload"],
    query: endpoint.query ? Schema.toCodecJson(endpoint.query) : undefined,
    success: new Set(
      Array.from(endpoint.success, (schema) => Schema.toCodecJson(schema))
    ) as TEndpoint["success"],
  });

const mapGroup = <TGroup extends HttpApiGroup.AnyWithProps>(group: TGroup): TGroup =>
  cloneWithPrototype(group, {
    endpoints: Object.fromEntries(
      Object.entries(group.endpoints).map(([endpointName, endpoint]) => [
        endpointName,
        mapEndpoint(endpoint as HttpApiEndpoint.AnyWithProps),
      ])
    ) as TGroup["endpoints"],
  });

export const toJsonCompatibleApi = <TApi extends HttpApi.Any>(api: TApi): TApi =>
  cloneWithPrototype(api, {
    groups: Object.fromEntries(
      Object.entries((api as TApi & { groups: Record<string, HttpApiGroup.AnyWithProps> }).groups).map(([groupName, group]) => [
        groupName,
        mapGroup(group as HttpApiGroup.AnyWithProps),
      ])
    ),
  });
