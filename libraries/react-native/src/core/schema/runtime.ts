import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** Product durations accepted by the runtime schema. */
export const RuntimeProductDuration = Schema.Literals([
  "weekly",
  "monthly",
  "quarterly",
  "semi-annual",
  "annual",
]);
export type RuntimeProductDuration = typeof RuntimeProductDuration.Type;

export const RuntimeAppleAppStoreProductConfiguration = Schema.Struct({
  productId: Schema.String,
});
export type RuntimeAppleAppStoreProductConfiguration =
  typeof RuntimeAppleAppStoreProductConfiguration.Type;

export const RuntimeGooglePlayProductConfiguration = Schema.Struct({
  basePlanId: Schema.optional(Schema.String),
  productId: Schema.String,
});
export type RuntimeGooglePlayProductConfiguration =
  typeof RuntimeGooglePlayProductConfiguration.Type;

export const RuntimeDevelopmentProductConfiguration = Schema.Struct({
  currencyCode: Schema.Literal("USD"),
  duration: Schema.OptionFromNullOr(RuntimeProductDuration),
  period: Schema.Literals(["week", "month", "year", "lifetime"]),
  periodCount: Schema.Number,
  price: Schema.Number,
  priceInMinorUnits: Schema.Number,
  productId: Schema.String,
  warning: Schema.OptionFromNullOr(Schema.String),
});
export type RuntimeDevelopmentProductConfiguration =
  typeof RuntimeDevelopmentProductConfiguration.Type;

export const RuntimeProductProviders = Schema.Struct({
  appleAppStore: Schema.optional(RuntimeAppleAppStoreProductConfiguration),
  development: Schema.optional(RuntimeDevelopmentProductConfiguration),
  googlePlay: Schema.optional(RuntimeGooglePlayProductConfiguration),
});
export type RuntimeProductProviders = typeof RuntimeProductProviders.Type;

export const RuntimeProductDefinition = Schema.Struct({
  configuration: Schema.Struct({
    perks: Schema.Record(Schema.String, Schema.Literal(true)),
    providers: RuntimeProductProviders,
  }),
  duration: Schema.optional(Schema.OptionFromNullOr(RuntimeProductDuration)),
  id: Schema.optional(Schema.String),
  properties: Schema.Struct({ name: Schema.String }),
  slug: Schema.String,
  type: Schema.Literals(["subscription", "one-time", "one-time-consumable"]),
});
export type RuntimeProductDefinition = typeof RuntimeProductDefinition.Type;

export const RuntimePaywallLocationDefinition = Schema.Struct({
  description: Schema.OptionFromNullOr(Schema.String).pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed(Option.none())),
  ),
  name: Schema.String,
  slug: Schema.String,
});
export type RuntimePaywallLocationDefinition = typeof RuntimePaywallLocationDefinition.Type;

export const RuntimePerkDefinition = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
});
export type RuntimePerkDefinition = typeof RuntimePerkDefinition.Type;

/**
 * The full schema fetched from the server, decoded so nullable wire fields
 * are represented as `Option` inside the SDK.
 */
export const RuntimeSchemaValue = Schema.Struct({
  locations: Schema.Record(Schema.String, RuntimePaywallLocationDefinition),
  perks: Schema.Record(Schema.String, RuntimePerkDefinition),
  products: Schema.Record(Schema.String, RuntimeProductDefinition),
  version: Schema.String,
});
export type RuntimeSchemaValue = typeof RuntimeSchemaValue.Type;
export type RuntimeSchema = RuntimeSchemaValue;
export type RuntimeSchemaEncoded = typeof RuntimeSchemaValue.Encoded;

export const createEmptyRuntimeSchema = (): RuntimeSchema => ({
  locations: {},
  perks: {},
  products: {},
  version: "",
});
