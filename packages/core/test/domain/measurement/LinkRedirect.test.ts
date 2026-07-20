import {
  createLinkSigningKey,
  LinkRedirectEngine,
  verifyLinkPayload,
} from "../../../src/domain/measurement/LinkRedirect.ts";
import { describe, expect, it } from "vitest";

const definition = {
  androidStoreUrl: "https://play.google.com/store/apps/details?id=com.example",
  appleAppId: "123456789",
  baseDeepLink: "https://example.com/open",
  brandedDomain: "links.example",
  campaign: { campaign: "winter", mediaSource: "owned" },
  createdAt: "2026-01-01T00:00:00.000Z",
  customParameters: { coupon: "winter-25" },
  expiresAt: "2026-01-03T00:00:00.000Z",
  iosStoreUrl: "https://apps.apple.com/app/id123456789",
  linkId: "link-1",
  projectId: "project-1",
  referrerCustomerId: "customer-1",
  referrerImageUrl: "https://example.com/referrer.png",
  referrerName: "Example customer",
  referrerUid: "referrer-1",
  route: { subvalues: { 1: "annual" }, value: "checkout" },
  templateId: "invite-template",
  webFallbackUrl: "https://example.com/download",
} as const;

describe("LinkRedirectEngine", () => {
  it("signs, records before redirect, stamps Android referrer, and resolves once", async () => {
    const key = await createLinkSigningKey("key-1");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => new Date("2026-01-01T01:00:00.000Z"));
    const created = await engine.create(definition, "https://links.example");
    expect(created.url).toContain("/l/link-1?token=");
    const clicked = await engine.click({
      clickId: "click-1",
      linkId: "link-1",
      referer: "https://publisher.example/private/path?secret=yes",
      token: created.token,
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    });
    expect(engine.evidence()).toEqual([expect.objectContaining({
      clickId: "click-1",
      context: expect.objectContaining({ refererOrigin: "https://publisher.example" }),
    })]);
    expect(new URL(clicked?.destination ?? "").searchParams.get("referrer")).toBe(clicked?.deferredToken);
    await expect(engine.resolveDeferred("project-1", clicked?.deferredToken ?? "")).resolves.toMatchObject({
      clickId: "click-1",
      route: definition.route,
      status: "found",
    });
    await expect(engine.resolveDeferred("project-1", clicked?.deferredToken ?? "")).resolves.toEqual({
      reason: "replayed",
      status: "notFound",
    });
  });

  it("rejects tampering, wrong project, unknown key, expiry, and destination injection", async () => {
    const key = await createLinkSigningKey("key-1");
    const now = new Date("2026-01-01T01:00:00.000Z");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => now);
    const created = await engine.create(definition, "https://links.example");
    const [tamperedKeyId, tamperedPayload, tamperedSignature] = created.token.split(".");
    const tamperedPayloadBytes = `${tamperedPayload?.startsWith("a") ? "b" : "a"}${tamperedPayload?.slice(1)}`;
    const tampered = `${tamperedKeyId}.${tamperedPayloadBytes}.${tamperedSignature}`;
    await expect(engine.click({ clickId: "c", linkId: "link-1", token: tampered, userAgent: "" })).resolves.toBeUndefined();
    const [keyId, payload, signature] = created.token.split(".");
    await expect(verifyLinkPayload({
      expectedKind: "link",
      expectedProjectId: "wrong-project",
      keys: new Map([[key.keyId, key]]),
      now,
      token: created.token,
    })).resolves.toBeUndefined();
    await expect(verifyLinkPayload({
      expectedKind: "link",
      expectedProjectId: "project-1",
      keys: new Map(),
      now,
      token: `${keyId}.${payload}.${signature}`,
    })).resolves.toBeUndefined();
    const expired = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => new Date("2026-01-04T00:00:00.000Z"));
    await expect(expired.create(definition, "javascript:alert(1)")).rejects.toThrow("unsafe");
  });

  it("cannot be turned into an open redirect by request context", async () => {
    const key = await createLinkSigningKey("key-1");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => new Date("2026-01-01T01:00:00.000Z"));
    const created = await engine.create(definition, "https://links.example");
    const clicked = await engine.click({
      clickId: "click-safe",
      linkId: "link-1",
      referer: "https://evil.example/?redirect=https://evil.example",
      token: created.token,
      userAgent: "iPhone redirect=https://evil.example",
    });
    expect(new URL(clicked?.destination ?? "").origin).toBe("https://apps.apple.com");
  });

  it("retains every generator field and derives the iOS store destination from Apple app ID", async () => {
    const key = await createLinkSigningKey("key-1");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => new Date("2026-01-01T01:00:00.000Z"));
    const appleIdOnly = { ...definition, iosStoreUrl: undefined };
    const created = await engine.create(appleIdOnly, "https://links.example");
    const clicked = await engine.click({
      clickId: "apple-id-click",
      linkId: appleIdOnly.linkId,
      token: created.token,
      userAgent: "iPhone",
    });
    expect(clicked?.destination).toBe("https://apps.apple.com/app/id123456789");
    expect(engine.definition(appleIdOnly.linkId)).toEqual(appleIdOnly);
  });

  it("rejects malformed custom parameter keys and Apple app IDs", async () => {
    const key = await createLinkSigningKey("key-1");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]));
    await expect(engine.create({ ...definition, customParameters: { "bad key": "value" } }, "https://links.example"))
      .rejects.toThrow("custom parameter");
    await expect(engine.create({ ...definition, appleAppId: "javascript:alert(1)" }, "https://links.example"))
      .rejects.toThrow("Apple app ID");
  });

  it("rejects insecure destinations, reports expired deferred tokens, and keeps click evidence immutable", async () => {
    const key = await createLinkSigningKey("key-1");
    let now = new Date("2026-01-01T01:00:00.000Z");
    const engine = new LinkRedirectEngine(key, new Map([[key.keyId, key]]), () => now);
    await expect(engine.create({ ...definition, webFallbackUrl: "http://example.com" }, "https://links.example"))
      .rejects.toThrow("unsafe");
    const created = await engine.create(definition, "https://links.example");
    const clicked = await engine.click({ clickId: "immutable-click", linkId: definition.linkId, token: created.token, userAgent: "Android" });
    await expect(engine.click({ clickId: "immutable-click", linkId: definition.linkId, token: created.token, userAgent: "iPhone" }))
      .resolves.toBeUndefined();
    expect(engine.evidence()).toHaveLength(1);
    expect(engine.evidence()[0]?.context.platform).toBe("android");
    now = new Date("2026-01-03T00:00:00.000Z");
    await expect(engine.resolveDeferred(definition.projectId, clicked?.deferredToken ?? "")).resolves.toEqual({
      reason: "expired",
      status: "notFound",
    });
  });
});
