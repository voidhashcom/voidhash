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
 * This module is dependency-light (only `effect`'s `Schema`) so it can be
 * imported from the frontend (`apps/www`), the backend, and `@voidhash/core`.
 */
import { Schema } from "effect";

/** Platform surfaces an experiment treatment can bind to. Grows over time. */
export type ExperimentSurface = "paywall_location" | "notification_flow" | "automation";

/** Config for a `paywall_location` treatment: which paywall release to serve at
 * a given location for the owning variant. */
export const PaywallLocationTreatmentConfigSchema = Schema.Struct({
  paywallLocationId: Schema.String,
  paywallId: Schema.String,
  paywallReleaseId: Schema.String,
});
export type PaywallLocationTreatmentConfig = typeof PaywallLocationTreatmentConfigSchema.Type;

/**
 * The runtime payload compiled onto a backing feature-flag variant and returned
 * verbatim by `evaluateFlagsBatch`. Keyed by location so ONE variant assignment
 * can serve a different paywall release per location (cross-location
 * consistency for a multi-location experiment). Future surfaces add sibling
 * keys (e.g. `notificationFlowId`).
 */
export interface ExperimentVariantPayload {
  readonly byLocation?: Record<string, { readonly paywallReleaseId: string }>;
}

const paywallLocationTreatment = {
  type: "paywall_location",
  name: "Paywall at a location",
  surface: "paywall_location",
  configSchema: PaywallLocationTreatmentConfigSchema,
  compileToVariantPayload: (
    configs: readonly PaywallLocationTreatmentConfig[],
  ): Partial<ExperimentVariantPayload> => ({
    byLocation: Object.fromEntries(
      configs.map((c) => [c.paywallLocationId, { paywallReleaseId: c.paywallReleaseId }]),
    ),
  }),
} as const;

/**
 * The registry of treatment types. Add an entry to make a new kind of
 * experiment change authorable and compilable. Adding a new *surface* also
 * requires a serving-resolve hook + a lifecycle branch in that surface's
 * service (see `ExperimentService`), plus a studio config picker.
 */
export const EXPERIMENT_TREATMENT_TYPES = {
  paywall_location: paywallLocationTreatment,
} as const;

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
  const payload: Record<string, unknown> = {};
  const byType = new Map<TreatmentType, unknown[]>();
  for (const t of treatments) {
    if (!isTreatmentType(t.treatmentType)) continue;
    const arr = byType.get(t.treatmentType) ?? [];
    arr.push(t.config);
    byType.set(t.treatmentType, arr);
  }
  for (const [type, configs] of byType) {
    // The registry value is union-typed across entries; each entry's compile
    // fn accepts its own config array — bridged here at the registry seam.
    const compile = EXPERIMENT_TREATMENT_TYPES[type].compileToVariantPayload as (
      configs: readonly unknown[],
    ) => Partial<ExperimentVariantPayload>;
    Object.assign(payload, compile(configs));
  }
  return payload as ExperimentVariantPayload;
};

/** Decode + validate a treatment config against its type's schema. */
export const decodeTreatmentConfig = (type: TreatmentType, config: unknown) =>
  Schema.decodeUnknownEffect(EXPERIMENT_TREATMENT_TYPES[type].configSchema)(config);
