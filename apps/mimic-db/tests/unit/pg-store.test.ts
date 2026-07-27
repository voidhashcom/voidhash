import { SqlError } from "effect/unstable/sql";
import { describe, expect, it } from "vitest";

import { isDdlDeniedError, isMissingTableError } from "../../src/core/pg-store.ts";

// Mirrors the error node-postgres produces for a Postgres failure: the driver
// error (with the SQLSTATE `code`) lands in the SqlError reason's `cause`.
const sqlErrorWithCause = (cause: unknown): SqlError.SqlError =>
  new SqlError.SqlError({
    reason: new SqlError.UnknownError({
      cause,
      message: "Failed to execute statement",
      operation: "execute",
    }),
  });

const pgError = (code: string, message: string): Error => {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
};

describe("pg-store error classification", () => {
  it("detects undefined_table (42P01) as a missing table", () => {
    const error = sqlErrorWithCause(pgError("42P01", `relation "mimic_documents" does not exist`));
    expect(isMissingTableError(error)).toBe(true);
    expect(isDdlDeniedError(error)).toBe(false);
  });

  it("detects insufficient_privilege (42501) as a DDL denial", () => {
    const error = sqlErrorWithCause(pgError("42501", `permission denied for schema public`));
    expect(isDdlDeniedError(error)).toBe(true);
    expect(isMissingTableError(error)).toBe(false);
  });

  it("treats other SQL failures as neither", () => {
    const duplicate = sqlErrorWithCause(
      pgError("23505", `duplicate key value violates unique constraint "mimic_documents_pkey"`),
    );
    expect(isMissingTableError(duplicate)).toBe(false);
    expect(isDdlDeniedError(duplicate)).toBe(false);

    const nonError = sqlErrorWithCause("connection reset");
    expect(isMissingTableError(nonError)).toBe(false);
    expect(isDdlDeniedError(nonError)).toBe(false);
  });
});
