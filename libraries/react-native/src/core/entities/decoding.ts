import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

/*
 * Schema building blocks for the payloads the SDK reads but does not define:
 * the server's person snapshot and the store parts the native client sends as
 * JSON. They read forward-compatibly: a value a newer server or store adds
 * never fails decoding.
 */

/**
 * A string from a closed set the SDK knows. A value outside `values` decodes
 * as `"unknown"`, so a newer server or store never breaks decoding.
 */
export const enumOrUnknown = <const Value extends string>(values: ReadonlyArray<Value>) => {
  const isKnown = (value: string): value is Value => values.some((known) => known === value);
  return Schema.String.pipe(
    Schema.decodeTo(
      Schema.Literals([...values, "unknown"]),
      SchemaTransformation.transform<Value | "unknown", string>({
        decode: (value) => (isKnown(value) ? value : "unknown"),
        encode: (value) => value,
      }),
    ),
  );
};

/**
 * A string from a closed set the server names its own way (`app_store`),
 * decoded to the SDK's name for it (`appStore`). A value missing from `names`
 * decodes as `"unknown"`.
 */
export const renamedEnumOrUnknown = <const Value extends string>(
  names: Readonly<Record<string, Value>>,
) =>
  Schema.String.pipe(
    Schema.decodeTo(
      Schema.Literals([...R.values(names), "unknown"]),
      SchemaTransformation.transform<Value | "unknown", string>({
        decode: (wire) => Option.getOrElse(R.get(names, wire), () => "unknown" as const),
        encode: (value) =>
          Option.getOrElse(
            Arr.findFirst(R.toEntries(names), ([, name]) => name === value),
            () => [value, value] as const,
          )[0],
      }),
    ),
  );

/** A field the payload may send as `null` or leave out; either decodes as an absent key. */
export const optionalNullable = <S extends Schema.Top>(schema: S) =>
  Schema.optional(
    Schema.NullOr(schema).pipe(
      Schema.decodeTo(
        Schema.UndefinedOr(Schema.toType(schema)),
        // oxlint-disable-next-line effect/prefer-option-over-null -- the payload's own `null`, read as the absent key the SDK's types use.
        SchemaTransformation.transform<S["Type"] | undefined, S["Type"] | null>({
          decode: (value) => value ?? undefined,
          encode: (value) => value ?? null,
        }),
      ),
    ),
  );

/**
 * An ISO 8601 timestamp the payload may send, decoded as milliseconds since
 * the epoch. One that is `null`, left out, not a string, or that `Date`
 * cannot read decodes as an absent key: a date the SDK cannot read never
 * costs the entry it is on, so a grant with such an expiry still grants
 * access.
 */
export const OptionalEpochMillis = Schema.optional(
  Schema.Unknown.pipe(
    Schema.decodeTo(
      Schema.UndefinedOr(Schema.Finite),
      // oxlint-disable-next-line effect/prefer-option-over-null -- the payload's own `null`, read as the absent key the SDK's types use.
      SchemaTransformation.transform<number | undefined, unknown>({
        decode: (value) => {
          // oxlint-disable-next-line effect/use-clock-service -- parses a timestamp the server sent; no clock is read.
          const millis = P.isString(value) ? Date.parse(value) : Number.NaN;
          return Number.isFinite(millis) ? millis : undefined;
        },
        // oxlint-disable-next-line effect/use-clock-service -- formats a timestamp; no clock is read.
        encode: (millis) => (millis === undefined ? null : new Date(millis).toISOString()),
      }),
    ),
  ),
);
export type OptionalEpochMillis = typeof OptionalEpochMillis.Type;

/**
 * An array whose elements the SDK cannot read are left out, so one malformed
 * entry never costs the others.
 */
export const readableElements = <S extends Schema.Codec<unknown, unknown, never, never>>(
  element: S,
) => {
  const decodeElement = Schema.decodeUnknownOption(element);
  return Schema.Array(Schema.Unknown).pipe(
    Schema.decodeTo(
      Schema.Array(Schema.toType(element)),
      SchemaTransformation.transform<ReadonlyArray<S["Type"]>, ReadonlyArray<unknown>>({
        decode: (items) => Arr.getSomes(items.map((item) => decodeElement(item))),
        encode: (items) => items,
      }),
    ),
  );
};

/** A list the payload may leave out; decodes as empty then. */
export const listOrEmpty = <S extends Schema.Codec<unknown, unknown, never, never>>(element: S) =>
  readableElements(element).pipe(Schema.withDecodingDefaultKey(Effect.succeed([])));

/** A `Price` as the native client sends it. */
export const PriceValue = Schema.Struct({
  amount: Schema.Number,
  amountMicros: Schema.Number,
  currencyCode: Schema.String,
  formatted: Schema.String,
});
export type PriceValue = typeof PriceValue.Type;

/** A `Period` as the native client sends it. */
export const PeriodValue = Schema.Struct({
  unit: enumOrUnknown(["day", "week", "month", "year"]),
  count: Schema.Number,
  iso8601: Schema.String,
});
export type PeriodValue = typeof PeriodValue.Type;

/** A pricing phase's payment mode as the native client sends it. */
export const PaymentModeValue = enumOrUnknown(["freeTrial", "payAsYouGo", "payUpFront"]);

/** An environment as the native client sends it, in the SDK's names. */
export const EnvironmentValue = enumOrUnknown(["production", "sandbox", "xcode", "development"]);
