/**
 * Public entry point for the VoidQL analytics access layer
 * (docs/analytics-access-layer.html). A custom, read-only SQL dialect compiled
 * server-side to safe ClickHouse SQL, with tenant isolation by logical-view
 * substitution (compiler-injected bound-literal scope) + a hardened value-level
 * verifier.
 */
export * from "./errors.ts";
export { compileVoidQl, compilePure, compileToIr, type CompiledQuery } from "./compile.ts";
export { MAX_RESULT_ROWS } from "./compiler.ts";
export { CATALOG, CATALOG_SCHEMA_VERSION, getCatalogTable } from "./catalog/index.ts";
export type {
  CatalogTable,
  CatalogColumn,
  VoidQLType,
  Capability,
  ColumnSpec,
} from "./catalog/types.ts";
export { lookupFunction, registeredFunctionNames } from "./functions.ts";
export { type AuthorizedScope, makeAuthorizedScope } from "./scope.ts";
export { parse } from "./parser.ts";
export { lex } from "./lexer.ts";
export { renderDebugSql, toStatement, type SqlPiece } from "./ir.ts";
export { verify } from "./verify.ts";
export {
  VoidQlService,
  type RunQueryInput,
  type RunQueryResult,
  type ValidateResult,
  type SchemaDescriptor,
  type VoidQlPrincipal,
} from "./VoidQlService.ts";
