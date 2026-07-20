export interface NormalizedApplePostback {
  readonly appId: string;
  readonly campaignId?: string;
  readonly coarseConversionValue?: "low" | "medium" | "high";
  readonly fidelityType?: number;
  readonly fineConversionValue?: number;
  readonly framework: "skan" | "ad-attribution-kit";
  readonly lockWindow?: boolean;
  readonly postbackSequenceIndex?: 0 | 1 | 2;
  readonly rawVersion: string;
  readonly redownload?: boolean;
  readonly sourceIdentifier?: string;
}

export interface ApplePostbackEvidence {
  readonly evidenceId: string;
  readonly normalized?: NormalizedApplePostback;
  readonly rawBody: Uint8Array;
  readonly receivedAt: string;
  readonly verification: "verified" | "failed" | "not-provided";
  readonly rejectionReason?: "invalid-json" | "invalid-shape" | "oversized";
}

export type ApplePostbackSignatureVerifier = (
  body: Uint8Array,
  signature: string,
) => boolean | Promise<boolean>;

const optionalInt = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) ? value : undefined;

/** Retains immutable raw Apple postback evidence and normalizes supported framework shapes. */
export const parseApplePostback = async (input: {
  readonly body: Uint8Array;
  readonly evidenceId: string;
  readonly framework: NormalizedApplePostback["framework"];
  readonly receivedAt: string;
  readonly signature?: string;
  readonly verifySignature?: ApplePostbackSignatureVerifier;
  readonly maximumBytes?: number;
}): Promise<ApplePostbackEvidence> => {
  const maximum = input.maximumBytes ?? 64 * 1024;
  if (input.body.byteLength > maximum) {
    return { evidenceId: input.evidenceId, rawBody: input.body.slice(), receivedAt: input.receivedAt, rejectionReason: "oversized", verification: "not-provided" };
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(new TextDecoder().decode(input.body));
  } catch {
    return { evidenceId: input.evidenceId, rawBody: input.body.slice(), receivedAt: input.receivedAt, rejectionReason: "invalid-json", verification: "not-provided" };
  }
  if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") {
    return { evidenceId: input.evidenceId, rawBody: input.body.slice(), receivedAt: input.receivedAt, rejectionReason: "invalid-shape", verification: "not-provided" };
  }
  const decoded = candidate as Record<string, unknown>;
  const appId = decoded["app-id"] ?? decoded.appId ?? decoded.advertisedItemId;
  const rawVersion = decoded.version;
  if (typeof appId !== "string" || appId.length === 0 || typeof rawVersion !== "string") {
    return { evidenceId: input.evidenceId, rawBody: input.body.slice(), receivedAt: input.receivedAt, rejectionReason: "invalid-shape", verification: "not-provided" };
  }
  const sequence = optionalInt(decoded["postback-sequence-index"] ?? decoded.postbackSequenceIndex);
  if (sequence !== undefined && ![0, 1, 2].includes(sequence)) {
    return { evidenceId: input.evidenceId, rawBody: input.body.slice(), receivedAt: input.receivedAt, rejectionReason: "invalid-shape", verification: "not-provided" };
  }
  const signature = input.signature ?? (typeof decoded.signature === "string" ? decoded.signature : undefined);
  const verification = signature && input.verifySignature
    ? await input.verifySignature(input.body, signature) ? "verified" : "failed"
    : "not-provided";
  const normalized: NormalizedApplePostback = {
    appId,
    campaignId: typeof decoded["campaign-id"] === "number" ? String(decoded["campaign-id"]) : undefined,
    coarseConversionValue: ["low", "medium", "high"].includes(String(decoded["coarse-conversion-value"]))
      ? decoded["coarse-conversion-value"] as "low" | "medium" | "high"
      : undefined,
    fidelityType: optionalInt(decoded["fidelity-type"]),
    fineConversionValue: optionalInt(decoded["conversion-value"] ?? decoded.fineConversionValue),
    framework: input.framework,
    lockWindow: typeof decoded["lock-window"] === "boolean" ? decoded["lock-window"] : undefined,
    postbackSequenceIndex: sequence as 0 | 1 | 2 | undefined,
    rawVersion,
    redownload: typeof decoded.redownload === "boolean" ? decoded.redownload : undefined,
    sourceIdentifier: typeof decoded["source-identifier"] === "string"
      ? decoded["source-identifier"]
      : typeof decoded.publisherItemId === "string" ? decoded.publisherItemId : undefined,
  };
  return { evidenceId: input.evidenceId, normalized, rawBody: input.body.slice(), receivedAt: input.receivedAt, verification };
};

export interface AppleConversionRuleVersion {
  readonly activeFrom: string;
  readonly activeTo?: string;
  readonly appId: string;
  readonly coarse: Readonly<Partial<Record<"low" | "medium" | "high", string>>>;
  readonly fine: Readonly<Record<number, string>>;
  readonly ruleVersion: string;
}

/** Selects the conversion rule active for the postback window and decodes its modeled meaning. */
export const decodeAppleConversion = (
  postback: NormalizedApplePostback,
  conversionWindowAt: string,
  rules: ReadonlyArray<AppleConversionRuleVersion>,
): { readonly ruleVersion?: string; readonly meaning?: string; readonly status: "decoded" | "unknown-rule" | "unknown-value" } => {
  const at = Date.parse(conversionWindowAt);
  const rule = rules.find((candidate) =>
    candidate.appId === postback.appId
      && Date.parse(candidate.activeFrom) <= at
      && (!candidate.activeTo || at < Date.parse(candidate.activeTo)),
  );
  if (!rule) return { status: "unknown-rule" };
  const meaning = postback.fineConversionValue === undefined
    ? postback.coarseConversionValue && rule.coarse[postback.coarseConversionValue]
    : rule.fine[postback.fineConversionValue];
  return meaning
    ? { meaning, ruleVersion: rule.ruleVersion, status: "decoded" }
    : { ruleVersion: rule.ruleVersion, status: "unknown-value" };
};

/** Builds an anonymous cohort key that cannot contain installation, person, or device identity. */
export const applePostbackCohortKey = (
  postback: NormalizedApplePostback,
  campaign: string,
  ruleVersion: string,
): string => [
  postback.appId,
  campaign,
  ruleVersion,
  postback.postbackSequenceIndex ?? 0,
].join(":");
