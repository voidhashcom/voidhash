/**
 * Analytics-owned internal event contract composed from producer-owned event
 * contracts. Revenue event shapes live with purchases; analytics adds its own
 * experiment event and validates the combined trusted stream here.
 */
import { constant } from "@voidhash/lib/lang";
import * as HashSet from "effect/HashSet";
import * as Schema from "effect/Schema";

import {
  isReservedRevenueEventName,
  REVENUE_TRUSTED_SOURCE_TOPIC,
  RevenueEvent,
} from "../../purchases/contract/RevenueEvents.ts";

export * from "../../purchases/contract/RevenueEvents.ts";

/** Event names explicitly exempt from the SDK capture quota. */
export const TRUST_BYPASS_QUOTA = HashSet.empty<string>();

/** Returns whether the event's trust class or name bypasses capture quota. */
export const shouldBypassQuota = (input: {
  readonly trustClass?: string;
  readonly eventName: string;
}) => input.trustClass === "trusted-revenue" || HashSet.has(TRUST_BYPASS_QUOTA, input.eventName);

/** Trusted source topic for server-emitted experiment exposures. */
export const EXPERIMENT_TRUSTED_SOURCE_TOPIC = constant("experiment.trusted.v1");

/** Whether an event's trust marker, reserved name, and source topic form a valid server source. */
export const isTrustedInternalAnalyticsEventSource = (input: {
  readonly eventName: string;
  readonly sourceTopic: string;
  readonly trustClass?: string;
}): boolean =>
  (input.trustClass === "trusted-revenue" &&
    isReservedRevenueEventName(input.eventName) &&
    input.sourceTopic === REVENUE_TRUSTED_SOURCE_TOPIC) ||
  (input.trustClass === "trusted-internal" &&
    input.eventName === "$experiment.exposed" &&
    input.sourceTopic === EXPERIMENT_TRUSTED_SOURCE_TOPIC);

/** Server-emitted experiment assignment recorded when a paywall is resolved. */
export const ExperimentExposed = Schema.Struct({
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  distinctId: Schema.String,
  eventId: Schema.String,
  eventName: Schema.Literal("$experiment.exposed"),
  occurredAt: Schema.Date,
  organizationId: Schema.String,
  personId: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  properties: Schema.Struct({
    experimentId: Schema.String,
    variantKey: Schema.String,
  }),
  token: Schema.String,
});
export type ExperimentExposed = typeof ExperimentExposed.Type;

/** All server-trusted internal analytics events accepted by the processor. */
export const InternalAnalyticsEvent = Schema.Union([ExperimentExposed, RevenueEvent]);
export type InternalAnalyticsEvent = typeof InternalAnalyticsEvent.Type;

/** Maps an internal event to the trusted source topic stamped on its envelope. */
export const sourceTopicForInternalAnalyticsEvent = (event: typeof InternalAnalyticsEvent.Type) => {
  if (event.eventName === "$experiment.exposed") return EXPERIMENT_TRUSTED_SOURCE_TOPIC;
  return REVENUE_TRUSTED_SOURCE_TOPIC;
};

export { ExperimentExposed as ExperimentExposedSchema };
export { InternalAnalyticsEvent as InternalAnalyticsEventSchema };
