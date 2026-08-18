export interface SignedMeasurementConfiguration<T> {
  readonly expiresAt: string;
  readonly keyId: string;
  readonly payload: T;
  readonly projectId: string;
  readonly signature: string;
  readonly version: number;
}

export type SignedConfigurationRejectionCode =
  | "expired"
  | "invalid-signature"
  | "malformed"
  | "project-mismatch"
  | "unknown-key"
  | "version-replay";

export class SignedConfigurationRejected extends Error {
  readonly code: SignedConfigurationRejectionCode;

  constructor(code: SignedConfigurationRejectionCode) {
    super(`Signed measurement configuration rejected: ${code}`);
    this.name = "SignedConfigurationRejected";
    this.code = code;
  }
}

export type SignedConfigurationKeyVerifier = (
  canonicalPayload: Uint8Array,
  signature: string,
) => boolean | Promise<boolean>;

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new SignedConfigurationRejected("malformed");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
    .join(",")}}`;
};

const decodeBase64 = (value: string): ArrayBuffer => {
  const decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer;
};

/** Builds an Ed25519 verifier from a base64-encoded SPKI public key. */
export const makeEd25519ConfigurationVerifier = async (
  publicKeySpki: string,
): Promise<SignedConfigurationKeyVerifier> => {
  const publicKey = await crypto.subtle.importKey(
    "spki",
    decodeBase64(publicKeySpki),
    "Ed25519",
    false,
    ["verify"],
  );
  return (canonicalPayload, signature) =>
    crypto.subtle.verify(
      "Ed25519",
      publicKey,
      decodeBase64(signature),
      canonicalPayload.buffer.slice(
        canonicalPayload.byteOffset,
        canonicalPayload.byteOffset + canonicalPayload.byteLength,
      ) as ArrayBuffer,
    );
};

/** Fetches and verifies signed measurement configuration without accepting unsigned fallback data. */
export const fetchSignedMeasurementConfiguration = async <T>(input: {
  readonly endpoint: string;
  readonly expectedProjectId: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly persistedVersion?: number;
  readonly publishableKey: string;
  readonly trustedKeys: ReadonlyArray<{ readonly keyId: string; readonly publicKeySpki: string }>;
}): Promise<{ readonly payload: T; readonly keyId: string; readonly version: number }> => {
  const trusted = new Map<string, SignedConfigurationKeyVerifier>();
  for (const key of input.trustedKeys) {
    trusted.set(key.keyId, await makeEd25519ConfigurationVerifier(key.publicKeySpki));
  }
  const response = await (input.fetch ?? globalThis.fetch)(
    `${input.endpoint.replace(/\/$/, "")}/i/v1/measurement/config`,
    { headers: { "x-publishable-key": input.publishableKey }, method: "GET" },
  );
  if (!response.ok) {
    throw new SignedConfigurationRejected("malformed");
  }
  const candidate = (await response.json()) as SignedMeasurementConfiguration<T>;
  const verifier = new SignedMeasurementConfigurationVerifier<T>(
    input.expectedProjectId,
    trusted,
    () => new Date(),
    input.persistedVersion,
  );
  const payload = await verifier.verify(candidate);
  const state = verifier.getState();
  return { keyId: candidate.keyId, payload, version: state.version };
};

/** Stateful verifier enforcing signature, project, expiry, and downgrade protections. */
export class SignedMeasurementConfigurationVerifier<T> {
  private accepted?: SignedMeasurementConfiguration<T>;

  constructor(
    private readonly projectId: string,
    private readonly trustedKeys: ReadonlyMap<string, SignedConfigurationKeyVerifier>,
    private readonly now: () => Date = () => new Date(),
    persistedVersion = 0,
  ) {
    this.persistedVersion = persistedVersion;
  }

  private persistedVersion: number;

  /** Verifies and persists a strictly newer signed configuration. */
  async verify(configuration: SignedMeasurementConfiguration<T>): Promise<T> {
    if (!Number.isInteger(configuration.version) || configuration.version < 1) {
      throw new SignedConfigurationRejected("malformed");
    }
    if (configuration.projectId !== this.projectId) throw new SignedConfigurationRejected("project-mismatch");
    if (!Number.isFinite(Date.parse(configuration.expiresAt))) throw new SignedConfigurationRejected("malformed");
    if (Date.parse(configuration.expiresAt) <= this.now().getTime()) throw new SignedConfigurationRejected("expired");
    if (configuration.version <= this.persistedVersion) throw new SignedConfigurationRejected("version-replay");
    const verifier = this.trustedKeys.get(configuration.keyId);
    if (!verifier) throw new SignedConfigurationRejected("unknown-key");
    const signed = new TextEncoder().encode(canonicalize({
      expiresAt: configuration.expiresAt,
      keyId: configuration.keyId,
      payload: configuration.payload,
      projectId: configuration.projectId,
      version: configuration.version,
    }));
    if (!(await verifier(signed, configuration.signature))) {
      throw new SignedConfigurationRejected("invalid-signature");
    }
    this.accepted = configuration;
    this.persistedVersion = configuration.version;
    return configuration.payload;
  }

  /** Returns the last valid configuration without exposing key material. */
  getState(): { readonly keyId?: string; readonly version: number; readonly payload?: T } {
    return {
      keyId: this.accepted?.keyId,
      version: this.persistedVersion,
      payload: this.accepted?.payload,
    };
  }
}
