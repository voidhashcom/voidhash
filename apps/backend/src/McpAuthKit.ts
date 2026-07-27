import { Context, Data, Effect, Layer } from "effect";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export class McpAuthKitError extends Data.TaggedError("McpAuthKitError")<{
  readonly kind: "invalid_token" | "misconfigured" | "upstream";
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface McpAuthKitClaims {
  readonly organizationId: string;
  readonly subject: string;
}

/** Normalizes the HTTPS AuthKit issuer configured for MCP OAuth discovery. */
export const normalizeAuthKitDomain = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
};

/** Builds AuthKit MCP verification against the supplied issuer and JWKS resolver. */
export const makeMcpAuthKit = (
  authorizationServer: string | undefined,
  jwks: JWTVerifyGetKey | undefined,
) => {
  const requireConfiguration = () =>
    authorizationServer && jwks
      ? Effect.succeed({ authorizationServer, jwks })
      : Effect.fail(
          new McpAuthKitError({
            kind: "misconfigured",
            message: "WORKOS_AUTHKIT_DOMAIN must be set to the HTTPS AuthKit issuer.",
          }),
        );

  const verifyAccessToken = (token: string, audience: string) =>
    Effect.gen(function* () {
      const configured = yield* requireConfiguration();
      const verified = yield* Effect.tryPromise({
        try: () =>
          jwtVerify(token, configured.jwks, {
            audience,
            issuer: configured.authorizationServer,
          }),
        catch: (cause) =>
          new McpAuthKitError({
            cause,
            kind: "invalid_token",
            message:
              "The AuthKit access token is invalid, expired, or intended for another resource.",
          }),
      });
      const subject = verified.payload.sub;
      const organizationId = verified.payload.org_id;
      if (typeof subject !== "string" || typeof organizationId !== "string") {
        return yield* Effect.fail(
          new McpAuthKitError({
            kind: "invalid_token",
            message: "The AuthKit access token is missing its subject or organization claim.",
          }),
        );
      }
      return { organizationId, subject } satisfies McpAuthKitClaims;
    });

  const fetchAuthorizationServerMetadata = () =>
    Effect.gen(function* () {
      const configured = yield* requireConfiguration();
      return yield* Effect.tryPromise({
        try: async () => {
          const response = await fetch(
            `${configured.authorizationServer}/.well-known/oauth-authorization-server`,
          );
          if (!response.ok) throw new Error(`AuthKit metadata returned HTTP ${response.status}`);
          return (await response.json()) as unknown;
        },
        catch: (cause) =>
          new McpAuthKitError({
            cause,
            kind: "upstream",
            message: "Failed to load AuthKit authorization-server metadata.",
          }),
      });
    });

  return {
    authorizationServer,
    fetchAuthorizationServerMetadata,
    verifyAccessToken,
  } as const;
};

/** AuthKit MCP issuer discovery and resource-audience JWT verification. */
export class McpAuthKit extends Context.Service<McpAuthKit>()("backend/McpAuthKit", {
  make: Effect.sync(() => {
    const authorizationServer = normalizeAuthKitDomain(process.env.WORKOS_AUTHKIT_DOMAIN);
    const jwks = authorizationServer
      ? createRemoteJWKSet(new URL(`${authorizationServer}/oauth2/jwks`), {
          cacheMaxAge: 5 * 60_000,
          cooldownDuration: 30_000,
        })
      : undefined;
    return makeMcpAuthKit(authorizationServer, jwks);
  }),
}) {
  static layer = Layer.effect(McpAuthKit)(McpAuthKit.make);
}
