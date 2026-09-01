/**
 * Provider-neutral OAuth surface for the MCP protected resource.
 *
 * MCP accepts three credentials: project secret keys, user API keys, and — when
 * a deployment runs an OAuth authorization server — a resource-bound access
 * token. The first two need no external service and are always available. The
 * third is supplied by the composition root; self-host ships
 * {@link McpOAuthUnconfiguredLive}, which reports the endpoint as unconfigured
 * so clients fall back to key auth.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class McpOAuthError extends Schema.TaggedErrorClass<McpOAuthError>("McpOAuthError")(
  "McpOAuthError",
  { kind: Schema.Literals(["invalid_token" , "misconfigured" , "upstream"]), message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

/** Identity claims an MCP access token must carry. */
export interface McpOAuthClaims {
  readonly organizationId: string;
  readonly subject: string;
}

export interface McpOAuthShape {
  /** Issuer advertised by OAuth discovery, or `undefined` when unconfigured. */
  readonly authorizationServer: string | typeof Schema.Undefined.Type;
  /** Verifies a resource-bound access token and returns its identity claims. */
  readonly verifyAccessToken: (
    token: string,
    audience: string,
  ) => Effect.Effect<McpOAuthClaims, McpOAuthError>;
  /** Proxies the authorization server's metadata document for discovery. */
  readonly fetchAuthorizationServerMetadata: () => Effect.Effect<unknown, McpOAuthError>;
}

/** OAuth issuer discovery and resource-audience token verification for MCP. */
export class McpOAuth extends Context.Service<McpOAuth, McpOAuthShape>()("backend/McpOAuth") {}

const misconfigured = <A>(): Effect.Effect<A, McpOAuthError> =>
  Effect.fail(
    new McpOAuthError({
      kind: "misconfigured",
      message: "This deployment does not run an MCP OAuth authorization server.",
    }),
  );

/**
 * Default implementation: no authorization server. Discovery reports the
 * resource as unavailable and JWT bearer tokens are refused, leaving project
 * secret keys and user API keys as the supported MCP credentials.
 */
export const McpOAuthUnconfiguredLive: Layer.Layer<McpOAuth> = Layer.succeed(McpOAuth)(
  McpOAuth.of({
    authorizationServer: undefined,
    fetchAuthorizationServerMetadata: () => misconfigured(),
    verifyAccessToken: () => misconfigured(),
  }),
);
