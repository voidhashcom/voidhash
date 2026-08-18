import {
  ProductType,
  SubscriptionDuration,
  type ProductTypeValue,
  type SubscriptionDurationValue,
} from "@voidhash/lib";
import { Effect } from "effect";

/**
 * Public-facing product type label used by `ProductService` outputs. Matches
 * the API contract literal union; consumers map to richer client types
 * downstream as needed.
 */
export type ProductTypeLabel = "subscription" | "one-time" | "one-time-consumable";

export interface ProductView {
  readonly duration: SubscriptionDurationValue | null;
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
  duration: SubscriptionDurationValue | null,
): SubscriptionDurationLabel | null => {
  switch (duration) {
    case null:
      return null;
    case SubscriptionDuration.Weekly:
      return "weekly";
    case SubscriptionDuration.Monthly:
      return "monthly";
    case SubscriptionDuration.Quarterly:
      return "quarterly";
    case SubscriptionDuration.SemiAnnual:
      return "semi-annual";
    case SubscriptionDuration.Annual:
      return "annual";
  }
};

/**
 * A value outside the `ProductType` union can only reach here from a corrupt DB
 * row, so the exhaustiveness guard raises a defect. `Effect.die` is run
 * synchronously so this helper keeps its pure, synchronous signature.
 */
const invalidProductType = (type: ProductTypeValue): never =>
  Effect.runSync(Effect.die(new Error(`Invalid product type: ${type}`)));

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
