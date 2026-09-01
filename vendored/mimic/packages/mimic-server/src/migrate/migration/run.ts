import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
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
class InvalidDirectMigrationError extends Schema.TaggedErrorClass<InvalidDirectMigrationError>()(
  "InvalidDirectMigrationError",
  { message: Schema.String },
) {}

const dieWith = (message: string): never => {
  throw new InvalidDirectMigrationError({ message });
};

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
  if (reconciled.ok && Option.isSome(reconciled.value)) {
    current = reconciled.value.value;
  }

  const generator = createGenerator();
  const session = {
    current: () => current,
    emit: (commands: Parameters<typeof applyBatch>[1]) => {
      if (Arr.isReadonlyArrayNonEmpty(commands)) current = applyBatch(current, commands);
    },
    generator: {
      nextArrayItemId: () => globalThis.crypto.randomUUID(),
      nextTreeNodeId: () => globalThis.crypto.randomUUID(),
      between: (...args: Parameters<typeof generator.between>) => generator.between(...args),
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
