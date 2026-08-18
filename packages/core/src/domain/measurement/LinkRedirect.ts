export interface LinkRoute {
  readonly value: string;
  readonly subvalues: Readonly<Record<string, string>>;
}

export interface LinkDefinition {
  readonly androidStoreUrl?: string;
  readonly appleAppId?: string;
  readonly baseDeepLink?: string;
  readonly brandedDomain?: string;
  readonly campaign?: Readonly<Record<string, string | undefined>>;
  readonly createdAt: string;
  readonly customParameters?: Readonly<Record<string, string>>;
  readonly expiresAt: string;
  readonly iosStoreUrl?: string;
  readonly linkId: string;
  readonly projectId: string;
  readonly referrerCustomerId?: string;
  readonly referrerImageUrl?: string;
  readonly referrerName?: string;
  readonly referrerUid?: string;
  readonly route: LinkRoute;
  readonly templateId?: string;
  readonly webFallbackUrl?: string;
}

export interface LinkClickEvidence {
  readonly clickId: string;
  readonly context: {
    readonly platform: "ios" | "android" | "web";
    readonly refererOrigin?: string;
    readonly userAgentFamily: "apple" | "android" | "browser" | "unknown";
  };
  readonly linkId: string;
  readonly occurredAt: string;
  readonly projectId: string;
}

interface SignedLinkPayload {
  readonly clickId?: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly kind: "link" | "deferred";
  readonly linkId: string;
  readonly projectId: string;
}

export interface LinkSigningKey {
  readonly keyId: string;
  readonly privateKey?: CryptoKey;
  readonly publicKey: CryptoKey;
}

export type DeferredResolution =
  | {
      readonly status: "found";
      readonly clickId: string;
      readonly clickedAt: string;
      readonly expiresAt: string;
      readonly linkId: string;
      readonly route: LinkRoute;
      readonly campaign?: Readonly<Record<string, string | undefined>>;
    }
  | { readonly status: "notFound"; readonly reason: "expired" | "invalid" | "not-found" | "replayed" };

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
    .join(",")}}`;
};

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  if (!/^[A-Za-z\d_-]+$/.test(value)) throw new TypeError("invalid base64url");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const bytesBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Creates an Ed25519 key suitable for tests and self-host development. */
export const createLinkSigningKey = async (keyId: string): Promise<LinkSigningKey> => {
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  return { keyId, privateKey: pair.privateKey, publicKey: pair.publicKey };
};

/** Signs a bounded, canonical link or deferred-correlation payload. */
export const signLinkPayload = async (
  payload: SignedLinkPayload,
  key: LinkSigningKey,
): Promise<string> => {
  if (!key.privateKey) throw new TypeError("link signing key is verification-only");
  const encodedPayload = new TextEncoder().encode(canonicalize(payload));
  const signature = await crypto.subtle.sign("Ed25519", key.privateKey, bytesBuffer(encodedPayload));
  return `${key.keyId}.${base64Url(encodedPayload)}.${base64Url(new Uint8Array(signature))}`;
};

/** Verifies token signature, project scope, kind, expiry, and optional link binding. */
export const verifyLinkPayload = async (input: {
  readonly expectedKind: SignedLinkPayload["kind"];
  readonly expectedLinkId?: string;
  readonly expectedProjectId: string;
  readonly keys: ReadonlyMap<string, LinkSigningKey>;
  readonly now: Date;
  readonly token: string;
  readonly allowExpired?: boolean;
}): Promise<SignedLinkPayload | undefined> => {
  try {
    const [keyId, payloadPart, signaturePart, extra] = input.token.split(".");
    if (!keyId || !payloadPart || !signaturePart || extra) return undefined;
    const key = input.keys.get(keyId);
    if (!key) return undefined;
    const payloadBytes = fromBase64Url(payloadPart);
    if (payloadBytes.byteLength > 4_096) return undefined;
    const verified = await crypto.subtle.verify(
      "Ed25519",
      key.publicKey,
      bytesBuffer(fromBase64Url(signaturePart)),
      bytesBuffer(payloadBytes),
    );
    if (!verified) return undefined;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SignedLinkPayload;
    if (
      canonicalize(payload) !== new TextDecoder().decode(payloadBytes) ||
      payload.kind !== input.expectedKind ||
      payload.projectId !== input.expectedProjectId ||
      (input.expectedLinkId !== undefined && payload.linkId !== input.expectedLinkId) ||
      !Number.isFinite(Date.parse(payload.expiresAt)) ||
      (!input.allowExpired && Date.parse(payload.expiresAt) <= input.now.getTime())
    ) return undefined;
    return payload;
  } catch {
    return undefined;
  }
};

const safeUrl = (value: string): URL => {
  const url = new URL(value);
  const local = new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password) {
    throw new TypeError("unsafe link destination");
  }
  return url;
};

const appleStoreUrl = (appleAppId: string): string => {
  const normalized = appleAppId.replace(/^id/i, "");
  if (!/^\d{5,20}$/.test(normalized)) throw new TypeError("invalid Apple app ID");
  return `https://apps.apple.com/app/id${normalized}`;
};

const validateDefinition = (definition: LinkDefinition): void => {
  for (const destination of [
    definition.androidStoreUrl,
    definition.iosStoreUrl,
    definition.webFallbackUrl,
    definition.referrerImageUrl,
  ]) {
    if (destination) safeUrl(destination);
  }
  if (definition.appleAppId) appleStoreUrl(definition.appleAppId);
  const customParameters = Object.entries(definition.customParameters ?? {});
  if (customParameters.length > 50) throw new TypeError("too many custom parameters");
  for (const [key, value] of customParameters) {
    if (!/^[A-Za-z][A-Za-z\d_.-]{0,63}$/.test(key) || value.length > 1_024) {
      throw new TypeError("invalid custom parameter");
    }
  }
};

