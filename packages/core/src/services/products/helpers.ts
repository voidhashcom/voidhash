import {
  ProductType,
  SubscriptionDuration,
  type ProductTypeValue,
  type SubscriptionDurationValue,
} from "@voidhash/lib";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/**
 * Public-facing product type label used by `ProductService` outputs. Matches
 * the API contract literal union; consumers map to richer client types
 * downstream as needed.
 */
export type ProductTypeLabel = "subscription" | "one-time" | "one-time-consumable";

export interface ProductView {
  readonly duration: Option.Option<SubscriptionDurationValue>;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly type: ProductTypeLabel;
}

export type SubscriptionDurationLabel =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semi-annual"
  | "annual";

/** Converts the stored subscription duration to its portable schema label. */
export const dbSubscriptionDurationToLabel = (
  duration: Option.Option<SubscriptionDurationValue>,
): Option.Option<SubscriptionDurationLabel> =>
  Option.map(duration, (value) => {
    if (value === SubscriptionDuration.Weekly) return "weekly";
    if (value === SubscriptionDuration.Monthly) return "monthly";
    if (value === SubscriptionDuration.Quarterly) return "quarterly";
    if (value === SubscriptionDuration.SemiAnnual) return "semi-annual";
    return "annual";
  });

/**
 * A value outside the `ProductType` union can only reach here from a corrupt DB
 * row, so the exhaustiveness guard raises a defect. `Effect.die` is run
 * synchronously so this helper keeps its pure, synchronous signature.
 */
const invalidProductType = (type: ProductTypeValue): never =>
  runSync(Effect.die(unexpectedError(`Invalid product type: ${type}`)));

export const dbProductTypeToLabel = (type: ProductTypeValue): ProductTypeLabel => {
  if (type === ProductType.Subscription) {
    return "subscription";
  }
  if (type === ProductType.OneTime) {
    return "one-time";
  }
  if (type === ProductType.OneTimeConsumable) {
    return "one-time-consumable";
  }
  return invalidProductType(type);
};
import { runSync, unexpectedError } from "../../effect-boundary.ts";
