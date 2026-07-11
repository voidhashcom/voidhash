import { cloneValue, validateValue, type Value } from "@voidhash/mimic-core";
import { MigrationFailedError } from "@voidhash/mimic-server/rpc";
import { Context, Effect, Layer } from "effect";

/** Global the bundled migration registers its runner under. */
export const MigrationRunnerGlobal = "__MIMIC_RUN_MIGRATION__";

interface MigrationRunnerOutput {
  readonly value: Value;
}

const isRunnerOutput = (value: unknown): value is MigrationRunnerOutput =>
  typeof value === "object" && value !== null && "value" in value;

const migrationFailed = (message: string, cause?: unknown): MigrationFailedError =>
  new MigrationFailedError({
    code: "migration_failed",
    message,
    ...(cause === undefined ? {} : { details: { cause: String(cause) } }),
  });

/**
 * Evaluate a bundled data-migration against a document value.
 *
 * The bundle (produced by `mimic-cli`'s `MigrationBundler`) is a self-contained
 * IIFE that assigns a runner to `globalThis.__MIMIC_RUN_MIGRATION__`. We run it
 * via `new Function` with `globalThis`/`crypto` passed as parameters so the
 * bundle's `globalThis.__MIMIC_RUN_MIGRATION__ = …` assignment lands on a fresh
 * scope object instead of the host realm — **no `node:vm` / quickjs**, so it
 * runs unchanged on the Cloudflare Workers runtime.
 *
 * In production this evaluation happens inside the isolated
 * `MimicMigrationSandbox` container; in dev/test it runs in-process.
 */
export const evaluateBundledMigration = (source: string, oldValue: Value): Value => {
  validateValue(oldValue);
  const scope: Record<string, unknown> = {};
  scope.globalThis = scope;
  scope.crypto = globalThis.crypto;
  const factory = new Function(
    "globalThis",
    "crypto",
    `${source}\nreturn globalThis.${MigrationRunnerGlobal};`,
  );
  const runner = factory(scope, globalThis.crypto) as
    | ((input: { readonly oldValue: Value }) => unknown)
    | undefined;
  if (typeof runner !== "function") {
    throw migrationFailed("Migration bundle did not register a runner");
  }
  const output = runner({ oldValue: cloneValue(oldValue) });
  if (!isRunnerOutput(output)) {
    throw migrationFailed("Migration bundle returned an invalid result");
  }
  validateValue(output.value);
  return output.value;
};

export interface MigrationExecutorApi {
  /**
   * Transform `oldValue` by running the bundled migration `source`, yielding
   * the migrated value. Fails with `MigrationFailedError` on any error.
   */
  readonly run: (source: string, oldValue: Value) => Effect.Effect<Value, MigrationFailedError>;
}

export class MigrationExecutor extends Context.Service<MigrationExecutor, MigrationExecutorApi>()(
  "@voidhash/mimic-db/MigrationExecutor",
) {}

/** Wrap a raw evaluator into the executor contract with consistent error mapping. */
export const makeMigrationExecutor = (
  evaluate: (source: string, oldValue: Value) => Effect.Effect<Value, unknown>,
): MigrationExecutorApi => ({
  run: (source, oldValue) =>
    evaluate(source, oldValue).pipe(
      Effect.catch((error) =>
        error instanceof MigrationFailedError
          ? Effect.fail(error)
          : Effect.fail(
              migrationFailed(error instanceof Error ? error.message : String(error), error),
            ),
      ),
    ),
});

/** In-process executor (dev, tests, and the local standalone backend). */
export const LocalMigrationExecutorLive = Layer.succeed(
  MigrationExecutor,
  makeMigrationExecutor((source, oldValue) =>
    Effect.try({
      try: () => evaluateBundledMigration(source, oldValue),
      catch: (error) => error,
    }),
  ),
);
