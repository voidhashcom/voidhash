export interface PartnerCatalogEntry {
  readonly endpoint: string;
  readonly fieldMapping: Readonly<Record<string, string>>;
  readonly partner: string;
  readonly requiredFields: ReadonlyArray<string>;
}

export interface PartnerPostbackPolicy {
  readonly anonymize: boolean;
  readonly consentRevision: number;
  readonly deleted: boolean;
  readonly excludedFields?: ReadonlyArray<string>;
  readonly excludedPartners?: ReadonlyArray<string>;
  readonly partnerSharing: boolean;
}

export interface PartnerPostbackPlan {
  readonly audit: {
    readonly consentRevision: number;
    readonly filteredFields: ReadonlyArray<string>;
    readonly partner: string;
    readonly reason: string;
    readonly result: "ready" | "suppressed";
    readonly triggerId: string;
  };
  readonly idempotencyKey: string;
  readonly request?: {
    readonly endpoint: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly payload: Readonly<Record<string, unknown>>;
  };
}

const protectedField = /(?:email|phone|receipt|token|raw|url|idfa|gaid|advertising.?id)/i;

/** Builds an allowlisted postback request after evaluating current send-time policy. */
export const planPartnerPostback = (
  catalog: PartnerCatalogEntry,
  triggerId: string,
  trigger: Readonly<Record<string, unknown>>,
  partnerData: Readonly<Record<string, unknown>>,
  policy: PartnerPostbackPolicy,
): PartnerPostbackPlan => {
  const idempotencyKey = `${catalog.partner}:${triggerId}`;
  const suppress = (reason: string): PartnerPostbackPlan => ({
    audit: {
      consentRevision: policy.consentRevision,
      filteredFields: [],
      partner: catalog.partner,
      reason,
      result: "suppressed",
      triggerId,
    },
    idempotencyKey,
  });
  if (policy.deleted) return suppress("subject-deleted");
  if (!policy.partnerSharing) return suppress("partner-sharing-opt-out");
  if (policy.excludedPartners?.includes(catalog.partner)) return suppress("partner-excluded");

  const excluded = new Set(policy.excludedFields ?? []);
  const payload: Record<string, unknown> = {};
  const filteredFields: string[] = [];
  for (const [source, destination] of Object.entries(catalog.fieldMapping)) {
    if (excluded.has(source) || protectedField.test(source) || protectedField.test(destination)) {
      filteredFields.push(source);
      continue;
    }
    const value = source.startsWith("partnerData.")
      ? partnerData[source.slice("partnerData.".length)]
      : trigger[source];
    if (value !== undefined) payload[destination] = value;
  }
  if (policy.anonymize && typeof payload.distinctId === "string") {
    payload.distinctId = `anonymous:${idempotencyKey}`;
  }
  const missing = catalog.requiredFields.filter((field) => payload[field] === undefined);
  if (missing.length > 0) return suppress(`missing-required:${missing.sort().join(",")}`);
  return {
    audit: {
      consentRevision: policy.consentRevision,
      filteredFields: filteredFields.sort(),
      partner: catalog.partner,
      reason: "allowed",
      result: "ready",
      triggerId,
    },
    idempotencyKey,
    request: {
      endpoint: catalog.endpoint,
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      payload,
    },
  };
};

/** Computes a bounded deterministic retry delay while honoring Retry-After. */
export const partnerPostbackRetryDelay = (
  attempt: number,
  retryAfterMs: number | undefined,
  maximumAttempts = 8,
): number | undefined => {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= maximumAttempts) return undefined;
  const exponential = Math.min(60 * 60 * 1_000, 1_000 * 2 ** attempt);
  return Math.max(exponential, retryAfterMs ?? 0);
};
