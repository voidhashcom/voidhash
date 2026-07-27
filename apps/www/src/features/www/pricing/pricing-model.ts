/**
 * Single source of truth for everything the pricing page quotes.
 *
 * The two metered features mirror the billing catalog (`tracked_revenue` and `events`); every
 * other entitlement is unlimited on all plans and is therefore only ever rendered as copy.
 */

/** Monthly base fee of the Grow plan, before any usage. */
export const GROW_BASE_PRICE = 29.99;

export type Meter = {
  readonly id: "trackedRevenue" | "events";
  readonly label: string;
  /** Short sentence explaining what the meter actually counts. */
  readonly description: string;
  /** How many meter units one `rate` charge covers. */
  readonly billingUnit: number;
  /** Renders one billing unit for the rate line, e.g. `100K events`. */
  readonly unitLabel: string;
  /** Flat price per `billingUnit` once the Grow allowance is used up. */
  readonly rate: number;
  /** Volume included on Free. Going past it is what moves you onto Grow. */
  readonly freeAllowance: number;
  /** Volume included in the Grow base fee. */
  readonly growAllowance: number;
  /**
   * Smallest non-zero volume the slider can land on.
   *
   * The track is logarithmic and so cannot express zero, which is where every slider starts —
   * the calculator reserves its first step for a literal 0 and scales from this floor upwards.
   */
  readonly sliderFloor: number;
  readonly sliderMax: number;
  /** Renders a raw volume for display, e.g. `1.2M` or `$25K`. */
  readonly formatVolume: (value: number) => string;
};

const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

/** Formats an invoice figure. Always two decimals, so a column of them lines up. */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
}

/** Formats a per-unit rate the way a price list reads it — `$6`, `$4.50` — never `$6.00`. */
export function formatRate(value: number): string {
  const cents = value % 1 === 0 ? 0 : 2;
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: cents,
    minimumFractionDigits: cents,
    style: "currency",
  });
}

/** Compact dollars, but spelled out below the point where `$1K` starts reading as a rounding. */
function formatDollarVolume(value: number): string {
  return value < 10_000 ? `$${value.toLocaleString("en-US")}` : `$${compact.format(value)}`;
}

export const TRACKED_REVENUE_METER: Meter = {
  billingUnit: 1_000,
  description:
    "Subscription and one-off revenue Voidhash validates, attributes and reports on each month.",
  formatVolume: formatDollarVolume,
  freeAllowance: 1_000,
  growAllowance: 10_000,
  id: "trackedRevenue",
  label: "Tracked revenue",
  rate: 8,
  sliderFloor: 100,
  sliderMax: 10_000_000,
  unitLabel: "$1,000 tracked",
};

export const EVENTS_METER: Meter = {
  billingUnit: 100_000,
  description: "Anything your SDK sends us — screen views, paywall impressions, purchases, taps.",
  formatVolume: (value) => compact.format(value),
  freeAllowance: 50_000,
  growAllowance: 1_000_000,
  id: "events",
  label: "Events",
  rate: 6,
  sliderFloor: 10_000,
  sliderMax: 500_000_000,
  unitLabel: "100K events",
};

/** Prices a monthly volume: everything past the Grow allowance at one flat rate. */
export function meterCost(meter: Meter, volume: number): number {
  const billable = Math.max(0, volume - meter.growAllowance);
  return (billable / meter.billingUnit) * meter.rate;
}

export type Estimate = {
  /** Which plan the quoted volumes actually land you on. */
  readonly plan: "free" | "grow";
  readonly base: number;
  readonly trackedRevenue: number;
  readonly events: number;
  readonly total: number;
};

/**
 * Prices a month at the given volumes.
 *
 * Volumes that fit inside the Free allowances cost nothing at all — the base fee only applies
 * once you have outgrown Free on at least one meter.
 */
export function estimate(revenueVolume: number, eventVolume: number): Estimate {
  const fitsOnFree =
    revenueVolume <= TRACKED_REVENUE_METER.freeAllowance &&
    eventVolume <= EVENTS_METER.freeAllowance;

  if (fitsOnFree) {
    return { base: 0, events: 0, plan: "free", total: 0, trackedRevenue: 0 };
  }

  const trackedRevenue = meterCost(TRACKED_REVENUE_METER, revenueVolume);
  const events = meterCost(EVENTS_METER, eventVolume);

  return {
    base: GROW_BASE_PRICE,
    events,
    plan: "grow",
    total: GROW_BASE_PRICE + trackedRevenue + events,
    trackedRevenue,
  };
}
