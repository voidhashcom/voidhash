import type { CollectionPolicy, ConsentSnapshot, PartnerSharingPolicy } from "./types";

export type MeasurementCollectionCategory =
  | "analytics"
  | "attribution"
  | "advertisingIdentifier"
  | "vendorIdentifier"
  | "networkMetadata"
  | "location"
  | "protectedEmail"
  | "protectedPhone"
  | "upload";

export interface MeasurementPolicyDecision {
  readonly allowed: boolean;
  readonly category: MeasurementCollectionCategory;
  readonly reason:
    | "allowed"
    | "collection-opt-out"
    | "consent-denied"
    | "disabled"
    | "manual-only"
    | "upload-paused";
}

/** Evaluates one collection input against configuration and the current consent revision. */
export const evaluateMeasurementCollection = (
  category: MeasurementCollectionCategory,
  policy: CollectionPolicy,
  consent: ConsentSnapshot,
  manuallySupplied = false,
): MeasurementPolicyDecision => {
  if (consent.collectionOptOut === true) return { allowed: false, category, reason: "collection-opt-out" };
  switch (category) {
    case "analytics":
      return policy.analytics === "enabled"
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "disabled" };
    case "attribution":
      return policy.attribution === "enabled"
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "disabled" };
    case "advertisingIdentifier":
      if (policy.advertisingIdentifiers === "denied") return { allowed: false, category, reason: "disabled" };
      return policy.advertisingIdentifiers === "allowed" || consent.adStorage === true
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "consent-denied" };
    case "vendorIdentifier":
      if (policy.vendorIdentifiers === "denied") return { allowed: false, category, reason: "disabled" };
      return policy.vendorIdentifiers === "allowed" || consent.dataUsage === true
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "consent-denied" };
    case "networkMetadata":
      return policy.networkMetadata === "allowed"
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "disabled" };
    case "location":
      if (policy.location === "denied") return { allowed: false, category, reason: "disabled" };
      return manuallySupplied
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "manual-only" };
    case "protectedEmail":
    case "protectedPhone":
      return consent.dataUsage === true
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "consent-denied" };
    case "upload":
      return policy.upload === "enabled"
        ? { allowed: true, category, reason: "allowed" }
        : { allowed: false, category, reason: "upload-paused" };
  }
};

export interface PartnerPayloadDecision<T extends Readonly<Record<string, unknown>>> {
  readonly allowed: boolean;
  readonly consentRevision: number;
  readonly payload?: Partial<T>;
  readonly reason: "allowed" | "partner-sharing-disabled" | "partner-excluded" | "consent-denied";
}

/** Applies send-time partner and field exclusions without mutating source evidence. */
export const filterPartnerPayload = <T extends Readonly<Record<string, unknown>>>(
  partner: string,
  payload: T,
  policy: PartnerSharingPolicy | undefined,
  consent: ConsentSnapshot,
): PartnerPayloadDecision<T> => {
  if (consent.collectionOptOut === true || consent.partnerSharingOptOut === true) {
    return { allowed: false, consentRevision: consent.revision, reason: "consent-denied" };
  }
  if (policy?.mode === "disabled") {
    return { allowed: false, consentRevision: consent.revision, reason: "partner-sharing-disabled" };
  }
  if (policy?.excludedPartners?.includes(partner)) {
    return { allowed: false, consentRevision: consent.revision, reason: "partner-excluded" };
  }
  const excluded = new Set(policy?.excludedFields?.[partner] ?? []);
  const filtered = Object.fromEntries(Object.entries(payload).filter(([key]) => !excluded.has(key))) as Partial<T>;
  return { allowed: true, consentRevision: consent.revision, payload: filtered, reason: "allowed" };
};
