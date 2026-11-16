import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";

/**
 * Values, nested ones included, that one event's properties may hold. No
 * product event comes close; an object graph passed by mistake (a press
 * event, a navigation or error object) runs to many thousands, and copying it
 * would hold up the thread that captured it.
 */
export const EVENT_PROPERTY_VALUE_LIMIT = 10_000;

class EventPropertyValueLimitExceeded extends Error {
  constructor() {
    super(`holds more than ${EVENT_PROPERTY_VALUE_LIMIT} values`);
  }
}

/**
 * Copies an event's properties into values JSON can always hold, the way
 * `JSON.stringify` would write them except where it would throw or write
 * nothing useful: a `bigint` becomes its decimal string, a non-finite number
 * `null`, and a reference back to an object that contains it is left out.
 * `undefined`, functions and symbols are left out (`null` inside an array),
 * and `toJSON` is honoured, so a `Date` becomes its ISO string.
 *
 * The copy is taken as the event is captured, so a host that mutates the
 * object afterwards does not change the queued event. Fails with the reason
 * when the properties cannot be copied at all: more than
 * {@link EVENT_PROPERTY_VALUE_LIMIT} values, or a getter or `toJSON` that
 * throws.
 */
export const toJsonSafeProperties = (
  properties: Record<string, unknown>,
): Result.Result<Record<string, unknown>, string> => {
  let remaining = EVENT_PROPERTY_VALUE_LIMIT;
  // By identity: a structural set would hash, and so read, the host's whole
  // object graph.
  const ancestors = new WeakSet<object>();

  const copy = (value: unknown): Option.Option<unknown> => {
    remaining -= 1;
    if (remaining < 0) throw new EventPropertyValueLimitExceeded();
    if (P.isString(value) || P.isBoolean(value)) return Option.some(value);
    // oxlint-disable-next-line effect/prefer-option-over-null -- JSON `null` is the value written for a number JSON cannot hold.
    if (P.isNumber(value)) return Option.some(Number.isFinite(value) ? value : null);
    if (P.isBigInt(value)) return Option.some(value.toString());
    // oxlint-disable-next-line effect/prefer-option-over-null -- JSON `null` is a property value like any other.
    if (P.isNull(value)) return Option.some(null);
    // Functions, symbols and `undefined` have no JSON form.
    return P.isObjectOrArray(value) ? copyObject(value) : Option.none();
  };

  const copyEntries = (value: object): Option.Option<unknown> => {
    if (Array.isArray(value)) {
      // oxlint-disable-next-line effect/prefer-option-over-null -- JSON writes `null` for an array item it cannot hold.
      return Option.some(value.map((item: unknown) => Option.getOrNull(copy(item))));
    }
    if (!P.isObject(value)) return Option.none();
    return Option.some(
      R.fromEntries(
        R.keys(value).flatMap((key) =>
          Arr.fromOption(Option.map(copy(value[key]), (item) => [key, item] as const)),
        ),
      ),
    );
  };

  const copyObject = (value: object): Option.Option<unknown> => {
    if (ancestors.has(value)) return Option.none();
    ancestors.add(value);
    const toJson = Reflect.get(value, "toJSON");
    const json: unknown = P.isFunction(toJson) ? Reflect.apply(toJson, value, []) : value;
    const copied = json === value ? copyEntries(value) : copy(json);
    ancestors.delete(value);
    return copied;
  };

  return Result.try({
    catch: (error) =>
      error instanceof EventPropertyValueLimitExceeded
        ? error.message
        : `could not be read${P.isError(error) ? ` (${error.message})` : ""}`,
    try: () => Option.getOrElse(Option.filter(copy(properties), P.isObject), () => ({})),
  });
};
