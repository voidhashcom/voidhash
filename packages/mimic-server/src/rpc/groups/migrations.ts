import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  ConflictError,
  ForbiddenError,
  InvalidSchemaError,
  MigrationFailedError,
  NotFoundError,
} from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import {
  DatabaseMigrationSchema,
  MigrationChangeSchema,
  MigrationDryRunOptionsSchema,
  MigrationRunReportSchema,
  MigrationStatusSchema,
} from "../schemas.ts";

export const ListDatabaseMigrations = Rpc.make("ListDatabaseMigrations", {
  payload: Schema.Struct({
    databaseId: Schema.String,
  }),
  success: Schema.Array(DatabaseMigrationSchema),
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

const ApplyDatabaseMigrationPayload = Schema.Struct({
  databaseId: Schema.String,
  version: Schema.Number,
  name: Schema.String,
  checksum: Schema.String,
  changes: Schema.Array(MigrationChangeSchema),
  /**
   * `apply` (default when undefined): apply a fresh migration; recover a
   * partially-failed one by submitting the same checksum. `rerun`:
   * re-target only failed/pending docs of an existing migration; same
   * checksum required. `replace`: install new code under the same version
   * with a different checksum, optionally redoing already-succeeded docs.
   */
  mode: Schema.optional(Schema.Literals(["apply", "rerun", "replace"])),
  dryRun: Schema.optional(MigrationDryRunOptionsSchema),
  batchSize: Schema.optional(Schema.Number),
  redoSucceededOnReplace: Schema.optional(Schema.Boolean),
});

export const ApplyDatabaseMigration = Rpc.make("ApplyDatabaseMigration", {
  payload: ApplyDatabaseMigrationPayload,
  success: MigrationRunReportSchema,
  error: Schema.Union([
    NotFoundError,
    ConflictError,
    InvalidSchemaError,
    MigrationFailedError,
    ForbiddenError,
  ]),
});

export const GetMigrationStatus = Rpc.make("GetMigrationStatus", {
  payload: Schema.Struct({
    databaseId: Schema.String,
    version: Schema.Number,
  }),
  success: MigrationStatusSchema,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const MigrationsRpcs = RpcGroup.make(
  ListDatabaseMigrations,
  ApplyDatabaseMigration,
  GetMigrationStatus,
).middleware(AuthMiddleware);
