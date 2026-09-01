import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

/** Runtime-independent analytics configuration validated at the application boundary. */
export const AnalyticsConfigData = Schema.Struct({
  edition: Schema.Literals(["cloud", "oss"]),
  providerEnvironments: Schema.Array(Schema.Int),
});
export type AnalyticsConfigData = typeof AnalyticsConfigData.Type;

/** Configuration required by analytics capture and query services. */
export class AnalyticsConfig extends Context.Service<
  AnalyticsConfig,
  AnalyticsConfigData
>()("@voidhash/core-v2/analytics/AnalyticsConfig") {}

/**
 * Decode application configuration once and reuse the returned layer wherever
 * analytics services are composed so Effect can memoize it by reference.
 */
export const makeAnalyticsConfigLayer = (input: unknown) =>
  Layer.effect(AnalyticsConfig)(Schema.decodeUnknownEffect(AnalyticsConfigData)(input));
