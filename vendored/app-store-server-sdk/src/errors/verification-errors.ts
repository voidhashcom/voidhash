import { Schema } from "effect";
import { constant } from "@voidhash/lib/lang";

/**
 * Status codes for JWS verification operations.
 */
export const VerificationStatus = constant({
  OK: "OK",
  VERIFICATION_FAILURE: "VERIFICATION_FAILURE",
  RETRYABLE_VERIFICATION_FAILURE: "RETRYABLE_VERIFICATION_FAILURE",
  INVALID_APP_IDENTIFIER: "INVALID_APP_IDENTIFIER",
  INVALID_ENVIRONMENT: "INVALID_ENVIRONMENT",
  INVALID_CHAIN_LENGTH: "INVALID_CHAIN_LENGTH",
  INVALID_CERTIFICATE: "INVALID_CERTIFICATE",
  FAILURE: "FAILURE",
});

export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const VerificationStatusSchema = Schema.Union([
  Schema.Literal(VerificationStatus.OK),
  Schema.Literal(VerificationStatus.VERIFICATION_FAILURE),
  Schema.Literal(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE),
  Schema.Literal(VerificationStatus.INVALID_APP_IDENTIFIER),
  Schema.Literal(VerificationStatus.INVALID_ENVIRONMENT),
  Schema.Literal(VerificationStatus.INVALID_CHAIN_LENGTH),
  Schema.Literal(VerificationStatus.INVALID_CERTIFICATE),
  Schema.Literal(VerificationStatus.FAILURE),
]);

/**
 * Error thrown when JWS verification fails.
 */
export class VerificationError extends Schema.TaggedErrorClass<VerificationError>(
  "VerificationError",
)("VerificationError", {
  status: VerificationStatusSchema,
  cause: Schema.OptionFromOptionalKey(Schema.Unknown),
}) {
  get isRetryable(): boolean {
    return this.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
  }
}

/**
 * Error thrown when JWT token creation fails.
 */
export class JwtCreationError extends Schema.TaggedErrorClass<JwtCreationError>("JwtCreationError")(
  "JwtCreationError",
  {
    message: Schema.String,
    cause: Schema.OptionFromOptionalKey(Schema.Unknown),
  },
) {}

/**
 * Error thrown when certificate operations fail.
 */
export class CertificateError extends Schema.TaggedErrorClass<CertificateError>("CertificateError")(
  "CertificateError",
  {
    message: Schema.String,
    cause: Schema.OptionFromOptionalKey(Schema.Unknown),
  },
) {}
