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
    emit: () => {
      throw new Error("oldRoot is read-only");
    },
    generator: session.generator,
  };

  migration.migrate?.({
    root: migration.to.createProxy(session, []),
    oldRoot: migration.from.createProxy(readOnlySession, []),
  });

  const validated = validate(migration.to.schema, current);
  if (validated === undefined) {
    throw new Error(`Migration ${migration.version} (${migration.name}) produced an empty root`);
  }
  return validated;
};
