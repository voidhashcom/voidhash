import {
  CapturePayloadTooLargeError,
  CaptureInvalidRequestError,
  CaptureUnauthorizedError,
  ProtectedEvidenceConflictError,
  type ProtectedEvidenceRequest,
} from "@voidhash/api-contracts/event-capture";
import {
  and,
  apiKeys,
  Db,
  eq,
  measurementDeletionRequests,
  projects,
  protectedMeasurementEvidence,
} from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import { validateCaptureToken } from "../analyticsIngest/EventCaptureService.ts";

const MAX_PROTECTED_EVIDENCE_BYTES = 512 * 1024;

export class ProtectedEvidenceServiceError extends Schema.TaggedErrorClass<ProtectedEvidenceServiceError>(
  "ProtectedEvidenceServiceError",
)("ProtectedEvidenceServiceError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface PutProtectedEvidenceResult {
  readonly accepted: true;
  readonly blobId: string;
}

/** Strictly decodes canonical base64 without accepting ignored characters. */
export const decodeProtectedCiphertext = (
  ciphertext: string,
): Effect.Effect<Uint8Array, CapturePayloadTooLargeError | CaptureInvalidRequestError> =>
  Effect.gen(function* () {
    if (!/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/.test(ciphertext)) {
      return yield* Effect.fail(
        new CaptureInvalidRequestError({
          code: "invalid_request",
          error: "ciphertext must be canonical base64",
        }),
      );
    }
    const estimatedBytes = Math.floor((ciphertext.length * 3) / 4) - (ciphertext.endsWith("==") ? 2 : ciphertext.endsWith("=") ? 1 : 0);
    if (estimatedBytes > MAX_PROTECTED_EVIDENCE_BYTES) {
      return yield* Effect.fail(
        new CapturePayloadTooLargeError({
          code: "payload_too_large",
          error: "protected evidence exceeds the per-blob bound",
        }),
      );
    }
    return yield* Effect.try({
      try: () => Uint8Array.from(atob(ciphertext), (value) => value.charCodeAt(0)),
      catch: (cause) =>
        new CaptureInvalidRequestError({
          code: "invalid_request",
          error: `ciphertext must be canonical base64: ${String(cause)}`,
        }),
    });
  });

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

export class ProtectedEvidenceService extends Context.Service<ProtectedEvidenceService>()(
  "ProtectedEvidenceService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const put = Effect.fn("ProtectedEvidenceService.put")(function* (
        input: typeof ProtectedEvidenceRequest.Type,
      ) {
        const token = yield* validateCaptureToken(input.token);
        const ciphertext = yield* decodeProtectedCiphertext(input.ciphertext);
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

        const [deletion] = yield* db
          .select({ id: measurementDeletionRequests.id })
          .from(measurementDeletionRequests)
          .where(
            and(
              eq(measurementDeletionRequests.projectId, project.projectId),
              eq(measurementDeletionRequests.installationId, input.installationId),
              eq(measurementDeletionRequests.status, "completed"),
            ),
          )
          .limit(1);
        if (deletion) {
          return yield* Effect.fail(
            new CaptureInvalidRequestError({
              code: "invalid_request",
              error: "protected evidence cannot be recreated for a deleted installation",
            }),
          );
        }

        const [existing] = yield* db
          .select()
          .from(protectedMeasurementEvidence)
          .where(
            and(
              eq(protectedMeasurementEvidence.projectId, project.projectId),
              eq(protectedMeasurementEvidence.blobId, input.blobId),
            ),
          )
          .limit(1);

        if (existing) {
          const metadataMatches =
            existing.purpose === input.purpose &&
            existing.consentRevision === input.consentRevision &&
            existing.retentionClass === input.retentionClass &&
            existing.encryptionKeyVersion === input.encryptionKeyVersion &&
            existing.deletionState === input.deletionState;
          if (
            !metadataMatches ||
            existing.installationId !== input.installationId ||
            existing.ciphertext === null ||
            !equalBytes(existing.ciphertext, ciphertext)
          ) {
            return yield* Effect.fail(
              new ProtectedEvidenceConflictError({
                code: "protected_evidence_conflict",
                error: "blobId already exists with different protected evidence",
              }),
            );
          }
          return { accepted: true, blobId: input.blobId } as const;
        }

        yield* db.insert(protectedMeasurementEvidence).values({
          blobId: input.blobId,
          ciphertext: Buffer.from(ciphertext),
          consentRevision: input.consentRevision,
          deletionState: input.deletionState,
          encryptionKeyVersion: input.encryptionKeyVersion,
          id: `protected_${crypto.randomUUID()}`,
          installationId: input.installationId,
          projectId: project.projectId,
          purpose: input.purpose,
          retentionClass: input.retentionClass,
        });
        return { accepted: true, blobId: input.blobId } as const;
      });

      return { put } as const;
    }),
  },
) {
  static readonly layer: Layer.Layer<ProtectedEvidenceService, never, Db> = Layer.effect(
    ProtectedEvidenceService,
  )(ProtectedEvidenceService.make);
}
