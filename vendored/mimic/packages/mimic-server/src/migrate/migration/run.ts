import { Effect } from "effect";
import {
  applyBatch,
  cloneValue,
  createGenerator,
  validate,
  validateValue,
  type Value,
} from "@voidhash/mimic-core";

import { reconcileMigrationValue } from "./reconcile.ts";
import type { AnyDirectMigration } from "./definition.ts";

/**
 * Rejects an impossible migration outcome. `runDirectMigration` is a
 * synchronous API whose callers wrap it in `Effect.try`, so violations are
 * raised as defects rather than returned.
 */
const dieWith = (message: string): never => Effect.runSync(Effect.die(new Error(message)));

/** Runs a deployed migration directly without evaluating generated source. */
export const runDirectMigration = (migration: AnyDirectMigration, oldValue: Value): Value => {
  validateValue(oldValue);
  const original = cloneValue(oldValue);
  let current = cloneValue(oldValue);

  const reconciled = reconcileMigrationValue({
    oldSchema: migration.from.schema,
    newSchema: migration.to.schema,
    value: current,
  });
  if (reconciled.ok && reconciled.value !== undefined) {
    current = reconciled.value;
  }

  const generator = createGenerator();
  const session = {
    current: () => current,
    emit: (commands: Parameters<typeof applyBatch>[1]) => {
      if (commands.length > 0) current = applyBatch(current, commands);
    },
    generator: {
      nextArrayItemId: () => globalThis.crypto.randomUUID(),
      nextTreeNodeId: () => globalThis.crypto.randomUUID(),
      between: (lower: string | undefined, upper: string | undefined) =>
        generator.between(lower, upper),
    },
  };
  const readOnlySession = {
    current: () => original,
    emit: () => dieWith("oldRoot is read-only"),
    generator: session.generator,
  };

  migration.migrate?.({
    root: migration.to.createProxy(session, []),
    oldRoot: migration.from.createProxy(readOnlySession, []),
  });

  const validated = validate(migration.to.schema, current);
  if (validated === undefined) {
    return dieWith(`Migration ${migration.version} (${migration.name}) produced an empty root`);
  }
  return validated;
};
