/**
 * The VoidQL compile orchestration:
 * `tokenize → parse → resolve+print → verify`, yielding a {@link CompiledQuery}
 * that the service executes. No ClickHouse, no Db, no Auth here — trivially
 * unit-testable and fuzzable.
 */
import { Crypto, Effect, type PlatformError } from "effect";

import type { Capability, ColumnSpec } from "./catalog/types.ts";
import { type CompiledSelect, compileSelect } from "./compiler.ts";
import { isVoidQlCompileError, type VoidQlCompileError } from "./errors.ts";
import type { SqlPiece } from "./ir.ts";
import { parse } from "./parser.ts";
import type { AuthorizedScope } from "./scope.ts";
import { verify } from "./verify.ts";

export interface CompiledQuery {
  readonly pieces: readonly SqlPiece[];
  /** Output column names and types used to decode the result set. */
  readonly columns: readonly ColumnSpec[];
  /** Server-random ClickHouse query id; never user input. */
  readonly queryId: string;
}

/**
 * Pure `parse → resolve+print` (no verify). Throws the typed compile errors.
 * Exposed for unit tests and the validate/repair loop.
 */
export const compileToIr = (
  text: string,
  scope: AuthorizedScope,
  capabilities: ReadonlySet<Capability>,
): CompiledSelect => compileSelect(parse(text), scope, capabilities);

/**
 * Full pure pipeline including the value-level verifier. Throws on the compile-error
 * union or an `VoidQlIsolationError` defect.
 */
export const compilePure = (
  text: string,
  scope: AuthorizedScope,
  capabilities: ReadonlySet<Capability>,
  queryId: string,
): CompiledQuery => {
  const compiled = compileToIr(text, scope, capabilities);
  verify(compiled.pieces, compiled.injected, scope);
  return { pieces: compiled.pieces, columns: compiled.shape, queryId };
};

/**
 * Compile VoidQL text to a {@link CompiledQuery} as an Effect. Typed compile errors
 * surface in the error channel; any non-VoidQL throwable becomes a defect (a real
 * bug), never a silent failure.
 */
export const compileVoidQl = (
  text: string,
  scope: AuthorizedScope,
  capabilities: ReadonlySet<Capability>,
): Effect.Effect<CompiledQuery, VoidQlCompileError | PlatformError.PlatformError, Crypto.Crypto> =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const queryId = yield* crypto.randomUUIDv4;
    return yield* Effect.try({
      try: () => compilePure(text, scope, capabilities, queryId),
      catch: (error) => error,
    }).pipe(
      Effect.catch((error) => {
        if (isVoidQlCompileError(error)) return Effect.fail(error);
        return Effect.die(error);
      }),
    );
  });
