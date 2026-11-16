import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/**
 * Product durations the server sends today. Decoded definitions accept any
 * string in their `duration` fields, so a duration added by a newer server
 * keeps its product readable; code that relies on the duration treats a
 * value outside this list as no duration.
 */
export const RuntimeProductDuration = Schema.Literals([
  "weekly",
  "monthly",
  "quarterly",
  "semi-annual",
  "annual",
]);
export type RuntimeProductDuration = typeof RuntimeProductDuration.Type;

/**
 * An offer of a product on one store: `id` is how paywalls and apps name it
 * (the same on every store), `offerId` the store's identifier.
 */
export const RuntimeStoreOffer = Schema.Struct({
  id: Schema.String,
  offerId: Schema.String,
});
export type RuntimeStoreOffer = typeof RuntimeStoreOffer.Type;

export const RuntimeAppleAppStoreProductConfiguration = Schema.Struct({
  offers: Schema.optional(Schema.Array(RuntimeStoreOffer)),
  productId: Schema.String,
});
export type RuntimeAppleAppStoreProductConfiguration =
  typeof RuntimeAppleAppStoreProductConfiguration.Type;

export const RuntimeGooglePlayProductConfiguration = Schema.Struct({
  basePlanId: Schema.optional(Schema.String),
  /** Developer offers on the base plan. */
  offers: Schema.optional(Schema.Array(RuntimeStoreOffer)),
  productId: Schema.String,
});
export type RuntimeGooglePlayProductConfiguration =
  typeof RuntimeGooglePlayProductConfiguration.Type;

/**
 * Development-mode pricing. `currencyCode` and `period` are plain strings so
 * a currency or period added by a newer server keeps the product readable.
 */
export const RuntimeDevelopmentProductConfiguration = Schema.Struct({
  currencyCode: Schema.String,
  duration: Schema.OptionFromNullOr(Schema.String),
  period: Schema.String,
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

/**
 * One product. `type` is a plain string (the server sends `subscription`,
 * `one-time` or `one-time-consumable` today) so a product type added by a
 * newer server keeps the product readable: only `one-time-consumable` is
 * ever consumed, anything else is finished as a non-consumable.
 */
export const RuntimeProductDefinition = Schema.Struct({
  configuration: Schema.Struct({
    perks: Schema.Record(Schema.String, Schema.Literal(true)),
    providers: RuntimeProductProviders,
  }),
  duration: Schema.optional(Schema.OptionFromNullOr(Schema.String)),
  id: Schema.optional(Schema.String),
  properties: Schema.Struct({ name: Schema.String }),
  slug: Schema.String,
  type: Schema.String,
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
