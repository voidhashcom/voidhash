import { Effect } from "effect";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { describe, expect, it } from "vite-plus/test";

import { makeMcpAuthKit, normalizeAuthKitDomain } from "./McpAuthKit.ts";

const ISSUER = "https://example.authkit.app";
const AUDIENCE = "https://api.example.com/api/mcp";

const authKitFixture = async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "test" };
  const authKit = makeMcpAuthKit(ISSUER, createLocalJWKSet({ keys: [publicJwk] }));
  const sign = (claims: Record<string, unknown>, audience = AUDIENCE) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setSubject("user_123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  return { authKit, sign };
};

describe("normalizeAuthKitDomain", () => {
  it("accepts a bare HTTPS issuer and removes its trailing slash", () => {
    expect(normalizeAuthKitDomain(" https://example.authkit.app/ ")).toBe(ISSUER);
  });

  it("rejects insecure or path-bearing issuer values", () => {
    expect(normalizeAuthKitDomain("http://example.authkit.app")).toBeUndefined();
    expect(normalizeAuthKitDomain("https://example.authkit.app/oauth2")).toBeUndefined();
  });
});

describe("McpAuthKit.verifyAccessToken", () => {
  it("verifies issuer and resource audience and returns the WorkOS identity", async () => {
    const { authKit, sign } = await authKitFixture();
    const token = await sign({ org_id: "org_123" });

    await expect(Effect.runPromise(authKit.verifyAccessToken(token, AUDIENCE))).resolves.toEqual({
      organizationId: "org_123",
      subject: "user_123",
    });
  });

  it("rejects a token issued for another MCP resource", async () => {
    const { authKit, sign } = await authKitFixture();
    const token = await sign({ org_id: "org_123" }, "https://other.example.com/api/mcp");

    await expect(
      Effect.runPromise(authKit.verifyAccessToken(token, AUDIENCE)),
    ).rejects.toMatchObject({ kind: "invalid_token" });
  });

  it("requires the organization selected during AuthKit consent", async () => {
    const { authKit, sign } = await authKitFixture();
    const token = await sign({});

    await expect(
      Effect.runPromise(authKit.verifyAccessToken(token, AUDIENCE)),
    ).rejects.toMatchObject({ kind: "invalid_token" });
  });
});
