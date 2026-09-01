import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as R from "effect/Record";
/**
 * Experiment treatment-type registry — the extensibility seam for the A/B
 * testing system. Each entry declares a kind of "change" an experiment can make
 * on some platform surface: its config shape (authoring validation) and how
 * that config compiles into the runtime payload baked onto the backing feature
 * flag's variant.
 *
 * The registry deliberately stops at `configSchema` + `compileToVariantPayload`.
 * It does NOT carry a serving-resolve closure or lifecycle hooks — those run in
 * structurally different runtimes per surface (a paywall resolve is a
 * synchronous SDK request; a notification is an async worker send) and would
 * re-couple every surface's runtime types into this one frontend-importable
 * module. Serving-resolve + showing wiring live in each surface's own service.
 *
 * This module is dependency-light (only `effect`'s `Schema` and `@voidhash/lib`
 * language helpers) so it can be imported from the frontend (`apps/www`), the
 * backend, and `@voidhash/core`.
 */
import * as Schema from "effect/Schema";

import { constant } from "@voidhash/lib/lang";

/** Platform surfaces an experiment treatment can bind to. Grows over time. */
export type ExperimentSurface = "paywall_location" | "notification_flow" | "automation";

/**
 * Config for a `paywall_location` treatment: which paywall to serve at a given
 * location for the owning variant. Deliberately names the paywall, not a
 * release — the treatment follows the paywall's active published version, so
 * shipping a new version updates the running test like it updates every other
 * placement.
 */
export const PaywallLocationTreatmentConfig = Schema.Struct({
  paywallLocationId: Schema.String,
  paywallId: Schema.String,
});
export type PaywallLocationTreatmentConfig = typeof PaywallLocationTreatmentConfig.Type;

/**
 * The runtime payload compiled onto a backing feature-flag variant and returned
 * verbatim by `evaluateFlagsBatch`. Keyed by location so ONE variant assignment
 * can serve a different paywall per location (cross-location consistency for a
 * multi-location experiment). Future surfaces add sibling keys (e.g.
 * `notificationFlowId`). `paywallReleaseId` only appears in payloads compiled
 * before treatments switched to tracking the active release — the serve path
 * still honours it there.
 */
export interface ExperimentVariantPayload {
  readonly byLocation?: Record<
    string,
    { readonly paywallId?: string; readonly paywallReleaseId?: string }
  >;
}

const isPaywallLocationTreatmentConfig = Schema.is(PaywallLocationTreatmentConfig);

const paywallLocationTreatment = constant({
  type: "paywall_location",
  name: "Paywall at a location",
  surface: "paywall_location",
  configSchema: PaywallLocationTreatmentConfig,
  // Configs arrive as `unknown` from the treatment rows (see
  // `compileVariantPayload`), so each entry narrows its own config shape at the
  // registry seam rather than the caller bridging the union.
  compileToVariantPayload: (configs: readonly unknown[]): Partial<ExperimentVariantPayload> => ({
    byLocation: R.fromEntries(
      configs
        .filter(isPaywallLocationTreatmentConfig)
        .map((c) => [c.paywallLocationId, { paywallId: c.paywallId }]),
    ),
  }),
});

/**
 * The registry of treatment types. Add an entry to make a new kind of
 * experiment change authorable and compilable. Adding a new *surface* also
 * requires a serving-resolve hook + a lifecycle branch in that surface's
 * service (see `ExperimentService`), plus a studio config picker.
 */
export const EXPERIMENT_TREATMENT_TYPES = constant({
  paywall_location: paywallLocationTreatment,
});

export type TreatmentType = keyof typeof EXPERIMENT_TREATMENT_TYPES;

/** Whether a string is a known treatment type. */
export const isTreatmentType = (t: string): t is TreatmentType =>
  Object.prototype.hasOwnProperty.call(EXPERIMENT_TREATMENT_TYPES, t);

/**
 * Fold a variant's treatment rows into the runtime payload baked onto its
 * backing feature-flag variant. Unknown treatment types are skipped. Configs
 * are assumed already validated (see `decodeTreatmentConfig`).
 */
export const compileVariantPayload = (
  treatments: ReadonlyArray<{ readonly treatmentType: string; readonly config: unknown }>,
): ExperimentVariantPayload => {
  const byType = Arr.reduce(
    treatments,
    HashMap.empty<TreatmentType, ReadonlyArray<unknown>>(),
    (groups, treatment) => {
      if (!isTreatmentType(treatment.treatmentType)) return groups;
      const configs = Option.getOrElse(HashMap.get(groups, treatment.treatmentType), () => []);
      return HashMap.set(groups, treatment.treatmentType, [...configs, treatment.config]);
    },
  );
  return HashMap.reduce(byType, {}, (payload, configs, type) => ({
    ...payload,
    ...EXPERIMENT_TREATMENT_TYPES[type].compileToVariantPayload(configs),
  }));
};

/** Decode + validate a treatment config against its type's schema. */
export const decodeTreatmentConfig = (type: TreatmentType, config: unknown) =>
  Schema.decodeUnknownEffect(EXPERIMENT_TREATMENT_TYPES[type].configSchema)(config);
