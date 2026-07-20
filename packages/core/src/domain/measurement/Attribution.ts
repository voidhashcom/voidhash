export interface AttributionCampaign {
  readonly campaign?: string;
  readonly channel?: string;
  readonly mediaSource?: string;
  readonly ad?: string;
  readonly adSet?: string;
}

export type AttributionTouchpointKind =
  | "install-referrer"
  | "deferred-token"
  | "cohort"
  | "push-open"
  | "deep-link";

export interface AttributionTouchpoint {
  readonly campaign: AttributionCampaign;
  readonly deterministic: boolean;
  readonly evidenceId: string;
  readonly kind: AttributionTouchpointKind;
  readonly occurredAt: string;
  readonly reengagement?: boolean;
}

export interface AttributionRuleSet {
  readonly lookbackMs: number;
  readonly modelVersion: string;
  readonly priorities: ReadonlyArray<AttributionTouchpointKind>;
  readonly ruleVersion: string;
}

export interface AttributionReasonStep {
  readonly evidenceId: string;
  readonly outcome: "won" | "lower-priority" | "outside-lookback" | "not-eligible";
  readonly rule: AttributionTouchpointKind;
}

export interface VersionedAttributionDecision {
  readonly campaign?: AttributionCampaign;
  readonly confidence: "deterministic" | "probabilistic" | "organic";
  readonly decidedAt: string;
  readonly decisionId: string;
  readonly deterministic: boolean;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly kind: "install" | "reengagement" | "organic";
  readonly lookbackMs: number;
  readonly modelVersion: string;
  readonly priorityRules: ReadonlyArray<AttributionTouchpointKind>;
  readonly reasonTrace: ReadonlyArray<AttributionReasonStep>;
  readonly ruleVersion: string;
  readonly status: "active" | "fraud-flagged" | "superseded";
  readonly supersededDecisionId?: string;
}

export interface AttributionEvaluationInput {
  readonly decisionId: string;
  readonly decisionTime: string;
  readonly kind: "install" | "reengagement";
  readonly ruleSet: AttributionRuleSet;
  readonly subjectOccurredAt: string;
  readonly supersededDecisionId?: string;
  readonly touchpoints: ReadonlyArray<AttributionTouchpoint>;
}

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid attribution timestamp: ${value}`);
  return parsed;
};

/** Evaluates attribution using only injected evidence, rule version, and decision time. */
export const evaluateAttribution = (input: AttributionEvaluationInput): VersionedAttributionDecision => {
  if (!Number.isSafeInteger(input.ruleSet.lookbackMs) || input.ruleSet.lookbackMs < 0) {
    throw new RangeError("Attribution lookback must be a non-negative safe integer");
  }
  const subjectAt = timestamp(input.subjectOccurredAt);
  const priority = new Map(input.ruleSet.priorities.map((kind, index) => [kind, index]));
  const evaluated = input.touchpoints.map((touchpoint) => {
    const age = subjectAt - timestamp(touchpoint.occurredAt);
    const eligibleKind = input.kind === "install"
      ? !touchpoint.reengagement && !["push-open", "deep-link"].includes(touchpoint.kind)
      : touchpoint.reengagement === true && ["push-open", "deep-link"].includes(touchpoint.kind);
    const eligible = eligibleKind && age >= 0 && age <= input.ruleSet.lookbackMs && priority.has(touchpoint.kind);
    return { age, eligible, priority: priority.get(touchpoint.kind) ?? Number.MAX_SAFE_INTEGER, touchpoint };
  });
  const candidates = evaluated.filter(({ eligible }) => eligible).sort((left, right) =>
    left.priority - right.priority
      || right.touchpoint.occurredAt.localeCompare(left.touchpoint.occurredAt)
      || left.touchpoint.evidenceId.localeCompare(right.touchpoint.evidenceId),
  );
  const winner = candidates[0]?.touchpoint;
  const reasonTrace: AttributionReasonStep[] = evaluated
    .sort((left, right) => left.touchpoint.evidenceId.localeCompare(right.touchpoint.evidenceId))
    .map(({ age, eligible, touchpoint }) => ({
      evidenceId: touchpoint.evidenceId,
      outcome: !eligible
        ? age < 0 || age > input.ruleSet.lookbackMs
          ? "outside-lookback"
          : "not-eligible"
        : touchpoint.evidenceId === winner?.evidenceId
          ? "won"
          : "lower-priority",
      rule: touchpoint.kind,
    }));
  return {
    campaign: winner?.campaign,
    confidence: winner ? (winner.deterministic ? "deterministic" : "probabilistic") : "organic",
    decidedAt: input.decisionTime,
    decisionId: input.decisionId,
    deterministic: winner?.deterministic ?? true,
    evidenceIds: winner ? [winner.evidenceId] : [],
    kind: winner ? input.kind : "organic",
    lookbackMs: input.ruleSet.lookbackMs,
    modelVersion: input.ruleSet.modelVersion,
    priorityRules: [...input.ruleSet.priorities],
    reasonTrace,
    ruleVersion: input.ruleSet.ruleVersion,
    status: "active",
    supersededDecisionId: input.supersededDecisionId,
  };
};

/** Appends a deterministic recomputation and returns an immutable superseded projection. */
export const recomputeAttribution = (
  previous: VersionedAttributionDecision,
  input: Omit<AttributionEvaluationInput, "supersededDecisionId">,
): { readonly previous: VersionedAttributionDecision; readonly current: VersionedAttributionDecision } => ({
  previous: { ...previous, status: "superseded" },
  current: evaluateAttribution({ ...input, supersededDecisionId: previous.decisionId }),
});

/** Projects a decision to the protected-field-free SDK correlation response. */
export const toSafeAttributionResponse = (decision: VersionedAttributionDecision) => ({
  campaign: decision.campaign,
  decisionId: decision.decisionId,
  deferred: decision.kind === "install" && decision.evidenceIds.length > 0,
  deterministic: decision.deterministic,
  direct: decision.kind === "reengagement",
  kind: decision.kind,
  modelVersion: decision.modelVersion,
  reason: decision.reasonTrace.find(({ outcome }) => outcome === "won")?.rule ?? "organic",
});
