import { MeasurementConfigurationError } from "./errors";

/** Endpoint and signed-configuration trust overrides for self-hosted deployments. */
export interface MeasurementEndpointOverrides {
  readonly api?: string;
  readonly ingest?: string;
  readonly links?: string;
  readonly trustedConfigKeys?: ReadonlyArray<{
    readonly keyId: string;
    readonly publicKey: string;
  }>;
  /** Project identifier signed into remote measurement configuration. */
  readonly configurationProjectId?: string;
  readonly allowInsecureDebugTransport?: boolean;
}

/** Normalized endpoint overrides safe to pass to native startup configuration. */
export interface ResolvedMeasurementEndpoints {
  readonly api: string;
  readonly ingest: string;
  readonly links: string;
  readonly trustedConfigKeyIds: ReadonlyArray<string>;
}

const normalizeOrigin = (value: string, field: string, allowInsecure: boolean): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MeasurementConfigurationError(`${field} must be an absolute URL`, field);
  }
  if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) {
    throw new MeasurementConfigurationError(`${field} must use HTTPS`, field);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new MeasurementConfigurationError(
      `${field} must be an origin without credentials, query, fragment, or path`,
      field,
    );
  }
  return url.origin;
};

/** Validates and resolves cloud or self-host endpoint configuration. */
export const resolveMeasurementEndpoints = (
  overrides: MeasurementEndpointOverrides | undefined,
  debug: boolean,
): ResolvedMeasurementEndpoints => {
  const allowInsecure = debug && overrides?.allowInsecureDebugTransport === true;
  const api = normalizeOrigin(overrides?.api ?? "https://api.voidhash.com", "endpoints.api", allowInsecure);
  const ingest = normalizeOrigin(overrides?.ingest ?? api, "endpoints.ingest", allowInsecure);
  const links = normalizeOrigin(overrides?.links ?? api, "endpoints.links", allowInsecure);
  const keyIds = new Set<string>();
  for (const key of overrides?.trustedConfigKeys ?? []) {
    if (!key.keyId.trim() || !key.publicKey.trim()) {
      throw new MeasurementConfigurationError(
        "Trusted configuration keys require non-empty keyId and publicKey",
        "endpoints.trustedConfigKeys",
      );
    }
    if (keyIds.has(key.keyId)) {
      throw new MeasurementConfigurationError(
        `Duplicate trusted configuration key '${key.keyId}'`,
        "endpoints.trustedConfigKeys",
      );
    }
    keyIds.add(key.keyId);
  }
  if (keyIds.size > 0 && !overrides?.configurationProjectId?.trim()) {
    throw new MeasurementConfigurationError(
      "configurationProjectId is required when trusted configuration keys are supplied",
      "endpoints.configurationProjectId",
    );
  }
  return { api, ingest, links, trustedConfigKeyIds: [...keyIds].sort() };
};
