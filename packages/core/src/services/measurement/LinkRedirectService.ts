import {
  type CreateLinkRequest,
  LinkInvalidRequestError,
  LinkUnauthorizedError,
  type ResolveDeferredLinkRequest,
} from "@voidhash/api-contracts/links";
import {
  and,
  apiKeys,
  Db,
  eq,
  gt,
  isNull,
  measurementLinkClicks,
  measurementLinks,
  projects,
} from "@voidhash/db";
import { Context, Effect, Layer } from "effect";

import { validateCaptureToken } from "../analyticsIngest/EventCaptureService.ts";
import {
  canonicalizeMeasurementConfig,
  MeasurementConfigSigner,
} from "./MeasurementConfigurationService.ts";

type CreateInput = typeof CreateLinkRequest.Type;
type ResolveInput = typeof ResolveDeferredLinkRequest.Type;

type StoredLinkDefinition = Omit<CreateInput, "idempotencyKey" | "token">;

const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const tokenPart = (value: unknown): string =>
  encodeBase64Url(new TextEncoder().encode(canonicalizeMeasurementConfig(value)));

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const safeWebUrl = (value: string): URL => {
  const url = new URL(value);
  const local = new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password) {
    throw new TypeError("link destinations must use HTTPS");
  }
  return url;
};

const validateCustomParameters = (parameters: CreateInput["customParameters"]): void => {
  const entries = Object.entries(parameters ?? {});
  if (entries.length > 50) throw new TypeError("customParameters cannot contain more than 50 entries");
  let encodedBytes = 0;
  for (const [key, value] of entries) {
    if (!/^[A-Za-z][A-Za-z\d_.-]{0,63}$/.test(key) || /^(?:token|authorization|password|secret|receipt)$/i.test(key)) {
      throw new TypeError(`custom parameter '${key}' is not allowed`);
    }
    encodedBytes += new TextEncoder().encode(`${key}=${value}`).byteLength;
  }
  if (encodedBytes > 16_384) throw new TypeError("customParameters exceed the encoded size limit");
};

const appleStoreUrl = (appleAppId: string): string => {
  const normalized = appleAppId.replace(/^id/i, "");
  if (!/^\d{5,20}$/.test(normalized)) throw new TypeError("appleAppId must be a numeric App Store ID");
  return `https://apps.apple.com/app/id${normalized}`;
};

const linkOrigin = (origin: string, brandedDomain?: string): string => {
  if (!brandedDomain) return safeWebUrl(origin).origin;
  if (!/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i.test(brandedDomain)) {
    throw new TypeError("brandedDomain must be a DNS hostname");
  }
  return `https://${brandedDomain}`;
};

