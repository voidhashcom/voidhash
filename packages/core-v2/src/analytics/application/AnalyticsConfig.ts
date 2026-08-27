import { Context, Layer, Schema } from "effect";

/** Runtime-independent analytics configuration validated at the application boundary. */
export const AnalyticsConfigSchema = Schema.Struct({
  edition: Schema.Literals(["cloud", "oss"]),
  providerEnvironments: Schema.Array(Schema.Int),
});

/** Configuration required by analytics capture and query services. */
export class AnalyticsConfig extends Context.Service<
  AnalyticsConfig,
  typeof AnalyticsConfigSchema.Type
>()("@voidhash/core-v2/analytics/AnalyticsConfig") {}

/**
 * Decode application configuration once and reuse the returned layer wherever
 * analytics services are composed so Effect can memoize it by reference.
 */
export const makeAnalyticsConfigLayer = (input: unknown) =>
  Layer.effect(AnalyticsConfig)(Schema.decodeUnknownEffect(AnalyticsConfigSchema)(input));
