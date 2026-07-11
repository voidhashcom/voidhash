import { Schema } from "effect";

const detailsField = {
  details: Schema.optional(Schema.Unknown),
} as const;

export class UnauthorizedError extends Schema.ErrorClass<UnauthorizedError>(
  "@voidhash/mimic-rpc/UnauthorizedError",
)({
  _tag: Schema.tag("UnauthorizedError"),
  code: Schema.Literal("unauthorized"),
  message: Schema.String,
  ...detailsField,
}) {}

export class ForbiddenError extends Schema.ErrorClass<ForbiddenError>(
  "@voidhash/mimic-rpc/ForbiddenError",
)({
  _tag: Schema.tag("ForbiddenError"),
  code: Schema.Literal("forbidden"),
  message: Schema.String,
  ...detailsField,
}) {}

export class NotFoundError extends Schema.ErrorClass<NotFoundError>(
  "@voidhash/mimic-rpc/NotFoundError",
)({
  _tag: Schema.tag("NotFoundError"),
  code: Schema.Literal("not_found"),
  message: Schema.String,
  ...detailsField,
}) {}

export class ConflictError extends Schema.ErrorClass<ConflictError>(
  "@voidhash/mimic-rpc/ConflictError",
)({
  _tag: Schema.tag("ConflictError"),
  code: Schema.Literal("conflict"),
  message: Schema.String,
  ...detailsField,
}) {}

export class ValidationError extends Schema.ErrorClass<ValidationError>(
  "@voidhash/mimic-rpc/ValidationError",
)({
  _tag: Schema.tag("ValidationError"),
  code: Schema.Literal("validation_error"),
  message: Schema.String,
  ...detailsField,
}) {}

export class VersionConflictError extends Schema.ErrorClass<VersionConflictError>(
  "@voidhash/mimic-rpc/VersionConflictError",
)({
  _tag: Schema.tag("VersionConflictError"),
  code: Schema.Literal("version_conflict"),
  message: Schema.String,
  ...detailsField,
}) {}

export class InvalidSchemaError extends Schema.ErrorClass<InvalidSchemaError>(
  "@voidhash/mimic-rpc/InvalidSchemaError",
)({
  _tag: Schema.tag("InvalidSchemaError"),
  code: Schema.Literal("invalid_schema"),
  message: Schema.String,
  ...detailsField,
}) {}

export class InvalidValueError extends Schema.ErrorClass<InvalidValueError>(
  "@voidhash/mimic-rpc/InvalidValueError",
)({
  _tag: Schema.tag("InvalidValueError"),
  code: Schema.Literal("invalid_value"),
  message: Schema.String,
  ...detailsField,
}) {}

export class MigrationFailedError extends Schema.ErrorClass<MigrationFailedError>(
  "@voidhash/mimic-rpc/MigrationFailedError",
)({
  _tag: Schema.tag("MigrationFailedError"),
  code: Schema.Literal("migration_failed"),
  message: Schema.String,
  ...detailsField,
}) {}

export class InternalError extends Schema.ErrorClass<InternalError>(
  "@voidhash/mimic-rpc/InternalError",
)({
  _tag: Schema.tag("InternalError"),
  code: Schema.Literal("internal_error"),
  message: Schema.String,
  ...detailsField,
}) {}

export const ApiErrorSchemas = [
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  VersionConflictError,
  InvalidSchemaError,
  InvalidValueError,
  MigrationFailedError,
  InternalError,
] as const;

export const toUnknownError = (error: unknown): InternalError =>
  error instanceof InternalError
    ? error
    : new InternalError({
        code: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
