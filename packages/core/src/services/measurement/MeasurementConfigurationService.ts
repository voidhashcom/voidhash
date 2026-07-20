import {
  CaptureUnauthorizedError,
  SignedMeasurementConfigurationResponse,
} from "@voidhash/api-contracts/event-capture";
import { and, apiKeys, Db, eq, projects } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import { validateCaptureToken } from "../analyticsIngest/EventCaptureService.ts";

export class MeasurementConfigSigningError extends Schema.TaggedErrorClass<MeasurementConfigSigningError>(
  "MeasurementConfigSigningError",
)("MeasurementConfigSigningError", { cause: Schema.String }) {}

export interface MeasurementConfigSignerShape {
  readonly keyId: string;
  readonly version: number;
  readonly sign: (bytes: Uint8Array) => Effect.Effect<string, MeasurementConfigSigningError>;
}

export class MeasurementConfigSigner extends Context.Service<
  MeasurementConfigSigner,
  MeasurementConfigSignerShape
>()("@voidhash/core/MeasurementConfigSigner") {}

const decodeBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const encodeBase64 = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const asArrayBuffer = (value: Uint8Array): ArrayBuffer =>
  value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

/** Canonicalizes JSON-compatible signed data by recursively sorting object keys. */
export const canonicalizeMeasurementConfig = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeMeasurementConfig).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, nested]) =>
        `${JSON.stringify(key)}:${canonicalizeMeasurementConfig(nested)}`,
    )
    .join(",")}}`;
};

/** Creates an Ed25519 signer from PKCS#8 base64, or an ephemeral development key. */
export const createMeasurementConfigSigner = async (
  keyId: string,
  privateKeyPkcs8?: string,
  version = 1,
): Promise<MeasurementConfigSignerShape & { readonly publicKeySpki: string }> => {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError("Measurement configuration version must be a positive safe integer");
  }
  const keyPair = privateKeyPkcs8
    ? {
        privateKey: await crypto.subtle.importKey(
          "pkcs8",
          asArrayBuffer(decodeBase64(privateKeyPkcs8)),
          "Ed25519",
          false,
          ["sign"],
        ),
        publicKey: undefined,
      }
    : await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const publicKeySpki = keyPair.publicKey
    ? encodeBase64(await crypto.subtle.exportKey("spki", keyPair.publicKey))
    : "configured-separately";
  return {
    keyId,
    publicKeySpki,
    version,
    sign: (bytes) =>
      Effect.tryPromise({
        try: () => crypto.subtle.sign("Ed25519", keyPair.privateKey, asArrayBuffer(bytes)).then(encodeBase64),
        catch: (cause) => new MeasurementConfigSigningError({ cause: String(cause) }),
      }),
  };
};

/** Builds the signing layer used by the measurement configuration endpoint. */
export const makeMeasurementConfigSignerLayer = (
  keyId: string,
  privateKeyPkcs8?: string,
  version = 1,
): Layer.Layer<MeasurementConfigSigner, MeasurementConfigSigningError> =>
  Layer.effect(
    MeasurementConfigSigner,
    Effect.tryPromise({
      try: () => createMeasurementConfigSigner(keyId, privateKeyPkcs8, version),
      catch: (cause) => new MeasurementConfigSigningError({ cause: String(cause) }),
    }),
  );

/** Resolves project scope and serves a signed, expiring collector configuration. */
export class MeasurementConfigurationService extends Context.Service<MeasurementConfigurationService>()(
  "MeasurementConfigurationService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const signer = yield* MeasurementConfigSigner;

      const get = Effect.fn("MeasurementConfigurationService.get")(function* (rawToken: string) {
        const token = yield* validateCaptureToken(rawToken);
        const [project] = yield* db
          .select({ projectId: apiKeys.projectId })
          .from(apiKeys)
          .innerJoin(projects, eq(projects.id, apiKeys.projectId))
          .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, token)))
          .limit(1);
        if (!project) {
          return yield* Effect.fail(
            new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token" }),
          );
        }
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);
        const payload = {
          collectors: { appleAttributionEnabled: true, linkAllowedDomains: [] },
          conversionRules: [],
          schemaVersion: 1 as const,
          storage: {
            maxOutboxBytes: 20 * 1024 * 1024,
            maxOutboxRecords: 10_000,
            maxProtectedBytes: 20 * 1024 * 1024,
          },
        };
        const unsigned = {
          expiresAt: expiresAt.toISOString(),
          keyId: signer.keyId,
          payload,
          projectId: project.projectId,
          version: signer.version,
        };
        const signature = yield* signer.sign(
          new TextEncoder().encode(canonicalizeMeasurementConfig(unsigned)),
        );
        return new SignedMeasurementConfigurationResponse({
          ...unsigned,
          expiresAt,
          signature,
        });
      });

      return { get } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(
    MeasurementConfigurationService,
  )(MeasurementConfigurationService.make);
}
