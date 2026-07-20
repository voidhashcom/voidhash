export interface FraudEvidence {
  readonly campaign?: string;
  readonly clickId?: string;
  readonly evidenceId: string;
  readonly installReferrerClickId?: string;
  readonly kind: "click" | "install" | "token-replay";
  readonly linkId?: string;
  readonly occurredAt: string;
}

export interface FraudRuleSet {
  readonly maximumClicksPerWindow: number;
  readonly maximumInstallDelayMs: number;
  readonly minimumInstallDelayMs: number;
  readonly ruleVersion: string;
  readonly windowMs: number;
}

export interface FraudFlag {
  readonly evidenceIds: ReadonlyArray<string>;
  readonly flagId: string;
  readonly reason: "click-flooding" | "click-to-install-anomaly" | "token-replay" | "referrer-click-mismatch";
  readonly ruleVersion: string;
  readonly severity: "warning" | "block";
}

/** Appends deterministic fraud flags without changing source evidence. */
export const evaluateFraud = (
  evidence: ReadonlyArray<FraudEvidence>,
  rules: FraudRuleSet,
): ReadonlyArray<FraudFlag> => {
  const flags: FraudFlag[] = [];
  const clicks = evidence.filter(({ kind }) => kind === "click").sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  for (let index = 0; index < clicks.length; index += 1) {
    const start = Date.parse(clicks[index]?.occurredAt ?? "");
    const window = clicks.filter((click) => {
      const current = Date.parse(click.occurredAt);
      return current >= start && current - start <= rules.windowMs;
    });
    if (window.length > rules.maximumClicksPerWindow) {
      const ids = window.map(({ evidenceId }) => evidenceId).sort();
      flags.push({ evidenceIds: ids, flagId: `${rules.ruleVersion}:click-flooding:${ids.join(",")}`, reason: "click-flooding", ruleVersion: rules.ruleVersion, severity: "block" });
      break;
    }
  }
  for (const install of evidence.filter(({ kind }) => kind === "install")) {
    const click = clicks
      .filter((candidate) => candidate.clickId === install.clickId)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
    if (click) {
      const delay = Date.parse(install.occurredAt) - Date.parse(click.occurredAt);
      if (delay < rules.minimumInstallDelayMs || delay > rules.maximumInstallDelayMs) {
        flags.push({
          evidenceIds: [click.evidenceId, install.evidenceId],
          flagId: `${rules.ruleVersion}:ctit:${install.evidenceId}`,
          reason: "click-to-install-anomaly",
          ruleVersion: rules.ruleVersion,
          severity: "block",
        });
      }
    }
    if (install.clickId && install.installReferrerClickId && install.clickId !== install.installReferrerClickId) {
      flags.push({
        evidenceIds: [install.evidenceId],
        flagId: `${rules.ruleVersion}:mismatch:${install.evidenceId}`,
        reason: "referrer-click-mismatch",
        ruleVersion: rules.ruleVersion,
        severity: "block",
      });
    }
  }
  for (const replay of evidence.filter(({ kind }) => kind === "token-replay")) {
    flags.push({
      evidenceIds: [replay.evidenceId],
      flagId: `${rules.ruleVersion}:replay:${replay.evidenceId}`,
      reason: "token-replay",
      ruleVersion: rules.ruleVersion,
      severity: "block",
    });
  }
  return [...new Map(flags.map((flag) => [flag.flagId, flag])).values()].sort((left, right) => left.flagId.localeCompare(right.flagId));
};

export interface MeasurementExportRow {
  readonly deleted?: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly recordId: string;
  readonly schemaVersion: number;
  readonly type: string;
}

const protectedKey = /(?:ciphertext|email|phone|receipt|token|rawUrl|advertisingId|idfa|gaid)/i;

/** Produces a deletion-aware raw export with protected fields removed recursively. */
export const buildMeasurementRawExport = (
  rows: ReadonlyArray<MeasurementExportRow>,
): ReadonlyArray<MeasurementExportRow> => rows
  .filter(({ deleted }) => deleted !== true)
  .map((row) => ({ ...row, payload: redact(row.payload) as Readonly<Record<string, unknown>> }));

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) =>
    protectedKey.test(key) ? [] : [[key, redact(nested)]]));
};

/** Counts report rows by type and campaign using the same deletion semantics as raw export. */
export const aggregateMeasurementReport = (rows: ReadonlyArray<MeasurementExportRow>) => {
  const exported = buildMeasurementRawExport(rows);
  const byCampaign: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const row of exported) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    const campaign = row.payload.campaign;
    if (typeof campaign === "string") byCampaign[campaign] = (byCampaign[campaign] ?? 0) + 1;
  }
  return { byCampaign, byType, total: exported.length };
};
