import { DateTime } from "effect";

export interface SnapshotResources {
  readonly pendingOverrideDictionaryName: string;
  readonly pendingOverrideSnapshotName: string;
}

export const sanitizeIdentifier = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9_]/g, "_");

/** Build isolated resource names for one identity snapshot run. */
export const makeSnapshotResources = (runId: string): SnapshotResources => {
  const suffix = sanitizeIdentifier(runId.replaceAll("-", ""));
  return {
    pendingOverrideDictionaryName: `person_identity_pending_override_dict_${suffix}`,
    pendingOverrideSnapshotName: `person_identity_pending_override_snapshot_${suffix}`,
  };
};

/** Compute the stable cutoff before which pending identity overrides can be squashed. */
export const computeCutoffIso = (input: {
  readonly now: Date;
  readonly safetyWindowSeconds: number;
}): string =>
  DateTime.formatIso(DateTime.makeUnsafe(input.now.getTime() - input.safetyWindowSeconds * 1000));