const classifyContext = (userAgent: string, referer?: string): LinkClickEvidence["context"] => {
  const ios = /(?:iphone|ipad|ipod)/i.test(userAgent);
  const android = /android/i.test(userAgent);
  let refererOrigin: string | undefined;
  try {
    if (referer) refererOrigin = safeUrl(referer).origin;
  } catch {
    refererOrigin = undefined;
  }
  return {
    platform: ios ? "ios" : android ? "android" : "web",
    refererOrigin,
    userAgentFamily: ios ? "apple" : android ? "android" : userAgent ? "browser" : "unknown",
  };
};

/** Immutable in-memory reference implementation for signed redirect and deferred-token semantics. */
export class LinkRedirectEngine {
  private readonly definitions = new Map<string, LinkDefinition>();
  private readonly clicks = new Map<string, LinkClickEvidence>();
  private readonly consumedDeferredTokens = new Set<string>();
  private readonly signingKey: LinkSigningKey;
  private readonly verificationKeys: ReadonlyMap<string, LinkSigningKey>;
  private readonly now: () => Date;

  constructor(
    signingKey: LinkSigningKey,
    verificationKeys: ReadonlyMap<string, LinkSigningKey>,
    now: () => Date = () => new Date(),
  ) {
    this.signingKey = signingKey;
    this.verificationKeys = verificationKeys;
    this.now = now;
  }

  /** Persists a definition and returns a signed short URL. */
  async create(definition: LinkDefinition, origin: string): Promise<{ readonly token: string; readonly url: string }> {
    if (this.definitions.has(definition.linkId)) throw new TypeError("duplicate link id");
    validateDefinition(definition);
    this.definitions.set(definition.linkId, structuredClone(definition));
    const token = await signLinkPayload({
      expiresAt: definition.expiresAt,
      issuedAt: definition.createdAt,
      kind: "link",
      linkId: definition.linkId,
      projectId: definition.projectId,
    }, this.signingKey);
    return { token, url: `${safeUrl(origin).origin}/l/${encodeURIComponent(definition.linkId)}?token=${encodeURIComponent(token)}` };
  }

  /** Records immutable click evidence before returning any redirect destination. */
  async click(input: {
    readonly clickId: string;
    readonly linkId: string;
    readonly referer?: string;
    readonly token: string;
    readonly userAgent: string;
  }): Promise<{ readonly deferredToken: string; readonly destination: string } | undefined> {
    const definition = this.definitions.get(input.linkId);
    if (!definition) return undefined;
    const verified = await verifyLinkPayload({
      expectedKind: "link",
      expectedLinkId: input.linkId,
      expectedProjectId: definition.projectId,
      keys: this.verificationKeys,
      now: this.now(),
      token: input.token,
    });
    if (!verified) return undefined;
    if (this.clicks.has(input.clickId)) return undefined;
    const context = classifyContext(input.userAgent, input.referer);
    const occurredAt = this.now().toISOString();
    this.clicks.set(input.clickId, {
      clickId: input.clickId,
      context,
      linkId: input.linkId,
      occurredAt,
      projectId: definition.projectId,
    });
    const deferredToken = await signLinkPayload({
      clickId: input.clickId,
      expiresAt: new Date(Math.min(Date.parse(definition.expiresAt), this.now().getTime() + 24 * 60 * 60 * 1_000)).toISOString(),
      issuedAt: occurredAt,
      kind: "deferred",
      linkId: definition.linkId,
      projectId: definition.projectId,
    }, this.signingKey);
    const destination = context.platform === "ios"
      ? definition.iosStoreUrl ?? (definition.appleAppId ? appleStoreUrl(definition.appleAppId) : definition.webFallbackUrl)
      : context.platform === "android"
        ? definition.androidStoreUrl ?? definition.webFallbackUrl
        : definition.webFallbackUrl;
    if (!destination) return undefined;
    const redirect = safeUrl(destination);
    if (context.platform === "android") redirect.searchParams.set("referrer", deferredToken);
    return { deferredToken, destination: redirect.toString() };
  }

  /** Resolves a signed deferred token once without probabilistic matching. */
  async resolveDeferred(projectId: string, token: string): Promise<DeferredResolution> {
    if (this.consumedDeferredTokens.has(token)) return { reason: "replayed", status: "notFound" };
    const verified = await verifyLinkPayload({
      expectedKind: "deferred",
      expectedProjectId: projectId,
      keys: this.verificationKeys,
      now: this.now(),
      token,
      allowExpired: true,
    });
    if (!verified) return { reason: "invalid", status: "notFound" };
    if (Date.parse(verified.expiresAt) <= this.now().getTime()) {
      return { reason: "expired", status: "notFound" };
    }
    const definition = this.definitions.get(verified.linkId);
    const click = verified.clickId ? this.clicks.get(verified.clickId) : undefined;
    if (!definition || !click) return { reason: "not-found", status: "notFound" };
    this.consumedDeferredTokens.add(token);
    return {
      campaign: definition.campaign,
      clickId: click.clickId,
      clickedAt: click.occurredAt,
      expiresAt: verified.expiresAt,
      linkId: definition.linkId,
      route: definition.route,
      status: "found",
    };
  }

  /** Returns immutable click evidence for reporting tests. */
  evidence(): ReadonlyArray<LinkClickEvidence> {
    return [...this.clicks.values()].map((entry) => structuredClone(entry));
  }

  /** Returns an immutable link definition for management and reporting projections. */
  definition(linkId: string): LinkDefinition | undefined {
    const definition = this.definitions.get(linkId);
    return definition ? structuredClone(definition) : undefined;
  }
}
