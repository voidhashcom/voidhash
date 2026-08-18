import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import type { MeasurementDebugState } from "./types";
import { assertSafePublicValue } from "./protected-fields";

export interface MeasurementSupportBundle {
  readonly generatedAt: string;
  readonly versions: MeasurementDebugState["versions"];
  readonly installationHash: string;
  readonly sessionHash?: string;
  readonly readiness: MeasurementDebugState["session"]["readiness"];
  readonly outbox: {
    readonly counts: MeasurementDebugState["outbox"]["counts"];
    readonly total: number;
    readonly oldestAgeMs?: number;
    readonly lastDelivery?: {
      readonly outcome: NonNullable<MeasurementDebugState["outbox"]["lastDelivery"]>["outcome"];
      readonly reason?: string;
      readonly attemptCount: number;
    };
  };
  readonly consent: MeasurementDebugState["consent"]["effective"] & { readonly revision: number };
  readonly configuration: {
    readonly revision: number;
    readonly startMode: MeasurementDebugState["configuration"]["startMode"];
    readonly trustedConfigKeyIds: ReadonlyArray<string>;
    readonly signed?: MeasurementDebugState["configuration"]["signed"];
  };
  readonly collectors: ReadonlyArray<{
    readonly capability: keyof MeasurementDebugState["collectors"];
    readonly state: MeasurementDebugState["collectors"][keyof MeasurementDebugState["collectors"]];
  }>;
  readonly manifest: MeasurementDebugState["manifest"];
  readonly deletion: MeasurementDebugState["deletion"];
  readonly testDevice: boolean;
}

const hashId = (value: string): string =>
  bytesToHex(sha256(new TextEncoder().encode(`voidhash-support:${value}`))).slice(0, 24);

/** Builds the opt-in diagnostic document and enforces the public-field classifier on the result. */
export const buildMeasurementSupportBundle = (
  state: MeasurementDebugState,
  now: Date = new Date(),
): MeasurementSupportBundle => {
  const bundle: MeasurementSupportBundle = {
    generatedAt: now.toISOString(),
    versions: state.versions,
    installationHash: hashId(state.installation.id),
    sessionHash: state.session.current ? hashId(state.session.current.id) : undefined,
    readiness: state.session.readiness,
    outbox: {
      counts: state.outbox.counts,
      total: state.outbox.total,
      oldestAgeMs: state.outbox.oldestAgeMs,
      lastDelivery: state.outbox.lastDelivery && {
        outcome: state.outbox.lastDelivery.outcome,
        reason: state.outbox.lastDelivery.reason,
        attemptCount: state.outbox.lastDelivery.attemptCount,
      },
    },
    consent: { ...state.consent.effective, revision: state.consent.snapshot.revision },
    configuration: {
      revision: state.configuration.revision,
      startMode: state.configuration.startMode,
      trustedConfigKeyIds: state.configuration.endpoints.trustedConfigKeyIds,
      signed: state.configuration.signed,
    },
    collectors: Object.entries(state.collectors).map(([capability, collectorState]) => ({
      capability: capability as keyof MeasurementDebugState["collectors"],
      state: collectorState,
    })),
    manifest: state.manifest,
    deletion: state.deletion,
    testDevice: state.testDevice,
  };
  assertSafePublicValue(bundle, "supportBundle");
  return bundle;
};
