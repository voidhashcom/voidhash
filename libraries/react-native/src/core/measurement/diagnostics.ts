export interface DiagnosticAuthorization {
  readonly expiresAt: string;
  readonly keyId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly signature: string;
}

export interface RedactedDiagnosticEntry {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly level: "debug" | "info" | "warning";
  readonly message: string;
  readonly occurredAt: string;
}

const protectedKey = /(?:url|uri|token|receipt|jws|phone|email|idfa|idfv|gaid|oaid|aaid|android.?id|imei|referrer|secret|password|authorization)/i;
const protectedText = /(?:[a-z][a-z\d+.-]*:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+|(?:token|receipt|authorization|password|secret)\s*[=:]\s*\S+)/gi;

const redact = (value: unknown): unknown => {
  if (typeof value === "string") return value.replace(protectedText, "[redacted]");
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    protectedKey.test(key) ? "[redacted]" : redact(nested),
  ]));
};

const decodeBase64 = (value: string): ArrayBuffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)).buffer;
};

const authorizationPayload = (authorization: Omit<DiagnosticAuthorization, "signature">): ArrayBuffer =>
  new TextEncoder().encode(JSON.stringify({
    expiresAt: authorization.expiresAt,
    keyId: authorization.keyId,
    projectId: authorization.projectId,
    sessionId: authorization.sessionId,
  })).buffer;

/** Release-safe logger that requires an expiring project-bound Ed25519 authorization. */
export class SecureDiagnosticLogger {
  private authorizedUntil = 0;

  constructor(
    private readonly projectId: string,
    private readonly trustedKeys: ReadonlyMap<string, CryptoKey>,
    private readonly releaseBuild: boolean,
    private readonly sink: (entry: RedactedDiagnosticEntry) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Enables a release diagnostic session only after signature, project, and expiry validation. */
  async authorize(authorization: DiagnosticAuthorization): Promise<boolean> {
    const expiresAt = Date.parse(authorization.expiresAt);
    const key = this.trustedKeys.get(authorization.keyId);
    if (
      !key ||
      authorization.projectId !== this.projectId ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= this.now().getTime()
    ) return false;
    try {
      const verified = await crypto.subtle.verify(
        "Ed25519",
        key,
        decodeBase64(authorization.signature),
        authorizationPayload(authorization),
      );
      if (!verified) return false;
      this.authorizedUntil = expiresAt;
      return true;
    } catch {
      return false;
    }
  }

  /** Emits a redacted diagnostic entry when the build/session policy allows it. */
  log(
    level: RedactedDiagnosticEntry["level"],
    message: string,
    fields: Readonly<Record<string, unknown>> = {},
  ): boolean {
    if (this.releaseBuild && this.authorizedUntil <= this.now().getTime()) return false;
    this.sink({
      fields: redact(fields) as Readonly<Record<string, unknown>>,
      level,
      message: redact(message) as string,
      occurredAt: this.now().toISOString(),
    });
    return true;
  }
}

/** Encodes the canonical diagnostic-authorization payload for server and test signers. */
export const encodeDiagnosticAuthorizationPayload = authorizationPayload;
