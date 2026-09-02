import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const cloneWithPrototype = <T extends object>(value: T, properties: Record<string, unknown>): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, properties);

/** Maps an optional endpoint schema to its JSON-compatible codec. */
const mapOptionalSchema = (schema?: Schema.Top) => {
  if (!schema) {
    return undefined;
  }

  return Schema.toCodecJson(schema);
};

const readonlyMap = <Key, Value>(
  entries: Iterable<readonly [Key, Value]>,
): ReadonlyMap<Key, Value> => {
  const values = HashMap.fromIterable(entries);
  const view: ReadonlyMap<Key, Value> = {
    [Symbol.iterator]: () => Array.from(values)[Symbol.iterator](),
    entries: () => Array.from(values)[Symbol.iterator](),
    forEach: (callback, thisArg) =>
      HashMap.forEach(values, (value, key) => callback.call(thisArg, value, key, view)),
    get: (key) => Option.getOrUndefined(HashMap.get(values, key)),
    has: (key) => HashMap.has(values, key),
    keys: () => Array.from(values, ([key]) => key)[Symbol.iterator](),
    size: HashMap.size(values),
    values: () => Array.from(values, ([, value]) => value)[Symbol.iterator](),
  };
  return view;
};

const readonlySet = <Value>(entries: Iterable<Value>): ReadonlySet<Value> => {
  const values = HashSet.fromIterable(entries);
  const view: ReadonlySet<Value> = {
    [Symbol.iterator]: () => Array.from(values)[Symbol.iterator](),
    entries: () =>
      Arr.map(Array.from(values), (value): [Value, Value] => [value, value])[Symbol.iterator](),
    forEach: (callback, thisArg) =>
      Arr.forEach(Array.from(values), (value) => callback.call(thisArg, value, value, view)),
    has: (value) => HashSet.has(values, value),
    keys: () => Array.from(values)[Symbol.iterator](),
    size: HashSet.size(values),
    values: () => Array.from(values)[Symbol.iterator](),
  };
  return view;
};

const mapPayloadSchemas = (payload: HttpApiEndpoint.PayloadMap): HttpApiEndpoint.PayloadMap =>
  readonlyMap(
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
    error: readonlySet(Array.from(endpoint.error, (schema) => Schema.toCodecJson(schema))),
    headers: mapOptionalSchema(endpoint.headers),
    params: mapOptionalSchema(endpoint.params),
    payload: mapPayloadSchemas(endpoint.payload),
    query: mapOptionalSchema(endpoint.query),
    success: readonlySet(Array.from(endpoint.success, (schema) => Schema.toCodecJson(schema))),
  });

const mapGroup = <TGroup extends HttpApiGroup.Top>(group: TGroup): TGroup =>
  cloneWithPrototype(group, {
    endpoints: R.fromEntries(
      R.toEntries(group.endpoints).map(([endpointName, endpoint]) => [
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
    groups: R.fromEntries(
      R.toEntries(api.groups).map(([groupName, group]) => [groupName, mapGroup(group)]),
    ),
  });
