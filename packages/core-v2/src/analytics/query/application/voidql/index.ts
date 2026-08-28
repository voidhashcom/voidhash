export * from "./errors.ts";
export {
  MAX_SOURCE_LENGTH,
  compileVoidQl,
  compilePure,
  compileToIr,
  type CompiledQuery,
} from "./compile.ts";
export { MAX_RESULT_ROWS } from "./compiler.ts";
export { CATALOG, CATALOG_SCHEMA_VERSION } from "./catalog/index.ts";
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
export { renderDebugSql, toStatement, type SqlPiece, type VoidQlStatement } from "./ir.ts";
export { verify } from "./verify.ts";
