import type { Schema, Value } from "@voidhash/mimic-core";

export type SchemaMigrationIssueCode =
  | "incompatible-type"
  | "required-field-without-default"
  | "invalid-tree"
  | "invalid-value"
  | "missing-value";

export interface SchemaMigrationIssue {
  readonly code: SchemaMigrationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface SchemaMigrationCompatibilityIssue {
  readonly code: Exclude<SchemaMigrationIssueCode, "missing-value">;
  readonly path: string;
  readonly message: string;
}

export type ReconcileMigrationValueResult =
  | { readonly ok: true; readonly value: Value | undefined }
  | { readonly ok: false; readonly error: SchemaMigrationIssue };

export interface AnalyzeMigrationOptions {
  readonly oldSchema: Schema;
  readonly newSchema: Schema;
}

export interface ReconcileMigrationValueOptions extends AnalyzeMigrationOptions {
  readonly value: Value;
}