const signedToken = (
  keyId: string,
  payload: unknown,
  signature: string,
): string => `${keyId}.${tokenPart(payload)}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

/** Persistent signed-link creation, click evidence, and one-time deferred correlation. */
export class LinkRedirectService extends Context.Service<LinkRedirectService>()(
  "LinkRedirectService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const signer = yield* MeasurementConfigSigner;

      const resolveProject = Effect.fn("LinkRedirectService.resolveProject")(function* (rawToken: string) {
        const token = yield* validateCaptureToken(rawToken).pipe(
          Effect.mapError(() => new LinkUnauthorizedError({ code: "unauthorized", error: "invalid token" })),
        );
        const [project] = yield* db
          .select({ projectId: apiKeys.projectId })
          .from(apiKeys)
          .innerJoin(projects, eq(projects.id, apiKeys.projectId))
          .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, token)))
          .limit(1);
        if (!project) {
          return yield* Effect.fail(new LinkUnauthorizedError({ code: "unauthorized", error: "invalid token" }));
        }
        return project.projectId;
      });

      const existingCreateResult = Effect.fn("LinkRedirectService.existingCreateResult")(function* (
        projectId: string,
        idempotencyKey: string,
        origin: string,
        brandedDomain?: string,
      ) {
        const [existing] = yield* db
          .select({
            definition: measurementLinks.definition,
            expiresAt: measurementLinks.expiresAt,
            id: measurementLinks.id,
            signedToken: measurementLinks.signedToken,
          })
          .from(measurementLinks)
          .where(and(eq(measurementLinks.projectId, projectId), eq(measurementLinks.idempotencyKey, idempotencyKey)))
          .limit(1);
        if (!existing) return undefined;
        const definition = existing.definition as unknown as StoredLinkDefinition;
        return {
          expiresAt: existing.expiresAt,
          linkId: existing.id,
          url: `${linkOrigin(origin, definition.brandedDomain ?? brandedDomain)}/l/${encodeURIComponent(existing.id)}?token=${encodeURIComponent(existing.signedToken)}`,
        };
      });

      const create = Effect.fn("LinkRedirectService.create")(function* (input: CreateInput, publicOrigin: string) {
        const projectId = yield* resolveProject(input.token);
        const now = new Date();
        const expiresAt = input.expiresAt ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
        if (expiresAt <= now) {
          return yield* Effect.fail(new LinkInvalidRequestError({ code: "invalid_link_request", error: "expiresAt must be in the future" }));
        }
        try {
          linkOrigin(publicOrigin, input.brandedDomain);
          validateCustomParameters(input.customParameters);
          for (const value of [input.destination.androidStoreUrl, input.destination.iosStoreUrl, input.destination.webFallbackUrl, input.referrerImageUrl]) {
            if (value) safeWebUrl(value);
          }
          if (input.destination.appleAppId) appleStoreUrl(input.destination.appleAppId);
        } catch (cause) {
          return yield* Effect.fail(new LinkInvalidRequestError({ code: "invalid_link_request", error: String(cause) }));
        }
        if (input.idempotencyKey) {
          const existing = yield* existingCreateResult(projectId, input.idempotencyKey, publicOrigin, input.brandedDomain);
          if (existing) return existing;
        }
        const linkId = `link_${crypto.randomUUID()}`;
        const unsigned = { expiresAt: expiresAt.toISOString(), issuedAt: now.toISOString(), kind: "link", linkId, projectId } as const;
        const signature = yield* signer.sign(new TextEncoder().encode(canonicalizeMeasurementConfig(unsigned)));
        const token = signedToken(signer.keyId, unsigned, signature);
        const { idempotencyKey: _, token: __, ...definition } = input;
        const rows = yield* db.insert(measurementLinks).values({
          definition: definition as unknown as Record<string, unknown>,
          expiresAt,
          id: linkId,
          idempotencyKey: input.idempotencyKey,
          projectId,
          signedToken: token,
        }).onConflictDoNothing().returning({ id: measurementLinks.id });
        if (rows.length === 0 && input.idempotencyKey) {
          const existing = yield* existingCreateResult(projectId, input.idempotencyKey, publicOrigin, input.brandedDomain);
          if (existing) return existing;
        }
        const origin = linkOrigin(publicOrigin, input.brandedDomain);
        return { expiresAt, linkId, url: `${origin}/l/${encodeURIComponent(linkId)}?token=${encodeURIComponent(token)}` };
      });

      const click = Effect.fn("LinkRedirectService.click")(function* (input: {
        readonly clickId: string;
        readonly linkId: string;
        readonly referer?: string;
        readonly token: string;
        readonly userAgent: string;
      }) {
        const [link] = yield* db.select().from(measurementLinks)
          .where(and(eq(measurementLinks.id, input.linkId), eq(measurementLinks.signedToken, input.token), gt(measurementLinks.expiresAt, new Date())))
          .limit(1);
        if (!link) return undefined;
        const definition = link.definition as unknown as StoredLinkDefinition;
        const ios = /(?:iphone|ipad|ipod)/i.test(input.userAgent);
        const android = /android/i.test(input.userAgent);
        let refererOrigin: string | undefined;
        try {
          if (input.referer) refererOrigin = safeWebUrl(input.referer).origin;
        } catch {
          refererOrigin = undefined;
        }
        const occurredAt = new Date();
        const deferredExpiresAt = new Date(Math.min(link.expiresAt.getTime(), occurredAt.getTime() + 24 * 60 * 60 * 1_000));
        const payload = { clickId: input.clickId, expiresAt: deferredExpiresAt.toISOString(), issuedAt: occurredAt.toISOString(), kind: "deferred", linkId: link.id, projectId: link.projectId } as const;
        const signature = yield* signer.sign(new TextEncoder().encode(canonicalizeMeasurementConfig(payload)));
        const deferredToken = signedToken(signer.keyId, payload, signature);
        const deferredTokenHash = yield* Effect.promise(() => hashToken(deferredToken));
        const context = {
          platform: ios ? "ios" : android ? "android" : "web",
          refererOrigin,
          userAgentFamily: ios ? "apple" : android ? "android" : input.userAgent ? "browser" : "unknown",
        };
        const rows = yield* db.insert(measurementLinkClicks).values({
          context,
          deferredExpiresAt,
          deferredTokenHash,
          id: input.clickId,
          linkId: link.id,
          occurredAt,
          projectId: link.projectId,
        }).onConflictDoNothing().returning({ id: measurementLinkClicks.id });
        if (rows.length === 0) return undefined;
        const destination = ios
          ? definition.destination.iosStoreUrl ?? (definition.destination.appleAppId
            ? appleStoreUrl(definition.destination.appleAppId)
            : definition.destination.webFallbackUrl)
          : android
            ? definition.destination.androidStoreUrl ?? definition.destination.webFallbackUrl
            : definition.destination.webFallbackUrl;
        if (!destination) return undefined;
        const redirect = safeWebUrl(destination);
        if (android) redirect.searchParams.set("referrer", deferredToken);
        return { deferredToken, destination: redirect.toString() };
      });

      const resolveDeferred = Effect.fn("LinkRedirectService.resolveDeferred")(function* (input: ResolveInput) {
        const projectId = yield* resolveProject(input.token);
        const deferredTokenHash = yield* Effect.promise(() => hashToken(input.deferredToken));
        const now = new Date();
        const [claimed] = yield* db.update(measurementLinkClicks)
          .set({ consumedAt: now, installationId: input.installationId })
          .where(and(
            eq(measurementLinkClicks.projectId, projectId),
            eq(measurementLinkClicks.deferredTokenHash, deferredTokenHash),
            isNull(measurementLinkClicks.consumedAt),
            gt(measurementLinkClicks.deferredExpiresAt, now),
          ))
          .returning();
        if (!claimed) {
          const [existing] = yield* db.select({ consumedAt: measurementLinkClicks.consumedAt, expiresAt: measurementLinkClicks.deferredExpiresAt })
            .from(measurementLinkClicks)
            .where(and(eq(measurementLinkClicks.projectId, projectId), eq(measurementLinkClicks.deferredTokenHash, deferredTokenHash)))
            .limit(1);
          return { reason: existing?.consumedAt ? "replayed" as const : existing && existing.expiresAt <= now ? "expired" as const : "not-found" as const, status: "notFound" as const };
        }
        const [link] = yield* db.select().from(measurementLinks)
          .where(and(eq(measurementLinks.projectId, projectId), eq(measurementLinks.id, claimed.linkId)))
          .limit(1);
        if (!link) return { reason: "not-found" as const, status: "notFound" as const };
        const definition = link.definition as unknown as StoredLinkDefinition;
        return {
          campaign: definition.campaign,
          clickId: claimed.id,
          clickedAt: claimed.occurredAt,
          deferred: true as const,
          expiresAt: claimed.deferredExpiresAt,
          linkId: link.id,
          route: { subvalues: definition.destination.subvalues ?? {}, value: definition.destination.deepLinkValue },
          signature: input.deferredToken,
          status: "found" as const,
        };
      });

      return { click, create, resolveDeferred } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(LinkRedirectService)(LinkRedirectService.make);
}
